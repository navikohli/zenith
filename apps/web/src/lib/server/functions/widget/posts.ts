/**
 * Widget BFF for posts. Keep this file free of static imports from server
 * modules — the client graph loads these createServerFn exports.
 */
import { createServerFn } from '@tanstack/react-start'
import {
  listPublicPostsSchema,
  createPublicPostSchema,
  toggleVoteSchema,
  fetchPublicPostDetailSchema,
} from '@/lib/shared/schemas/posts'

export const widgetListPublicPostsFn = createServerFn({ method: 'GET' })
  .validator(listPublicPostsSchema)
  .handler(async ({ data }) => {
    const { getOptionalWidgetAuth } = await import('../widget-auth')
    const { runListPublicPosts } = await import('../public-posts')
    return runListPublicPosts(await getOptionalWidgetAuth(), data)
  })

export const widgetCreatePublicPostFn = createServerFn({ method: 'POST' })
  .validator(createPublicPostSchema)
  .handler(async ({ data }) => {
    const { requireWidgetAuth } = await import('../widget-auth')
    const { runCreatePublicPost } = await import('../public-posts')
    return runCreatePublicPost(await requireWidgetAuth(), data)
  })

export const widgetToggleVoteFn = createServerFn({ method: 'POST' })
  .validator(toggleVoteSchema)
  .handler(async ({ data }): Promise<{ voted: boolean; voteCount: number }> => {
    const { requireWidgetAuth } = await import('../widget-auth')
    const { runToggleVote } = await import('../public-posts')
    return runToggleVote(await requireWidgetAuth(), data)
  })

export const widgetGetVotedPostsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ votedPostIds: string[] }> => {
    const { getOptionalWidgetAuth } = await import('../widget-auth')
    const { runGetVotedPosts } = await import('../public-posts')
    return runGetVotedPosts(await getOptionalWidgetAuth())
  }
)

export const widgetFetchPublicPostDetailFn = createServerFn({ method: 'GET' })
  .validator(fetchPublicPostDetailSchema)
  .handler(async ({ data }) => {
    const { getOptionalWidgetAuth } = await import('../widget-auth')
    const { runFetchPublicPostDetail } = await import('../portal')
    const auth = await getOptionalWidgetAuth()
    const detail = await runFetchPublicPostDetail(auth, data)
    // Merge info is audience-checked by the native service. Resolve the old
    // widget link to the live thread so comments/votes use its canonical ID.
    if (detail?.mergeInfo?.canonicalPostId) {
      return runFetchPublicPostDetail(auth, { ...data, postId: detail.mergeInfo.canonicalPostId })
    }
    return detail
  })

export const widgetFetchBoardCapabilitiesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { getOptionalWidgetAuth } = await import('../widget-auth')
    const { runFetchBoardCapabilities } = await import('../portal')
    return runFetchBoardCapabilities(await getOptionalWidgetAuth())
  }
)
