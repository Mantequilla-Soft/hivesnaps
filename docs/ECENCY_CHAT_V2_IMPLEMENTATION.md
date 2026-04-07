# Ecency Chat v2 - Implementation Plan

## Background

HiveSnaps had a chat feature on `feat/ecency-chat` (last commit Dec 2025) that integrated with Ecency's Mattermost-backed chat. The original implementation used **HTTP polling** at 5s/30s/60s intervals depending on app state, which was a battery drain. That branch diverged from the very first commit and is 652+ commits behind main.

Ecency has since documented a proper **WebSocket proxy** at `/api/mattermost/websocket`, making real-time chat viable without polling.

## Strategy: Port, Don't Rebase

The old branch is too far behind to rebase. However, all 6 chat-specific files are **net-new** (don't exist on main), so we cherry-pick the final state onto a new branch and upgrade from there.

### Files from old branch

| File | Purpose |
|---|---|
| `services/ecencyChatService.ts` | Singleton service: auth, REST calls, session management |
| `hooks/useEcencyChat.ts` | Business logic hook: state, polling, actions |
| `context/ChatContext.tsx` | Global provider: modal state, unread counts |
| `app/components/chat/ChatScreen.tsx` | Full-screen modal UI (community + DMs) |
| `app/components/chat/index.ts` | Component exports |
| `styles/ChatStyles.ts` | Centralized theme-aware styles |

### Integration points that need updating after port

- `app/_layout.tsx` — wrap with `ChatProvider`
- `app/screens/FeedScreen.tsx` (or equivalent header) — chat icon with unread badge
- `app/config/env.ts` — `ECENCY_API_BASE_URL` env var
- `package.json` — verify dependencies (`@hiveio/dhive` should already be present)

---

## Ecency Chat API Reference (from docs.ecency.com/developers/chats)

### Base URL

```
https://ecency.com/api/mattermost
```

### Authentication Flow

1. Build a Hivesigner-style access token locally:
   - Payload: `{ signed_message: { type: "code", app: hsClientId }, authors: [username], timestamp }`
   - SHA256 hash the JSON, sign with posting private key via `@hiveio/dhive`
   - Base64url-encode the signed payload
2. Bootstrap: `POST /bootstrap` with `{ username, accessToken, refreshToken, displayName?, community?, communityTitle? }`
3. Response: `{ ok: true, userId, channelId?, token }` + `mm_pat` httpOnly cookie
4. For React Native (no httpOnly cookies): use `token` from response with `Authorization: Bearer <token>` header or `?token=<mm_pat>` query param

### REST Endpoints

**Channels:**
- `GET /channels` — list user's channels (with unreads, favorites, DM partner metadata)
- `POST /channels/[id]/join` — join channel
- `POST /channels/[id]/leave` — leave channel
- `POST /channels/[id]/favorite` — `{ favorite: boolean }`
- `POST /channels/[id]/mute` — `{ mute: boolean }`
- `POST /channels/[id]/view` — mark as viewed (reset unreads)
- `GET /channels/unreads` — aggregate unread/mention counts
- `POST /channels/search` — `{ term }` search channels

**Messages:**
- `GET /channels/[id]/posts` — fetch posts + user map + member info
- `POST /channels/[id]/posts` — `{ message, rootId? }` send message/reply
- `PATCH /channels/[id]/posts/[postId]` — `{ message }` edit
- `DELETE /channels/[id]/posts/[postId]` — delete
- `POST /channels/[id]/posts/[postId]/reactions` — `{ emoji, add }` toggle reaction
- `POST /search/posts` — `{ term }` search messages

**DMs & Users:**
- `POST /direct` — `{ username }` open/create DM channel
- `GET /users/search?q=` — search users
- `GET /users/[userId]/image` — profile image proxy (no auth needed)

### WebSocket

**Endpoint:** `wss://ecency.com/api/mattermost/websocket?token=<mm_pat>`

**Key events:**

| Event | Description | Payload |
|---|---|---|
| `hello` | Auth confirmed | server info, session id |
| `posted` | New message | `data.post` (JSON string), `sender_name`, `channel_id` |
| `post_edited` | Message edited | updated post object |
| `post_deleted` | Message deleted | `post.id`, `channel_id` |
| `reaction_added` | Reaction toggled on | `user_id`, `emoji_name`, `post_id` |
| `reaction_removed` | Reaction toggled off | same fields |
| `typing` | User is typing | `user_id`, `channel_id`, `parent_id` |
| `user_updated` | Profile/status change | user object |

**Note:** `data.post` in `posted` events is a **JSON string** — must be parsed before use.

---

## Implementation Phases

### Phase 1: Port Chat Files to Main

1. Create `feat/ecency-chat-v2` branch from current `main`
2. Copy the 6 chat files from old branch (use `git show feat/ecency-chat:<path>`)
3. Fix imports/integration with current codebase:
   - Wrap app layout with `ChatProvider`
   - Add chat icon to header/feed screen
   - Verify env config
4. Smoke test: bootstrap auth, load channels, send a message via polling (existing logic)

**Goal:** Working chat on current main, still using polling.

### Phase 2: Replace Polling with WebSocket

This is the core improvement. Replace the 3-tier polling system with a persistent WebSocket connection.

#### 2a. WebSocket Manager (in `ecencyChatService.ts`)

```typescript
class WebSocketManager {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000; // 30s cap

  connect(token: string): void {
    this.socket = new WebSocket(
      `wss://ecency.com/api/mattermost/websocket?token=${token}`
    );
    // handle open, message, close, error
    // on 'hello' event: confirm connected, reset reconnect counter
    // on close: exponential backoff reconnect
  }

  on(event: string, callback: Function): () => void { /* subscribe, return unsub */ }
  disconnect(): void { /* clean close */ }
}
```

#### 2b. Update `useEcencyChat.ts`

- Remove `POLLING_INTERVAL_ACTIVE`, `POLLING_INTERVAL_BACKGROUND`, `POLLING_INTERVAL_INACTIVE` constants
- Remove `setInterval` polling logic
- Subscribe to WebSocket events:
  - `posted` → append to messages array (if matching current channel)
  - `post_edited` → update message in state
  - `post_deleted` → remove message from state
  - `reaction_added` / `reaction_removed` → update reaction metadata
  - `typing` → set typing indicator state
- Keep a **light fallback poll** (60s) for unread count sync only, as safety net
- On app foreground (AppState change): reconnect WebSocket if disconnected, do one full refresh

#### 2c. Update `ChatContext.tsx`

- Connect WebSocket after successful `initialize()`
- Disconnect on logout / cleanup
- Reconnect on AppState `active` if socket is closed
- Expose `isConnected` state for UI indicator (optional)

### Phase 3: Auth Improvements

The old code manually injected `Cookie: mm_pat=...` headers, which is a hack for React Native. The docs now clearly support token-based auth:

1. Store the `token` from bootstrap response (already stored as `ecency_mm_pat` in SecureStore)
2. Use `Authorization: Bearer <token>` for all REST calls instead of Cookie header
3. Use `?token=<mm_pat>` query param for WebSocket connection
4. Remove the `Cookie:` header injection from `makeRequest()`

### Phase 4: UI Polish

1. **Typing indicators** — show "user is typing..." from `typing` events
2. **Real-time updates** — messages appear instantly via WebSocket (no refresh needed)
3. **Edit/delete animations** — messages update/fade out in real time
4. **Connection status** — subtle indicator when WebSocket is reconnecting
5. **Community auto-join** — pass `community: "hive-178315"` (Snapie) in bootstrap call
6. **Thread/navigation compatibility** — verify chat modal works with current app navigation structure
7. **Review ChatStyles.ts** — ensure theme tokens match current app theme system

---

## What the Old Code Already Does Well

These parts of the existing implementation align with the docs and should be kept as-is:

- `buildAccessToken()` — matches the Hivesigner-style signing pattern from docs
- REST endpoint paths — all match the documented routes
- Session caching in SecureStore — correct approach for React Native
- Channel types (`O` for community, `D` for DM) — matches Mattermost conventions
- Emoji reaction mapping — works with Mattermost emoji names
- DM creation and user search — matches `/direct` and `/users/search` endpoints
- Dark/light mode theming — comprehensive and well-structured
- Inverted FlatList for message rendering — standard pattern

## What Needs to Change

| Old Behavior | New Behavior | Why |
|---|---|---|
| HTTP polling every 5-60s | WebSocket + 60s fallback poll | Battery life, real-time UX |
| `Cookie: mm_pat=...` header | `Authorization: Bearer <token>` | Docs support this for non-browser clients |
| No typing indicators | Show typing from WS events | Better UX, now possible |
| Messages only update on poll | Instant via `posted` event | Core improvement |
| Full refresh on app foreground | WS reconnect + delta sync | More efficient |

---

## Dependencies

Already in project (verify versions):
- `@hiveio/dhive` — for token signing
- `expo-secure-store` — for session persistence

No new dependencies needed — React Native has built-in `WebSocket` support.

## Testing Plan

1. **Auth:** Bootstrap with posting key, verify token returned, verify REST calls work with Bearer auth
2. **WebSocket:** Connect, verify `hello` event received, send message in Ecency web and verify `posted` event arrives
3. **Reconnection:** Kill network, verify reconnect with backoff, verify messages sync after reconnect
4. **Battery:** Compare battery usage over 30 min idle with old polling vs WebSocket
5. **Edge cases:** Expired token (should get 401, re-bootstrap), Mattermost down (502 handling), app backgrounded for extended period
