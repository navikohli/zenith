import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db, feedbackProducts, feedbackWork, posts, eq, and, isNull, desc } from '@/lib/server/db'
import { withApiKeyAuth } from '@/lib/server/domains/api/auth'
import { successResponse, handleDomainError } from '@/lib/server/domains/api/responses'
import { PERMISSIONS } from '@/lib/shared/permissions'
import { ForbiddenError, ValidationError } from '@/lib/shared/errors'
import {
  productSchema,
  publicProduct,
  registerProduct,
  productFor,
  matchesSecret,
  revokeBinding,
} from '@/lib/server/domains/feedback/products'
import {
  claimWork,
  readWork,
  mutateWork,
  recordDeployment,
} from '@/lib/server/domains/feedback/work'
import { deploymentSchema } from '@/lib/server/domains/feedback/contracts'
import { parseTypeId } from '@/lib/server/domains/api/validation'
import type { PostId } from '@zenith/ids'

const operation = z.object({
  action: z.enum([
    'register',
    'revoke-binding',
    'claim',
    'plan',
    'approve',
    'start',
    'report',
    'release',
    'deploy',
  ]),
  productKey: z.string().optional(),
  workId: z.string().uuid().optional(),
  revision: z.number().int().positive().optional(),
  postId: z.string().optional(),
  extraIds: z.array(z.string()).max(30).default([]),
  sessionId: z.string().min(1).max(200).optional(),
  claimToken: z.string().optional(),
  data: z.unknown(),
})
const needed = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new ValidationError('REQUIRED', `${label} required`)
  return value
}
function failure(error: unknown) {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; '),
        },
      },
      { status: 400 }
    )
  return handleDomainError(error)
}

export const Route = createFileRoute('/api/v1/feedback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await withApiKeyAuth(request, { permission: PERMISSIONS.POST_VIEW_PRIVATE })
          const url = new URL(request.url),
            workId = url.searchParams.get('workId')
          if (workId) return successResponse(await readWork(z.string().uuid().parse(workId)))
          const key = url.searchParams.get('productKey')
          if (!key)
            return successResponse((await db.select().from(feedbackProducts)).map(publicProduct))
          const p = await productFor(key)
          const inbox = await db
            .select({
              id: posts.id,
              title: posts.title,
              content: posts.content,
              canonicalPostId: posts.canonicalPostId,
              createdAt: posts.createdAt,
              bindingId: posts.productUserBindingId,
            })
            .from(posts)
            .where(and(eq(posts.boardId, p.boardId), isNull(posts.deletedAt)))
            .orderBy(desc(posts.createdAt))
            .limit(100)
          const work = await db
            .select({
              id: feedbackWork.id,
              canonicalPostId: feedbackWork.canonicalPostId,
              sourceIds: feedbackWork.sourceIds,
              phase: feedbackWork.phase,
              revision: feedbackWork.revision,
              ownerId: feedbackWork.ownerId,
            })
            .from(feedbackWork)
            .where(eq(feedbackWork.productKey, key))
            .orderBy(desc(feedbackWork.createdAt))
            .limit(100)
          return successResponse({ product: publicProduct(p), inbox, work, untrustedContent: true })
        } catch (e) {
          return failure(e)
        }
      },
      POST: async ({ request }) => {
        try {
          const raw = await request.text()
          if (raw.length > 100000)
            throw new ValidationError('BODY_TOO_LARGE', 'Operation body too large')
          const op = operation.parse(JSON.parse(raw))
          // Deployment credential is separate from the developer's agent/API key.
          if (op.action === 'deploy') {
            const id = needed(op.workId, 'workId'),
              w = await readWork(id),
              p = await productFor(w.productKey)
            if (
              !matchesSecret(
                request.headers.get('x-zenith-deployment-key') ?? '',
                p.deploymentSecret,
                'deployment'
              )
            )
              throw new ForbiddenError('DEPLOYMENT_KEY', 'Deployment credential required')
            return successResponse(await recordDeployment(id, deploymentSchema.parse(op.data)))
          }
          const auth = await withApiKeyAuth(request, {
            permission:
              op.action === 'register' || op.action === 'revoke-binding'
                ? PERMISSIONS.BOARD_MANAGE
                : PERMISSIONS.POST_EDIT,
          })
          if (op.action === 'register' || op.action === 'revoke-binding') {
            if (auth.role !== 'admin')
              throw new ForbiddenError(
                'ADMIN_REQUIRED',
                'Product administration requires an administrator'
              )
            if (op.action === 'register')
              return successResponse(await registerProduct(productSchema.parse(op.data)))
            await revokeBinding(z.object({ bindingId: z.string().uuid() }).parse(op.data).bindingId)
            return successResponse({ revoked: true })
          }
          const owner = auth.apiKey.createdById
          if (!owner)
            throw new ForbiddenError('DEVELOPER_REQUIRED', 'A developer-owned API key is required')
          if (op.action === 'claim')
            return successResponse(
              await claimWork(
                needed(op.productKey, 'productKey'),
                parseTypeId<PostId>(needed(op.postId, 'postId'), 'post', 'post ID'),
                op.extraIds.map((id) => parseTypeId<PostId>(id, 'post', 'source ID')),
                owner,
                needed(op.sessionId, 'sessionId')
              )
            )
          const id = needed(op.workId, 'workId')
          if (op.action === 'approve') {
            const w = await readWork(id),
              p = await productFor(w.productKey)
            if (
              !matchesSecret(
                request.headers.get('x-zenith-approval-key') ?? '',
                p.approvalSecret,
                'approval'
              )
            )
              throw new ForbiddenError(
                'APPROVAL_KEY',
                'Separate developer approval credential required'
              )
          }
          return successResponse(
            await mutateWork(
              id,
              needed(op.revision, 'revision'),
              op.action,
              op.data,
              owner,
              op.claimToken ?? '',
              op.sessionId ?? '',
              op.action === 'approve' ? owner : undefined
            )
          )
        } catch (e) {
          return failure(e)
        }
      },
    },
  },
})
