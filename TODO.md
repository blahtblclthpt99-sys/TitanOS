# TitanOS — Follow-Up

## Production blockers

- [ ] Run a fresh full CI cycle against the current exact branch head; connector-originated GitHub mutations are not currently spawning a new Actions run.
- [ ] Reconstruct/recover the TitanOS Supabase schema in an isolated environment before applying any new production migration.
- [ ] Verify recovered database authorization, RLS, security advisors, and core application flows before production cutover.
- [ ] Restore a live production/preview runtime and complete browser/mobile smoke testing; the known `titanos-web` Vercel deployment is currently infrastructure-blocked.
- [ ] Verify customer portal OTP against the restored live deployment.
- [ ] Complete signed Android release verification with the configured Play upload key and production mobile runtime variables.

## Product follow-up

- [ ] Add the production Android download artifact/link only after a signed, exact-head build passes release certification.
- [ ] Wire paid-plan checkout when paid plans are intentionally launched; keep billing surfaces gated until then.

## Completed foundations

- [x] Fleet page uses real Equipment entity/API data rather than hardcoded vehicles.
- [x] Insurance documents use the InsuranceDoc entity/API path with per-user local fallback and legacy-local migration.
- [x] Automated Node regression suites, Playwright Chromium smoke tests, and GitHub CI gates are present.
- [x] Android Gradle wrapper is executable in Git metadata and CI/release workflows defensively normalize wrapper permissions.
- [x] Equipment, Insurance, and Credentials destructive operations no longer report failed authoritative deletes as successful local changes.
- [x] Equipment and Credentials no longer report failed authoritative updates as successful unless the record is already known to the local-only fallback store.
