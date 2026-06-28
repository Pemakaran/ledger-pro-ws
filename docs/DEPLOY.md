# Deploying ledgerpro-realtime to the DigitalOcean droplet

The realtime service runs **next to** the main backend on the same droplet,
behind the same nginx. It is a stateless delivery layer: the backend `PUBLISH`es
notification/system-event envelopes to a shared **redis**, and realtime fans
them out to authenticated socket.io rooms. Handshake JWTs are verified against
the backend's **RS256 JWKS** over the internal Docker network — no shared secret.

```
 Browser ──wss──▶ nginx (realtime.ledgerpro.shop, TLS, WS upgrade)
                      └─▶ 127.0.0.1:3001  ledgerpro-realtime ──┐
                                                               │ SUBSCRIBE ledgerpro:realtime
   backend ──PUBLISH──▶ redis:6379 ◀──────────────────────────┘
   realtime ──GET http://backend:3000/.well-known/jwks.json (verify token)
        (all three share the EXTERNAL `ledgerpro-network`)
```

## Prerequisites (hard gates)

1. **RS256/JWKS auth must be live in prod** (the `feat/auth-rs256-jwks-refresh`
   cutover). Realtime can only verify tokens once the backend serves real keys at
   `/.well-known/jwks.json`. This is a one-time re-login for all users.
2. DNS A-record `realtime.ledgerpro.shop` → droplet IP.
3. Repo secrets on the realtime GitHub repo: `SERVER_HOST`, `SERVER_USER`,
   `SSH_PRIVATE_KEY`, `GHCR_PAT` (read:packages).

## One-time droplet setup

```bash
# 1. Shared network (idempotent; the deploy job also runs this).
docker network create ledgerpro-network

# 2. Realtime stack dir + env.
mkdir -p ~/ledgerpro-realtime && cd ~/ledgerpro-realtime
#   copy docker-compose.prod.yml here, then:
cp /path/to/.env.production.example .env && chmod 600 .env   # edit values

# 3. nginx vhost + TLS.
sudo cp deploy/nginx-realtime.conf /etc/nginx/sites-available/realtime.ledgerpro.shop
sudo ln -s /etc/nginx/sites-available/realtime.ledgerpro.shop /etc/nginx/sites-enabled/
sudo certbot --nginx -d realtime.ledgerpro.shop
sudo nginx -t && sudo systemctl reload nginx
```

The **backend stack** owns redis. Apply the backend-repo changes (already on
`feat/realtime-extraction`): `redis` service + `REDIS_URL=redis://redis:6379` in
its `.env`, and `ledgerpro-network` is now `external: true` — so the network
above must exist before the backend `compose up` too (its deploy job creates it
idempotently as well).

## Rollout order (zero-downtime)

The backend **dual-emits** (in-process gateway *and* redis) until cutover, so
notifications never drop mid-rollout. Sequence:

1. **Backend:** deploy the branch carrying redis + the `RealtimePublisher` (it
   starts publishing to redis; the old gateway still serves today's clients).
2. **Realtime:** push to the realtime repo's `main` → CI builds the image and
   deploys it. Verify (below). Now both delivery paths are live.
3. **Frontend:** repoint `VITE_SOCKET_URL` → `https://realtime.ledgerpro.shop`
   (GitHub secret in the backend repo's deploy workflow) and redeploy the
   frontend. Clients now connect to realtime; targeted per-user notifications
   work for the first time (the old in-process gateway never joined rooms).
4. **Cutover (separate PR):** once prod parity is confirmed, delete the backend
   in-process `notifications.gateway.ts` (Phase 2 cutover / task #8). Persistence
   + REST (`GET /notifications`, mark-read) stay in the backend, untouched.

## Verify

```bash
# Health (through nginx).
curl https://realtime.ledgerpro.shop/health            # 200

# Containers + shared network.
docker compose -f docker-compose.prod.yml ps           # realtime: healthy
docker network inspect ledgerpro-network -f '{{range .Containers}}{{.Name}} {{end}}'
#   → ledgerpro-backend ledgerpro-redis ledgerpro-realtime

# Auth + delivery: connect a socket.io client to wss://realtime.ledgerpro.shop
# /notifications with a real access token → expect connect; bad token → reject.
# Watch the bus while triggering a notifying action:
docker exec ledgerpro-redis redis-cli SUBSCRIBE ledgerpro:realtime
```

## Rollback

`docker compose -f docker-compose.prod.yml` is image-pinned by `IMAGE_TAG`. To
roll back: `export IMAGE_TAG=sha-<previous>` and `up -d`. Because the backend
keeps dual-emitting until the cutover PR, stopping realtime entirely falls back
to the in-process gateway (global broadcasts only) with no data loss.
