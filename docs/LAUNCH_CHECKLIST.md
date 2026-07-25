# Launch readiness

Gate before shipping to production:

```bash
npm run lint
npm run build
npm test
```

When secrets/env are available:

```bash
npm run auth:check
npm run supabase:check
npm run test:db-security
npm run ops:payments
```

## Hardened in this pass

- Chunk-reload one-shot no longer clears at module boot (prevents infinite reload)
- Marketplace image upload imports `api`
- Service worker `v8` uses stale-while-revalidate for `/assets/`
- Public routes + AuthenticatedShell wrapped in ErrorBoundary
- Invoice / Driver Hub `.toFixed` guarded with `Number(...)`
- Android install banner raised above mobile action dock
- Production banner if Supabase env is missing

## Scale / concurrent users

See [SCALE_READINESS.md](./SCALE_READINESS.md). UI and client query hardening for multi-thousand sessions is required before any “10k online” claim; verify against Supabase capacity separately.
