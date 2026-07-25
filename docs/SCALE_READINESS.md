# Scale & UI performance readiness

Goal: keep the UI fast and failure-free when many users are online at once.

## Honest capacity note

**10,000 concurrent logged-in users** is primarily a **Supabase PostgREST / connection / plan** problem, not a React one. This app talks to Supabase directly from the browser. Vercel `/api/*` rate limits do **not** protect that hot path.

What we *can* control in the app:

1. Cut per-session polling and payload size (done in this pass)
2. Cap every list/filter so a bug cannot download ~1000 rows
3. Stagger reconnect storms so network flaps do not stampede the DB
4. Fail closed on payments/auth; show ErrorBoundaries instead of blank screens

Claiming “handles 10k” without a measured Supabase load test against authenticated queries would be dishonest. Use the checklist below before a big launch event.

## Hardened in this pass

| Area | Change |
|------|--------|
| Notifications | One shared unread query (head/count), 45s poll, pauses when tab hidden |
| Entity adapter | Default page size 100, hard max 500; `count()` + range filters (`gt`/`in`/`is`) |
| Customer detail | Loads related jobs/estimates/invoices by `customer_id` (not 3×500 global lists) |
| Nav badges | Status-filtered slim queries instead of 3×100 full lists |
| React Query | Jittered reconnect refetch (0.4–3s); no window-focus refetch |
| Auth | Skip full profile reload on `TOKEN_REFRESHED` / `INITIAL_SESSION`; narrower profile select |
| Messages | 20s poll (was 12s); inbox merge capped at 100 |
| Community | Activity “since” uses server-side `created_at` filter when possible |
| API rate limit | Larger in-memory bucket map (still per-instance; abuse only) |

## Ops commands

```bash
# Public HTTP soak (landing/API edge — not authenticated DB)
npm run ops:load:smoke
npm run ops:load -- --profile scale

# App correctness
npm test
npm run build
```

## Before a 10k-user event

1. Confirm Supabase plan connection pool / compute headroom for peak concurrent queries
2. Add indexes on hot filters: `notifications(user_id, read_at)`, `jobs(customer_id)`, `invoices(status)`, etc.
3. Prefer Supabase Realtime for notifications/messages instead of polling at very high concurrency
4. Run authenticated k6/Artillery scenarios against PostgREST (login + dashboard + messages), not only `ops:load`
5. Watch p95 latency and error rate in Supabase + Sentry during a staged ramp (1k → 3k → 10k)
