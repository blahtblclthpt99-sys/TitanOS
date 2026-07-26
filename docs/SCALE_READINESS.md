# Scale & UI performance readiness

Goal: keep the UI fast and failure-free when many users are online at once.
Product law: design for **millions of users, trips, and jobs** — see `.cursor/rules/scalability.mdc`.

## Honest capacity note

**10,000 concurrent logged-in users** is primarily a **Supabase PostgREST / connection / plan** problem, not a React one. This app talks to Supabase directly from the browser. Vercel `/api/*` rate limits do **not** protect that hot path.

What we *can* control in the app:

1. Cut per-session polling and payload size
2. Cap every list/filter so a bug cannot download unbounded rows
3. Stagger reconnect storms so network flaps do not stampede the DB
4. Fail closed on payments/auth; show ErrorBoundaries instead of blank screens
5. Index hot filters; keyset-ready pagination; durable rate limits when Upstash is configured
6. Cloud `driver_trips` for multi-device history (local journal is a capped cache)

Claiming “handles millions” without measured authenticated PostgREST load tests would be dishonest.

## Hardened

| Area | Change |
|------|--------|
| Notifications | One shared unread query, 45s poll, pauses when tab hidden |
| Entity adapter | Default/preferred page 100, hard max 500; `count()`; `filterPage` keyset helper |
| Finances / Tax / Expenses | List pulls 100 (not 500) |
| Customer detail | Related entities by `customer_id` with limits |
| Messages | Local ring: 500 messages / 100 threads |
| Driver trips | Local `MAX_JOURNAL=2000` + sync to `driver_trips` (migration 034) |
| Indexes | Migration 034: customer_id, unread notifications, owner timelines |
| Rate limit | Memory + optional Upstash (`assertRateLimitAsync` on payment/AI) |
| Serverless | `maxDuration` on webhooks / AI / OCR / payments |
| React Query | Jittered reconnect; no window-focus refetch |
| Auth | Skip full profile reload on TOKEN_REFRESHED |

## Ops commands

```bash
npm run ops:load:smoke
npm run ops:load -- --profile scale
npm test
npm run build
```

## Before a large launch

1. Apply migrations **032–034** on Supabase
2. Confirm connection pool / compute headroom
3. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for cross-instance API limits
4. Prefer Realtime for notifications/messages at very high concurrency
5. Run **authenticated** k6/Artillery (login + dashboard + messages), not only public `ops:load`
6. Watch p95 in Supabase + Sentry during staged ramp
