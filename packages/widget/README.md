# @zenith/widget

The official SDK for embedding the [Zenith](/source.html) feedback widget in your app. Ships with TypeScript types and a React adapter.

## Install

```bash
npm install @zenith/widget
# or:  pnpm add @zenith/widget
# or:  bun add @zenith/widget
```

## Vanilla JS

```js
import { Zenith } from '@zenith/widget'

Zenith.init({ instanceUrl: 'https://feedback.yourcompany.com' })

// When you know who the user is:
Zenith.identify({ id: 'u_123', email: 'ada@example.com', name: 'Ada' })

// Deep-link to a specific view:
Zenith.open({ view: 'new-post', title: 'Bug:', board: 'bugs' })
```

## React

```tsx
import { useZenithInit, useZenith, useZenithEvent } from '@zenith/widget/react'

function App() {
  const { user } = useAuth()

  useZenithInit({
    instanceUrl: 'https://feedback.yourcompany.com',
    identity: user ? { id: user.id, email: user.email, name: user.name } : undefined,
  })

  useZenithEvent('post:created', (post) => {
    analytics.track('feedback_submitted', { postId: post.id })
  })

  return <Layout />
}

function FeedbackButton() {
  const qb = useZenith()
  return <button onClick={() => qb.open({ view: 'new-post' })}>Feedback</button>
}
```

No provider needed — Zenith is a singleton and the hooks wrap its lifecycle.

## Other frameworks

Vue, Svelte, Angular, Solid: import `Zenith` from the main entry and call it directly. Framework adapters ship on request.

## Prefer a script tag?

Drop this in your `<head>` and skip the install step entirely:

```html
<script src="https://feedback.yourcompany.com/api/widget/sdk.js" defer></script>
```

## API

### Methods

| Method                                        | Description                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `Zenith.init(options)`                     | Create launcher + iframe. `options.instanceUrl` required.                  |
| `Zenith.identify(identity?)`               | Attribute activity to a user. Omit for anonymous.                          |
| `Zenith.logout()`                          | Clear identity; widget stays visible in anonymous mode.                    |
| `Zenith.open(options?)`                    | Open the panel; optional deep-link payload (see below).                    |
| `Zenith.close()`                           | Close the panel.                                                           |
| `Zenith.showLauncher()` / `hideLauncher()` | Toggle the floating button.                                                |
| `Zenith.metadata(patch)`                   | Attach session context to submitted feedback. Pass `null` to remove a key. |
| `Zenith.on(event, handler)`                | Subscribe to a widget event. Returns an unsubscribe function.              |
| `Zenith.off(event, handler?)`              | Remove a specific handler, or all listeners for the event.                 |
| `Zenith.destroy()`                         | Tear down all widget state and DOM.                                        |
| `Zenith.isOpen()`                          | Whether the panel is currently visible.                                    |
| `Zenith.getUser()`                         | The current identified user, or `null`.                                    |
| `Zenith.isIdentified()`                    | `true` when a user is identified (non-anonymous).                          |

### `init` options

```ts
Zenith.init({
  instanceUrl: 'https://feedback.yourcompany.com', // required
  placement: 'right' | 'left', // default 'right'
  defaultBoard: 'bugs', // filter widget to one board
  launcher: true, // false = hide default button
  locale:
    'en' |
    'fr' |
    'de' |
    'es' |
    'ar' |
    'ru' |
    'pt-BR' |
    'zh-CN' |
    'zh-TW' |
    'nl' |
    'pl' |
    'th' |
    'uk', // override auto-detect
  identity: { id, email, name } | { ssoToken }, // bundle identify into init
})
```

Theme colors and tab visibility come from your Zenith admin (Admin → Settings → Widget).

### `identify` shapes

```ts
Zenith.identify() // anonymous
Zenith.identify({ id: 'u_123', email: 'ada@x.com', name: 'Ada' }) // unverified
Zenith.identify({ ssoToken: 'eyJ...' }) // verified
```

See the [Identify users guide](/source.html) for JWT claims and server examples.

### `open` deep-links

```ts
Zenith.open() // home
Zenith.open({ view: 'new-post', title: 'Bug:', body: '...', board: 'bugs' }) // pre-filled form
Zenith.open({ view: 'changelog' }) // changelog feed
Zenith.open({ view: 'help', query: 'pricing' }) // help search
Zenith.open({ postId: 'post_01h...' }) // specific post
Zenith.open({ articleId: 'article_01h...' }) // help article TypeID or slug
```

`postId` and `articleId` win over `view` if both are set. `board` on `open` only applies to `view: 'new-post'`. Home / Popular Ideas filtering uses `init({ defaultBoard })` or the iframe `?board=` param.

Every `open` field is live. A disabled surface or an unseen board fails closed — the panel still opens, but the widget does not invent access.

### Events

```ts
const unsubscribe = Zenith.on('vote', (payload) => {
  console.log('Voted on', payload.postId)
})
unsubscribe()
```

| Event             | Payload                                    |
| ----------------- | ------------------------------------------ |
| `ready`           | `{}`                                       |
| `open`            | `{ view?, postId?, articleId?, entryId? }` |
| `close`           | `{}`                                       |
| `post:created`    | `{ id, title, board, statusId }`           |
| `vote`            | `{ postId, voted, voteCount }`             |
| `comment:created` | `{ postId, commentId, parentId }`          |
| `identify`        | `{ success, user, anonymous, error? }`     |
| `email-submitted` | `{ email }`                                |

## Docs

Full documentation: /source.html

## License

AGPL-3.0
