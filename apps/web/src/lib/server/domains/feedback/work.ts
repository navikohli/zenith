import { randomBytes } from 'node:crypto'
import { createId, type PostId, type PrincipalId, type PostCommentId } from '@zenith/ids'
import {
  db,
  feedbackWork,
  productUserBindings,
  posts,
  postComments,
  postStatuses,
  jobQueue,
  eq,
  and,
  inArray,
  isNull,
  sql,
  type Transaction,
} from '@/lib/server/db'
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/shared/errors'
import { enqueueJob } from '@/lib/server/jobs/job-queue'
import { emit } from '@/lib/server/events/emit'
import { postDeployed } from '@/lib/server/events/catalogue'
import { productFor } from './products'
import {
  digest,
  planSchema,
  reportSchema,
  deploymentSchema,
  requirePhase,
  requireRevision,
  verifyTests,
  verifyDeployment,
} from './contracts'
import type { z } from 'zod'

import {
  type Work,
  stateOf,
  lockFeedbackPosts,
  rejectActiveWork,
  sourceSnapshot,
  commentHash,
  verifyEvidence,
  verifyPlan,
} from './work.guard'

async function privateNote(tx: Transaction, work: Work, content: string) {
  const [note] = await tx
    .insert(postComments)
    .values({
      id: createId('post_comment'),
      postId: work.canonicalPostId,
      principalId: work.ownerId,
      content,
      isPrivate: true,
      isTeamMember: true,
    })
    .returning()
  await tx
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1` })
    .where(eq(posts.id, work.canonicalPostId))
  return { id: note.id, hash: digest({ content: note.content, contentJson: note.contentJson }) }
}
export async function readWork(id: string) {
  const [w] = await db.select().from(feedbackWork).where(eq(feedbackWork.id, id))
  if (!w) throw new NotFoundError('WORK_NOT_FOUND', 'Work not found')
  const { claimHash: _secret, ...safe } = w
  const snapshot = await db.transaction((tx) => sourceSnapshot(tx, w.sourceIds, false))
  const bindings = await db
    .select()
    .from(productUserBindings)
    .where(eq(productUserBindings.productKey, w.productKey))
  const noteIds = [stateOf(w).planId, stateOf(w).reportId].filter(Boolean) as PostCommentId[]
  const notes = noteIds.length
    ? await db
        .select({
          id: postComments.id,
          content: postComments.content,
          contentJson: postComments.contentJson,
          deletedAt: postComments.deletedAt,
        })
        .from(postComments)
        .where(inArray(postComments.id, noteIds))
    : []
  const ids = stateOf(w).notificationJobIds ?? []
  const deliveries = ids.length
    ? await db
        .select({
          id: jobQueue.jobId,
          status: jobQueue.status,
          attempts: jobQueue.attempts,
          lastError: jobQueue.lastError,
          delivery: sql<unknown>`${jobQueue.payload}->'delivery'`,
        })
        .from(jobQueue)
        .where(inArray(jobQueue.jobId, ids))
    : []
  return {
    ...safe,
    ...snapshot,
    bindings: bindings.filter((b) => snapshot.sources.some((p) => p.bindingId === b.id)),
    notes,
    deliveries,
    untrustedContent: true,
  }
}
export async function claimWork(
  productKey: string,
  postId: PostId,
  extraIds: PostId[],
  ownerId: PrincipalId,
  sessionId: string
) {
  const p = await productFor(productKey),
    claimToken = randomBytes(32).toString('hex')
  const work = await db.transaction(async (tx) => {
    const [root] = await tx.select().from(posts).where(eq(posts.id, postId))
    if (!root || root.deletedAt || root.canonicalPostId || root.boardId !== p.boardId)
      throw new ConflictError('INVALID_CANONICAL', 'Choose a live canonical post in this product')
    const children = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.canonicalPostId, postId), isNull(posts.deletedAt)))
    const sourceIds = [...new Set([postId, ...extraIds, ...children.map((p) => p.id)])].sort()
    await lockFeedbackPosts(tx, sourceIds)
    const freshChildren = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.canonicalPostId, postId), isNull(posts.deletedAt)))
    const [freshRoot] = await tx.select().from(posts).where(eq(posts.id, postId))
    if (
      freshRoot.canonicalPostId ||
      freshChildren.some((p) => !sourceIds.includes(p.id)) ||
      children.some((p) => !freshChildren.some((c) => c.id === p.id))
    )
      throw new ConflictError('GROUP_CHANGED', 'Feedback group changed; refresh and claim again')
    await rejectActiveWork(tx, sourceIds)
    const snapshot = await sourceSnapshot(tx, sourceIds)
    if (
      snapshot.sources.some(
        (s) => s.boardId !== p.boardId || (s.canonicalPostId && s.canonicalPostId !== postId)
      )
    )
      throw new ConflictError(
        'PRODUCT_MISMATCH',
        'All source feedback must belong to this product and canonical group'
      )
    const [w] = await tx
      .insert(feedbackWork)
      .values({
        productKey,
        canonicalPostId: postId,
        sourceIds,
        ownerId,
        sessionId,
        claimHash: digest(claimToken),
        state: { sourceHash: digest(snapshot) },
      })
      .returning()
    return w
  })
  return { ...(await readWork(work.id)), claimToken }
}
export async function mutateWork(
  id: string,
  expectedRevision: number,
  action: string,
  data: unknown,
  actor: PrincipalId,
  claimToken: string,
  sessionId: string,
  approvalBy?: string
) {
  await db.transaction(async (tx) => {
    const [w] = await tx.select().from(feedbackWork).where(eq(feedbackWork.id, id)).for('update')
    if (!w) throw new NotFoundError('WORK_NOT_FOUND', 'Work not found')
    requireRevision(w.revision, expectedRevision)
    if (
      action !== 'approve' &&
      (w.ownerId !== actor || w.sessionId !== sessionId || w.claimHash !== digest(claimToken))
    )
      throw new ForbiddenError(
        'CLAIM_MISMATCH',
        'Only the owning developer session can update this work'
      )
    let phase = w.phase
    const s = stateOf(w)
    if (action === 'release') {
      requirePhase(phase, ['claimed', 'planned', 'approved', 'implementing', 'ready'])
      phase = 'released'
    } else if (action === 'plan') {
      requirePhase(phase, ['claimed', 'planned', 'approved'])
      await verifyEvidence(tx, w)
      const plan = planSchema.parse(data),
        note = await privateNote(tx, w, plan.content)
      Object.assign(s, {
        planId: note.id,
        planNoteHash: note.hash,
        planHash: digest({
          noteHash: note.hash,
          decision: plan.decision,
          testCommands: plan.testCommands,
          sourceHash: s.sourceHash,
        }),
        decision: plan.decision,
        testCommands: plan.testCommands,
      })
      delete s.acceptedHash
      delete s.approvedBy
      delete s.approvedAt
      phase = 'planned'
    } else if (action === 'approve') {
      requirePhase(phase, ['planned'])
      await verifyEvidence(tx, w)
      const submittedHash = (data as { planHash?: string })?.planHash
      if (
        !s.planId ||
        submittedHash !== s.planHash ||
        (await commentHash(tx, s.planId)) !== s.planNoteHash ||
        s.decision !== 'small-change'
      )
        throw new ConflictError(
          'PLAN_CHANGED',
          'Only the exact saved small-change plan can be accepted'
        )
      s.acceptedHash = s.planHash
      s.approvedBy = approvalBy
      s.approvedAt = new Date().toISOString()
      phase = 'approved'
    } else if (action === 'start') {
      requirePhase(phase, ['approved'])
      await verifyPlan(tx, w)
      phase = 'implementing'
    } else if (action === 'report') {
      requirePhase(phase, ['implementing'])
      await verifyPlan(tx, w)
      const report = reportSchema.parse(data),
        p = await productFor(w.productKey)
      if (report.repository !== p.repository)
        throw new ConflictError('REPOSITORY_MISMATCH', 'Report repository does not match product')
      const passed = verifyTests(s.testCommands!, report.tests),
        note = await privateNote(tx, w, report.content)
      Object.assign(s, {
        reportId: note.id,
        reportHash: digest({ noteHash: note.hash, ...report }),
        reportNoteHash: note.hash,
        implementationSha: report.implementationSha,
        tests: report.tests,
      })
      phase = passed ? 'ready' : 'implementing'
    } else throw new ConflictError('UNKNOWN_ACTION', 'Unknown work operation')
    await tx
      .update(feedbackWork)
      .set({
        phase,
        state: s as unknown as Record<string, unknown>,
        revision: w.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(feedbackWork.id, id))
  })
  return readWork(id)
}
export async function recordDeployment(id: string, data: z.infer<typeof deploymentSchema>) {
  await db.transaction(async (tx) => {
    const [w] = await tx.select().from(feedbackWork).where(eq(feedbackWork.id, id)).for('update')
    if (!w) throw new NotFoundError('WORK_NOT_FOUND', 'Work not found')
    const s = stateOf(w),
      receiptHash = digest(data)
    if (w.phase === 'deployed') {
      if (receiptHash !== s.receiptHash)
        throw new ConflictError(
          'DEPLOYMENT_CONFLICT',
          'A different deployment receipt is already recorded'
        )
      return
    }
    requirePhase(w.phase, ['ready'])
    await verifyPlan(tx, w)
    if (!s.reportId || (await commentHash(tx, s.reportId)) !== w.state.reportNoteHash)
      throw new ConflictError('REPORT_CHANGED', 'Test report changed; report and test again')
    const p = await productFor(w.productKey)
    verifyDeployment(p, data, s)
    const [complete] = await tx.select().from(postStatuses).where(eq(postStatuses.slug, 'complete'))
    if (!complete) throw new ConflictError('STATUS_MISSING', 'Complete status is not configured')
    await tx
      .update(posts)
      .set({ statusId: complete.id, updatedAt: new Date() })
      .where(inArray(posts.id, w.sourceIds as PostId[]))
    // No generic status/comment email: this dedicated event is the deployment boundary.
    await emit(tx, postDeployed, {
      entityId: w.canonicalPostId,
      actor: { type: 'system' },
      dedupeKey: `feedback:${id}`,
      payload: {
        workId: id,
        productKey: p.key,
        environment: data.environment,
        sha: data.sha,
        artifact: data.artifact,
      },
    })
    const sources = await tx
      .select({ bindingId: posts.productUserBindingId })
      .from(posts)
      .where(inArray(posts.id, w.sourceIds as PostId[]))
    const bindingIds = sources.map((s) => s.bindingId).filter(Boolean) as string[]
    const bindings = bindingIds.length
      ? await tx
          .select()
          .from(productUserBindings)
          .where(
            and(
              inArray(productUserBindings.id, bindingIds),
              eq(productUserBindings.active, true),
              eq(productUserBindings.productKey, p.key)
            )
          )
      : []
    const unique = [...new Map(bindings.map((b) => [b.email.toLowerCase(), b])).values()]
    const jobs: string[] = []
    for (const binding of unique) {
      const job = await enqueueJob({
        queue: 'feedback-deployment-email',
        payload: { workId: id, bindingId: binding.id, receiptHash },
        dedupeKey: `feedback-deployment:${id}:${binding.id}`,
        maxAttempts: 5,
        executor: tx,
      })
      jobs.push(job.jobId)
    }
    Object.assign(s, { receipt: data, receiptHash, notificationJobIds: jobs })
    await tx
      .update(feedbackWork)
      .set({
        phase: 'deployed',
        state: s as unknown as Record<string, unknown>,
        revision: w.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(feedbackWork.id, id))
  })
  return readWork(id)
}
