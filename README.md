# ledgerpro-realtime

Standalone NestJS service that owns **all** WebSocket connections for LedgerPro:

- **Notifications** — per-user realtime delivery (joins `user:<id>` rooms; fixes the
  old in-backend gateway that never joined rooms so targeted notifications were dropped).
- **System-alert live-refresh** — domain-event broadcasts (`customer-order:created`,
  `group-cart:changed`, …) so the frontend invalidates/refetches the instant data changes.
- **Chat** (later phases) — staff internal, customer↔staff support, group chat.

It is a **stateless delivery layer**: the main backend still owns the `notifications`
table and REST. The backend `PUBLISH`es events to Redis; this service `SUBSCRIBE`s and
fans them out to the right socket.io rooms. `@socket.io/redis-adapter` lets it run on
multiple replicas. Tokens are verified against the backend's RS256 **JWKS** endpoint —
no shared secret.

```
backend  ──PUBLISH──▶  Redis  ──SUBSCRIBE──▶  realtime  ──emit──▶  browser (socket.io-client)
   │ exposes /.well-known/jwks.json  ◀── verify handshake JWT (RS256) ──┘
```

## Run (local dev)

```bash
pnpm install
# Needs Redis on :6379 and the backend's JWKS on :3000 (run the RS256 branch).
docker compose up redis -d        # or use the full `docker compose up`
pnpm run start:dev
```

Connect a client:

```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:3001/notifications', { auth: { token: ACCESS_TOKEN } });
socket.on('notification', console.log);
```

## Environment

See [`.env.example`](./.env.example). Key vars: `PORT`, `REDIS_URL`, `JWKS_URI`,
`JWT_ISSUER`, `JWT_AUDIENCE`, `CORS_ORIGIN`, `REALTIME_REDIS_CHANNEL`.

## Conventions

Mirrors the LedgerPro backend (NestJS 11, pnpm + `save-exact`, `tsconfig-paths`,
3-stage Alpine Docker, repository → service → controller). **Deliberate deviation:**
this repo uses standard CommonJS module resolution (not the backend's `NodeNext`) so the
CJS auth stack (`jsonwebtoken` + `jwks-rsa`) stays friction-free.

Full design + phases: `~/.claude/plans/glimmering-sauteeing-crescent.md`.
