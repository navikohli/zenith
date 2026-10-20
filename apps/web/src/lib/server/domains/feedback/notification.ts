import { sendFeedbackDeploymentEmail } from '@zenith/email'
import { withEmailIdempotencyKey } from '@zenith/email/idempotency'
import { db, productUserBindings, feedbackWork, jobQueue, eq, and } from '@/lib/server/db'
import { getBaseUrl } from '@/lib/server/config'
import type { ClaimedJob } from '@/lib/server/jobs/job-queue'
import {
  getNotificationPreferences,
  getSubscriptionStatus,
  generateUnsubscribeToken,
} from '@/lib/server/domains/subscriptions/subscription.service'
import { shouldNotify } from '@/lib/server/domains/subscriptions/notification-matrix'
import { productFor } from './products'
import { isBlocked } from '@/lib/server/domains/principals/blocking'

export async function sendDeploymentNotification(job: ClaimedJob) {
  const data = job.payload as { workId: string; bindingId: string; receiptHash: string }
  const finish = async (status: string, reason?: string) => {
    await db
      .update(jobQueue)
      .set({ payload: { ...data, delivery: { status, reason, at: new Date().toISOString() } } })
      .where(and(eq(jobQueue.jobId, job.jobId), eq(jobQueue.leaseToken, job.leaseToken)))
  }
  const [w] = await db.select().from(feedbackWork).where(eq(feedbackWork.id, data.workId))
  const [binding] = await db
    .select()
    .from(productUserBindings)
    .where(eq(productUserBindings.id, data.bindingId))
  if (
    !w ||
    w.phase !== 'deployed' ||
    w.state.receiptHash !== data.receiptHash ||
    !binding?.active ||
    binding.productKey !== w.productKey ||
    (await isBlocked(binding.principalId))
  )
    return finish('skipped', 'ineligible identity or receipt')
  const prefs = await getNotificationPreferences(binding.principalId),
    subscription = await getSubscriptionStatus(binding.principalId, w.canonicalPostId)
  if (!subscription.notifyStatusChanges || !shouldNotify(prefs, 'post_status_changed', 'email'))
    return finish('skipped', 'unsubscribed or muted')
  const p = await productFor(w.productKey)
  const token = await generateUnsubscribeToken(
    binding.principalId,
    w.canonicalPostId,
    'unsubscribe_post'
  )
  const receipt = w.state.receipt as { sha: string; environment: string }
  const result = await withEmailIdempotencyKey(`feedback-deployment:${w.id}:${binding.id}`, () =>
    sendFeedbackDeploymentEmail({
      to: binding.email,
      productName: p.name,
      appUrl: p.appUrl,
      environment: receipt.environment,
      sha: receipt.sha,
      unsubscribeUrl: `${getBaseUrl()}/unsubscribe?token=${token}`,
    })
  )
  await finish(
    result.sent ? 'sent' : result.reason === 'no_provider' ? 'preview' : 'skipped',
    result.reason
  )
}
