// @vitest-environment happy-dom
/**
 * GH #464 follow-up: a first-visit upload/reaction/comment mints the anonymous
 * session mid-action, which bumps sessionVersion and re-keys the post-detail
 * query. The detail view must keep the current post (and so the comment
 * editors and reaction chips) mounted while the Bearer refetch runs; a
 * skeleton here would unmount the editor the in-flight upload inserts into.
 * Switching to a different post still shows the skeleton.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlProvider } from 'react-intl'

const auth = { sessionVersion: 0, hmacRequired: false, isIdentified: false }
vi.mock('../widget-auth-provider', () => ({
  useWidgetAuth: () => ({
    isIdentified: auth.isIdentified,
    hmacRequired: auth.hmacRequired,
    user: null,
    ensureSessionThen: async (cb: () => void | Promise<void>) => cb(),
    emitEvent: vi.fn(),
    sessionVersion: auth.sessionVersion,
  }),
}))
vi.mock('@/lib/client/widget-auth', () => ({
  getWidgetAuthHeaders: () => ({}),
  generateOneTimeToken: async () => null,
}))
vi.mock('@/lib/client/widget-bridge', () => ({ sendToHost: vi.fn() }))
vi.mock('../use-widget-image-upload', () => ({
  useWidgetImageUpload: () => ({ upload: vi.fn() }),
  useWidgetMediaUpload: () => ({ upload: vi.fn() }),
}))
vi.mock('../widget-vote-button', () => ({
  WidgetVoteButton: ({ postId }: { postId: string }) => (
    <span data-testid="vote-post-id">{postId}</span>
  ),
}))
vi.mock('../widget-comment-list', () => ({ WidgetCommentList: () => null }))
vi.mock('../widget-comment-form', () => ({
  WidgetCommentForm: ({
    onSubmit,
  }: {
    onSubmit: (content: string, json: null) => Promise<void>
  }) => (
    <button data-testid="comment-form" onClick={() => void onSubmit('Thanks for the update', null)}>
      Post
    </button>
  ),
}))
vi.mock('../widget-skeletons', () => ({
  WidgetPostDetailSkeleton: () => <div data-testid="skeleton" />,
}))
vi.mock('@/components/public/post-content', () => ({ PostContent: () => null }))
vi.mock('@/lib/client/mutations/load-more-comments', () => ({
  useLoadMoreWidgetComments: () => ({ loadMore: vi.fn(), isLoading: false, hasMore: false }),
}))

type Deferred = { resolve: (v: unknown) => void }
const pending: Deferred[] = []
const fetchPublicPostDetail = vi.fn(() => new Promise((resolve) => pending.push({ resolve })))
vi.mock('@/lib/server/functions/widget/posts', () => ({
  widgetFetchPublicPostDetailFn: (...args: unknown[]) => fetchPublicPostDetail(...(args as [])),
}))
vi.mock('@/lib/server/functions/widget/comments', () => ({ widgetCreateCommentFn: vi.fn() }))

import { WidgetPostDetail } from '../widget-post-detail'
import { widgetCreateCommentFn } from '@/lib/server/functions/widget/comments'

const detail = (id: string, title: string) => ({
  id,
  title,
  content: '',
  contentJson: null,
  authorName: 'Ada',
  createdAt: '2026-07-30T10:00:00Z',
  voteCount: 1,
  statusId: null,
  board: { slug: 'ideas', name: 'Ideas' },
  comments: [],
  pinnedComment: null,
  pinnedCommentId: null,
  isCommentsLocked: false,
  canVote: true,
  canComment: true,
})

let queryClient: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={{}}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  )
}

describe('WidgetPostDetail — session re-key keeps the view mounted', () => {
  beforeEach(() => {
    auth.sessionVersion = 0
    auth.hmacRequired = false
    auth.isIdentified = false
    pending.length = 0
    fetchPublicPostDetail.mockClear()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  })

  it('keeps the current post and comment form while the Bearer refetch is in flight', async () => {
    const { rerender } = render(<WidgetPostDetail postId="post_1" statuses={[]} />, { wrapper })
    expect(screen.getByTestId('skeleton')).toBeTruthy()
    await act(async () => pending[0].resolve(detail('post_1', 'First title')))
    await screen.findByText('First title')
    expect(screen.getByTestId('comment-form')).toBeTruthy()

    // A mid-action mint bumps sessionVersion → new query key, no cached data.
    auth.sessionVersion = 1
    rerender(<WidgetPostDetail postId="post_1" statuses={[]} />)
    await waitFor(() => expect(fetchPublicPostDetail).toHaveBeenCalledTimes(2))

    expect(screen.queryByTestId('skeleton')).toBeNull()
    expect(screen.getByText('First title')).toBeTruthy()
    expect(screen.getByTestId('comment-form')).toBeTruthy()

    await act(async () => pending[1].resolve(detail('post_1', 'Refetched title')))
    await screen.findByText('Refetched title')
  })

  it('still shows the skeleton when navigating to a different post', async () => {
    const { rerender } = render(<WidgetPostDetail postId="post_1" statuses={[]} />, { wrapper })
    await act(async () => pending[0].resolve(detail('post_1', 'First title')))
    await screen.findByText('First title')

    rerender(<WidgetPostDetail postId="post_2" statuses={[]} />)
    await waitFor(() => expect(fetchPublicPostDetail).toHaveBeenCalledTimes(2))

    expect(screen.getByTestId('skeleton')).toBeTruthy()
    expect(screen.queryByText('First title')).toBeNull()
  })

  it('uses the resolved canonical thread for votes and new comments from an old link', async () => {
    vi.mocked(widgetCreateCommentFn).mockResolvedValue({ comment: { id: 'comment_test' } } as never)
    render(<WidgetPostDetail postId="post_old" statuses={[]} />, { wrapper })
    await act(async () => pending[0].resolve(detail('post_canonical', 'Canonical title')))
    await screen.findByText('Canonical title')
    expect(screen.getByTestId('vote-post-id').textContent).toBe('post_canonical')
    fireEvent.click(screen.getByTestId('comment-form'))
    await waitFor(() =>
      expect(widgetCreateCommentFn).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ postId: 'post_canonical' }) })
      )
    )
  })

  it('lets an identified reporter comment when signed identity is required', async () => {
    auth.hmacRequired = true
    auth.isIdentified = true
    render(<WidgetPostDetail postId="post_1" statuses={[]} />, { wrapper })
    await act(async () => pending[0].resolve(detail('post_1', 'Signed-in thread')))
    await screen.findByText('Signed-in thread')
    expect(screen.getByTestId('comment-form')).toBeTruthy()
  })

  it('keeps the comment composer hidden until required identity is established', async () => {
    auth.hmacRequired = true
    render(<WidgetPostDetail postId="post_1" statuses={[]} />, { wrapper })
    await act(async () => pending[0].resolve(detail('post_1', 'Identity required')))
    await screen.findByText('Identity required')
    expect(screen.queryByTestId('comment-form')).toBeNull()
  })
})
