# Elation EMR → GoHighLevel Sync

Express server that receives Elation EMR webhooks and syncs patients & appointments to GoHighLevel (GHL) as Contacts + Opportunities.

## Local dev

```bash
npm install
cp .env.example .env    # fill in secrets
npm run dev
```

`GET http://localhost:3000/health` should return `{ "status": "ok" }`.

## Deploy to Railway

1. Push this repo to GitHub.
2. New Railway project → Deploy from GitHub repo.
3. Add all env vars from `.env.example` in the Railway service settings.
4. Railway auto-runs `npm start`. Healthcheck path: `/health`.
5. Copy the public URL — you'll register it as the Elation webhook target.

## Register Elation webhooks

Get an OAuth token:

```bash
curl -X POST "$ELATION_BASE_URL/oauth2/token/" \
  -d "grant_type=client_credentials" \
  -d "client_id=$ELATION_CLIENT_ID" \
  -d "client_secret=$ELATION_CLIENT_SECRET"
```

Subscribe to `patients` and `appointments`:

```bash
curl -X POST "$ELATION_BASE_URL/app/subscriptions/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "patients",
    "target": "https://your-app.up.railway.app/webhooks/elation",
    "secret": "'"$ELATION_WEBHOOK_SECRET"'"
  }'

curl -X POST "$ELATION_BASE_URL/app/subscriptions/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "appointments",
    "target": "https://your-app.up.railway.app/webhooks/elation",
    "secret": "'"$ELATION_WEBHOOK_SECRET"'"
  }'
```

## Simulate a signed webhook locally

```bash
BODY='{"resource":"patients","object_id":123,"id":"evt_1"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$ELATION_WEBHOOK_SECRET" -hex | awk '{print $2}')

curl -X POST http://localhost:3000/webhooks/elation \
  -H "Content-Type: application/json" \
  -H "X-Elation-Signature: $SIG" \
  --data "$BODY"
```

> **Confirm the header name** (`X-Elation-Signature`) against the first real webhook from Elation and update `src/verifySignature.js` if it differs.

## Production hardening

- Swap in-memory dedupe `Set` for Redis (e.g. `ioredis` + `SETNX` with TTL).
- Add a retry queue (BullMQ) for failed GHL calls instead of just logging.
- Structured logging with `pino` + request IDs.
- Rate-limit backoff on GHL 429s (exponential retry with jitter).
- Health endpoint should also verify Elation token fetch works.
