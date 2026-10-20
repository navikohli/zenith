import {
  feedbackWork,
  posts,
  postComments,
  eq,
  and,
  inArray,
  isNull,
  sql,
  type Transaction,
} from '@/lib/server/db'
import type { PostId, PostCommentId } from '@zenith/ids'
import { ConflictError } from '@/lib/shared/errors'
import { digest, planSchema, deploymentSchema } from './contracts'
import type { z } from 'zod'

export type Work = typeof feedbackWork.$inferSelect
export interface WorkState {
  sourceHash: string
  planId?: PostCommentId
  planHash?: string
  planNoteHash?: string
  acceptedHash?: string
  approvedBy?: string
  approvedAt?: string
  decision?: string
  testCommands?: z.infer<typeof planSchema>['testCommands']
  reportId?: PostCommentId
  reportHash?: string
  implementationSha?: string
  receipt?: z.infer<typeof deploymentSchema>
  receiptHash?: string
  notificationJobIds?: string[]
}
export const stateOf = (work: Work) => work.state as unknown as WorkState

export async function lockFeedbackPosts(tx: Transaction, ids: string[]) {
  for (const id of [...new Set(ids)].sort())
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`)
}
export async function rejectActiveWork(tx: Transaction, ids: string[]) {
  const active = await tx
    .select()
    .from(feedbackWork)
    .where(sql`${feedbackWork.phase} not in ('released','deployed')`)
  if (active.some((w) => w.sourceIds.some((id) => ids.includes(id))))
    throw new ConflictError(
      'FEEDBACK_CLAIMED',
      'Feedback belongs to active work; release it before merging or claiming again'
    )
}
export async function sourceSnapshot(tx: Transaction, ids: string[], requireLive = true) {
  const sources = await tx
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      contentJson: posts.contentJson,
      boardId: posts.boardId,
      principalId: posts.principalId,
      bindingId: posts.productUserBindingId,
      widgetMetadata: posts.widgetMetadata,
      canonicalPostId: posts.canonicalPostId,
      deletedAt: posts.deletedAt,
    })
    .from(posts)
    .where(inArray(posts.id, ids as PostId[]))
    .orderBy(posts.id)
  if (requireLive && (sources.length !== ids.length || sources.some((p) => p.deletedAt)))
    throw new ConflictError('SOURCE_UNAVAILABLE', 'A source feedback was removed')
  const comments = await tx
    .select({
      id: postComments.id,
      postId: postComments.postId,
      content: postComments.content,
      contentJson: postComments.contentJson,
    })
    .from(postComments)
    .where(
      and(
        inArray(postComments.postId, ids as PostId[]),
        eq(postComments.isPrivate, false),
        isNull(postComments.deletedAt)
      )
    )
    .orderBy(postComments.id)
  return { sources, comments }
}
async function evidenceHash(tx: Transaction, work: Work) {
  return digest(await sourceSnapshot(tx, work.sourceIds))
}
export async function verifyEvidence(tx: Transaction, work: Work) {
  if ((await evidenceHash(tx, work)) !== stateOf(work).sourceHash)
    throw new ConflictError('SOURCE_CHANGED', 'Feedback changed; release and reassess all sources')
}
export async function commentHash(tx: Transaction, id: PostCommentId) {
  const [c] = await tx.select().from(postComments).where(eq(postComments.id, id))
  if (!c || c.deletedAt || !c.isPrivate)
    throw new ConflictError('PLAN_CHANGED', 'Private plan/report was removed or exposed')
  return digest({ content: c.content, contentJson: c.contentJson })
}
export async function verifyPlan(tx: Transaction, work: Work) {
  const s = stateOf(work)
  if (
    !s.planId ||
    (await commentHash(tx, s.planId)) !== s.planNoteHash ||
    s.acceptedHash !== s.planHash
  )
    throw new ConflictError('PLAN_CHANGED', 'The exact saved plan must be approved again')
  await verifyEvidence(tx, work)
}
