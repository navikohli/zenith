import { generateId } from '@zenith/ids'
import {
  db,
  feedbackProducts,
  productUserBindings,
  user,
  principal,
  session,
  widgetIdentifiedSession,
  userSegments,
  eq,
  and,
  sql,
} from '@/lib/server/db'
import { ensurePrincipalForUser } from '@/lib/server/domains/principals/principal.factory'
import { verifyHS256JWT } from '@/lib/server/widget/identity-token'
import { decrypt } from '@/lib/server/encryption'
import { getBaseUrl } from '@/lib/server/config'
import { getAllUserVotedPostIds } from '@/lib/server/domains/posts/post.public'
import { isBlocked } from '@/lib/server/domains/principals/blocking'
import { ForbiddenError } from '@/lib/shared/errors'
import { secretPurpose } from './products'
import { validateProductClaims } from './contracts'

/** Null means a legacy installation with no registered products. */
export async function identifyProduct(
  request: Request,
  body: { ssoToken: string; parentOrigin?: string }
) {
  const products = await db.select().from(feedbackProducts)
  if (products.length === 0) return null
  let kid = ''
  try {
    kid = JSON.parse(Buffer.from(body.ssoToken.split('.')[0], 'base64url').toString()).kid
  } catch {
    /* rejected below */
  }
  const p = products.find((p) => p.key === kid && p.active)
  if (!p)
    throw new ForbiddenError(
      'PRODUCT_IDENTITY_REQUIRED',
      'Use the registered product identity secret'
    )
  const payload = verifyHS256JWT(
    body.ssoToken,
    decrypt(p.identitySecret, secretPurpose('identity'))
  )
  const c = validateProductClaims(
    payload,
    p.key,
    getBaseUrl().replace(/\/$/, ''),
    body.parentOrigin ?? '',
    p.allowedOrigins
  )
  const resolved = await db.transaction(async (tx) => {
    // Serializes first sighting and shared verified-email identity linking across products.
    await tx.execute(sql`select pg_advisory_xact_lock(987301)`)
    let [binding] = await tx
      .select()
      .from(productUserBindings)
      .where(
        and(eq(productUserBindings.productKey, p.key), eq(productUserBindings.appUserId, c.sub))
      )
    if (binding && !binding.active)
      throw new ForbiddenError('BINDING_REVOKED', 'Product access was revoked')
    let person = binding
      ? await tx.query.principal.findFirst({ where: eq(principal.id, binding.principalId) })
      : undefined
    let account = person?.userId
      ? await tx.query.user.findFirst({ where: eq(user.id, person.userId) })
      : undefined
    if (binding && (!person || !account))
      throw new ForbiddenError('IDENTITY_REMOVED', 'Bound identity is unavailable')
    if (!binding) {
      account = await tx.query.user.findFirst({
        where: sql`lower(${user.email}) = ${c.email.toLowerCase()}`,
      })
      if (account) {
        person = await tx.query.principal.findFirst({ where: eq(principal.userId, account.id) })
        if (!account.emailVerified || !person || person.role !== 'user')
          throw new ForbiddenError(
            'EMAIL_CONFLICT',
            'Verified email belongs to an unavailable or staff identity'
          )
      } else {
        ;[account] = await tx
          .insert(user)
          .values({
            id: generateId('user'),
            name: c.name,
            email: c.email.toLowerCase(),
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning()
        person = (
          await ensurePrincipalForUser(
            { userId: account.id, role: 'user', displayName: c.name },
            tx
          )
        ).principal
      }
      ;[binding] = await tx
        .insert(productUserBindings)
        .values({
          productKey: p.key,
          appUserId: c.sub,
          principalId: person!.id,
          email: c.email.toLowerCase(),
          displayName: c.name,
        })
        .returning()
    } else {
      // Product profile changes don't overwrite another product's global person profile.
      await tx
        .update(productUserBindings)
        .set({ email: c.email.toLowerCase(), displayName: c.name, updatedAt: new Date() })
        .where(eq(productUserBindings.id, binding.id))
    }
    if (person!.role !== 'user')
      throw new ForbiddenError('STAFF_IDENTITY', 'App identities cannot mint staff sessions')
    await tx
      .insert(userSegments)
      .values({ principalId: person!.id, segmentId: p.segmentId, addedBy: 'widget' })
      .onConflictDoNothing()
    return { person: person!, account: account!, binding }
  })
  if (await isBlocked(resolved.person.id))
    throw new ForbiddenError('BLOCKED', 'This account is blocked')
  const now = new Date(),
    id = crypto.randomUUID(),
    token = crypto.randomUUID()
  await db.transaction(async (tx) => {
    await tx.insert(session).values({
      id,
      token,
      userId: resolved.account.id,
      scope: 'widget',
      expiresAt: new Date(now.getTime() + 7 * 86400000),
      createdAt: now,
      updatedAt: now,
      userAgent: request.headers.get('user-agent'),
    })
    await tx.insert(widgetIdentifiedSession).values({ sessionId: id, hmacVerified: true })
  })
  return Response.json({
    sessionToken: token,
    user: { id: resolved.account.id, name: c.name, email: c.email, avatarUrl: null },
    votedPostIds: [...(await getAllUserVotedPostIds(resolved.person.id))],
    canPortalHandoff: true,
    product: p.key,
  })
}
