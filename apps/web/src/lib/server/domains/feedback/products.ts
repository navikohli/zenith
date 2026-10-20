import { randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import {
  db,
  feedbackProducts,
  boards,
  segments,
  productUserBindings,
  userSegments,
  eq,
  and,
  sql,
  type Transaction,
} from '@/lib/server/db'
import { encrypt, decrypt } from '@/lib/server/encryption'
import { ConflictError, ForbiddenError, NotFoundError } from '@/lib/shared/errors'
import type { BoardId, PrincipalId } from '@zenith/ids'
import { productAudience } from './contracts'

export const productSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]{1,49}$/),
  name: z.string().min(1).max(100),
  boardId: z.string().optional(),
  repository: z.string().min(1).max(500),
  allowedOrigins: z.array(z.string().url()).min(1).max(10),
  environment: z.string().min(1).max(50),
  appUrl: z.string().url(),
})
export type Product = typeof feedbackProducts.$inferSelect
export const secretPurpose = (kind: string) => `zenith-product-${kind}`
export function publicProduct(p: Product) {
  const { identitySecret: _i, deploymentSecret: _d, approvalSecret: _a, ...safe } = p
  return safe
}
export function matchesSecret(supplied: string, stored: string, kind: string) {
  const a = Buffer.from(supplied),
    b = Buffer.from(decrypt(stored, secretPurpose(kind)))
  return a.length === b.length && timingSafeEqual(a, b)
}
export async function productFor(key: string) {
  const [p] = await db.select().from(feedbackProducts).where(eq(feedbackProducts.key, key))
  if (!p?.active) throw new NotFoundError('PRODUCT_NOT_FOUND', 'Active product not found')
  return p
}
export async function registerProduct(input: z.infer<typeof productSchema>) {
  const origins = [...new Set(input.allowedOrigins.map((o) => new URL(o).origin))]
  if (!origins.includes(new URL(input.appUrl).origin))
    throw new ConflictError('PRODUCT_ORIGIN', 'App URL must belong to an allowed origin')
  const credentials = {
    identitySecret: randomBytes(32).toString('hex'),
    deploymentSecret: randomBytes(32).toString('hex'),
    approvalSecret: randomBytes(32).toString('hex'),
  }
  const product = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'product:' + input.key}))`)
    const [existing] = await tx
      .select()
      .from(feedbackProducts)
      .where(eq(feedbackProducts.key, input.key))
    if (existing)
      throw new ConflictError(
        'PRODUCT_EXISTS',
        'Product already registered; credentials are returned only once'
      )
    const [segment] = await tx
      .insert(segments)
      .values({ name: input.name, slug: `product-${input.key}`, type: 'manual' })
      .returning()
    let boardId = input.boardId as BoardId | undefined
    if (boardId) {
      const [board] = await tx.select().from(boards).where(eq(boards.id, boardId))
      if (!board || board.deletedAt) throw new NotFoundError('BOARD_NOT_FOUND', 'Board not found')
    } else {
      const [board] = await tx
        .insert(boards)
        .values({ name: input.name, slug: input.key })
        .returning()
      boardId = board.id
    }
    // Preserve the board's existing moderation/reply rules under its row lock.
    const [linkedBoard] = await tx
      .select({ access: boards.access, deletedAt: boards.deletedAt })
      .from(boards)
      .where(eq(boards.id, boardId))
      .for('update')
    if (!linkedBoard || linkedBoard.deletedAt)
      throw new NotFoundError('BOARD_NOT_FOUND', 'Board not found')
    // Dedicated audience; staff keeps the native policy bypass.
    await tx
      .update(boards)
      .set({
        access: productAudience(linkedBoard.access, segment.id),
      })
      .where(eq(boards.id, boardId))
    const [created] = await tx
      .insert(feedbackProducts)
      .values({
        key: input.key,
        name: input.name,
        boardId,
        segmentId: segment.id,
        repository: input.repository,
        environment: input.environment,
        appUrl: input.appUrl,
        allowedOrigins: origins,
        identitySecret: encrypt(credentials.identitySecret, secretPurpose('identity')),
        deploymentSecret: encrypt(credentials.deploymentSecret, secretPurpose('deployment')),
        approvalSecret: encrypt(credentials.approvalSecret, secretPurpose('approval')),
      })
      .returning()
    return created
  })
  return { product: publicProduct(product), credentials }
}

/** Never accepts a binding ID supplied by the browser. Lock also serializes revocation. */
export async function bindingForSubmission(
  tx: Transaction,
  boardId: BoardId,
  principalId: PrincipalId,
  staff: boolean
) {
  const [product] = await tx
    .select()
    .from(feedbackProducts)
    .where(eq(feedbackProducts.boardId, boardId))
  if (!product) return null
  if (!product.active)
    throw new ForbiddenError('PRODUCT_INACTIVE', 'Feedback is disabled for this product')
  const [binding] = await tx
    .select()
    .from(productUserBindings)
    .where(
      and(
        eq(productUserBindings.productKey, product.key),
        eq(productUserBindings.principalId, principalId),
        eq(productUserBindings.active, true)
      )
    )
    .for('update')
  if (!binding && !staff)
    throw new ForbiddenError(
      'PRODUCT_IDENTITY_REQUIRED',
      'Identify through this product before submitting feedback'
    )
  return binding?.id ?? null
}
export async function revokeBinding(id: string) {
  await db.transaction(async (tx) => {
    const [binding] = await tx
      .select()
      .from(productUserBindings)
      .where(eq(productUserBindings.id, id))
      .for('update')
    if (!binding) throw new NotFoundError('BINDING_NOT_FOUND', 'Binding not found')
    const p = await productFor(binding.productKey)
    await tx
      .update(productUserBindings)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(productUserBindings.id, id))
    await tx
      .delete(userSegments)
      .where(
        and(
          eq(userSegments.principalId, binding.principalId),
          eq(userSegments.segmentId, p.segmentId),
          eq(userSegments.addedBy, 'widget')
        )
      )
  })
}
