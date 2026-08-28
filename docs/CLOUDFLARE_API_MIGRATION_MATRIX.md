# TitanOS Cloudflare API Migration Matrix

## Release rule

TitanOS is migrating the complete canonical application to Cloudflare Workers without deleting product surfaces and without relying on Vercel as a hidden runtime fallback.

The connected TitanOS Vercel deployments return HTTP 402 `DEPLOYMENT_DISABLED`, so the Cloudflare runtime must be self-sufficient for every production-used API path before production traffic moves.

**Any production-used API route that is not natively certified, intentionally assigned to an independently certified external backend, or explicitly retired remains a production cutover blocker.**

## Status definitions

| Status | Meaning | Cutover implication |
| --- | --- | --- |
| `NATIVE_CANDIDATE` | Canonical handler is routed through the Cloudflare Worker adapter, but full parity/security/integration certification is incomplete. | Not sufficient by itself for production cutover. |
| `NATIVE_WORKER` | Route executes on Cloudflare Workers and has passed its required parity, authorization, data-integrity, error, and observability gates. | Eligible for production use. |
| `UNMIGRATED_BLOCKED` | Route is intentionally unavailable on the Cloudflare migration runtime and returns fail-closed HTTP 503. | Blocks any dependent production feature. |
| `EXTERNAL_BACKEND` | Route intentionally targets a separately certified non-Worker backend. | Allowed only with an explicit owner, health check, security review, and rollback path. |
| `RETIRED` | Route has no production callers and has been intentionally removed. | Must remain fail-closed. |
| `BLOCKED` | Route has unresolved security, compatibility, data-integrity, or operational defects. | Hard production blocker. |

## Current native execution surface

| Route | Current status | Evidence / remaining requirement |
| --- | --- | --- |
| `/api/functions/health` | `NATIVE_WORKER` | Deployed Worker health, readiness structure, no-store, security headers, native-runtime header, and full regression validation passed in the four-route preview/validator wave. |
| `/api/functions/auth/me` | `NATIVE_CANDIDATE` | Deployed missing-auth 401 boundary passed; authenticated GET/PATCH parity against Supabase, profile mutation isolation, and tenant/role behavior remain. |
| `/api/functions/appVersion` | `NATIVE_CANDIDATE` | Deployed Worker returned explicit configured release metadata and no stale fallback; native/Android update-gate behavior on the final production API origin remains. |
| `/api/functions/featureFlags` | `NATIVE_CANDIDATE` | Deployed no-secret preview proved `membershipPaymentsLive=false`, `verified=false`, and safe fallback behavior; Supabase-backed launch-state parity remains. |
| `/api/register` and `/api/functions/auth/register` | `NATIVE_CANDIDATE` | Worker routing, method/input guards, durable-rate-limit fail-closed tests, and non-mutating preview checks exist; real non-production Supabase create/duplicate/email-confirmation behavior remains. |
| `/api/functions/titanAICapabilities` | `NATIVE_WORKER` | Exact runtime head `2c10b3c1cec7e9f4e8b04c2f5a4e122f99fabdaf` passed route-level contract/method tests and deployed Worker GET/HEAD, 405 mutation rejection, no-store/native-runtime headers, and capability truth checks in preview run `33140295161`; full validator run `33140295163` also passed. |

Every other `/api/*` route is currently `UNMIGRATED_BLOCKED` on the Cloudflare migration runtime unless this ledger and the Worker router are deliberately updated together.

## Latest certification evidence

The four-route wave at branch head `c984ed25dc8bab15e7df4d3ff141c41c1aaec235` passed both required workflows:

- `TitanOS Cloudflare Full App Validate` run `33138131411`: canonical-product preservation, exact dependency install, lint, typecheck, authentication, API, payment, security, TitanAI, Driver Hub, GPS, offline/PWA, production build, Wrangler dry-run, and staged-native boundary gate all passed.
- `TitanOS Cloudflare Full App Preview` run `33138131414`: isolated Workers deployment, edge health, SPA root/deep-route fallback, native health, explicit app-version truth, feature-flag payment fail-closed behavior, no-auth auth boundary, unmigrated-route fail-closed behavior, and no-production-routing assertion all passed.

The later identity/adapter hardening baseline at branch head `456879f2f3a0567280675ba7400811b5b4386945` passed the full validator including the mandatory Cloudflare Node-adapter parity suite and profile/referral policy gates. This proves the shared buffered adapter and static security gates at that revision; it does not by itself promote authenticated identity routes or production data policy.

The seven-route wave at exact runtime head `2c10b3c1cec7e9f4e8b04c2f5a4e122f99fabdaf` passed both required workflows:

- `TitanOS Cloudflare Full App Preview` run `33140295161`: isolated Worker deployment succeeded and the new `/api/functions/titanAICapabilities` route passed deployed GET, HEAD, mutating-method rejection, native-runtime/no-store headers, contract truth checks, seven-route edge-health reporting, preservation of the blocked `/api/functions/titanAI` boundary, and the no-production-routing assertion.
- `TitanOS Cloudflare Full App Validate` run `33140295163`: canonical-product preservation, lint, typecheck, auth/profile/API/registration/adapter/capabilities/payment/security/TitanAI/Driver/GPS/offline suites, production build, Wrangler dry-run, and staged seven-route boundary all passed.

This certifies `/api/functions/titanAICapabilities` as `NATIVE_WORKER`. It does **not** certify `/api/functions/titanAI`, `/api/functions/titanAILive`, or `/api/functions/aiExecuteAction`.

These results certify the current **staging topology**, not production cutover.

## Migration waves

### Wave 0 — Edge and low-risk platform APIs

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/health` | `NATIVE_WORKER` | Certified in deployed four-route wave; re-run at final production origin before DNS cutover. |
| `/api/functions/appVersion` | `NATIVE_CANDIDATE` | Native/Android update behavior on final production API origin and production release metadata. |
| `/api/functions/featureFlags` | `NATIVE_CANDIDATE` | Supabase-backed launch-state parity and explicit production payment-readiness configuration. |
| `/api/functions/sentryDebug` | `UNMIGRATED_BLOCKED` | Environment restriction and non-production exposure policy. |

### Wave 1 — Identity and account boundary

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/auth/me` | `NATIVE_CANDIDATE` | Missing-token and invalid-token 401, authenticated GET/PATCH parity, role/tenant isolation, CORS behavior. |
| Other `/api/functions/auth/*` | `UNMIGRATED_BLOCKED` | Session/bearer parity, invalid-token behavior, role/tenant authorization, cookie/header behavior. |
| `/api/register` and `/api/functions/auth/register` | `NATIVE_CANDIDATE` | Real non-production signup creation, duplicate identity behavior, email-confirmation flow, and durable abuse-control integration. |
| `/api/functions/accountDeletionRequest` | `UNMIGRATED_BLOCKED` | Reauthentication/ownership, deletion workflow, audit trail, data-retention policy. |
| `/api/signup-emails` | `UNMIGRATED_BLOCKED` | Public POST is retired; any retained GET/export path needs explicit administrative authorization and route ownership before migration. |

### Wave 2 — TitanAI and action execution

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/titanAI` | `UNMIGRATED_BLOCKED` | Auth, workspace context isolation, input limits, provider failure behavior, observability. |
| `/api/functions/titanAILive` | `UNMIGRATED_BLOCKED` | True streaming/SSE parity, disconnect handling, backpressure, auth, timeout behavior. |
| `/api/functions/titanAICapabilities` | `NATIVE_WORKER` | Certified on exact runtime head `2c10b3c1cec7e9f4e8b04c2f5a4e122f99fabdaf` by preview run `33140295161` and validator run `33140295163`; re-check at final production origin before cutover. |
| `/api/functions/aiExecuteAction` | `UNMIGRATED_BLOCKED` | Action authorization, confirmation gates, idempotency, compensating actions, audit trail. |

The current Node-handler adapter buffers `res.write()` output; therefore it is **not yet certified for live streaming endpoints such as TitanAILive**.

### Wave 3 — Titan Support

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/supportAI` | `UNMIGRATED_BLOCKED` | Workspace-aware context without authorization leakage; escalation behavior. |
| `/api/functions/supportCreateCase` | `UNMIGRATED_BLOCKED` | Ownership, validation, deduplication, auditability. |
| `/api/functions/supportListCases` | `UNMIGRATED_BLOCKED` | Tenant/user isolation. |
| `/api/functions/supportGetCase` | `UNMIGRATED_BLOCKED` | Case ownership/agent authorization. |
| `/api/functions/supportPostMessage` | `UNMIGRATED_BLOCKED` | Sender authorization, content/attachment boundaries. |
| `/api/functions/supportRegisterAttachment` | `UNMIGRATED_BLOCKED` | File metadata validation and authorization. |
| `/api/functions/supportReopenCase` | `UNMIGRATED_BLOCKED` | State-machine correctness and authorization. |
| `/api/functions/supportSubmitCsat` | `UNMIGRATED_BLOCKED` | Case/user association and duplicate handling. |
| `/api/functions/supportEscalate` | `UNMIGRATED_BLOCKED` | Escalation permission and audit trail. |
| Support agent/admin routes | `UNMIGRATED_BLOCKED` | Agent/admin authorization, tenant boundaries, assignment/state integrity, audit trail. |

### Wave 4 — Money, billing, and commerce

No payment route becomes native merely because it compiles. Production financial state must be certified independently.

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/attention/create-checkout` | `UNMIGRATED_BLOCKED` | Authenticated ownership, server-side amount authority, idempotency, allowed return origin. |
| `/api/functions/stripeWebhook` | `UNMIGRATED_BLOCKED` | Raw-body signature verification, event idempotency, duplicate delivery, authoritative DB transitions, rollback. |
| `/api/functions/createPaymentLink` | `UNMIGRATED_BLOCKED` | Server-side amount/customer authority, idempotency, redirect integrity. |
| `/api/functions/createSubscriptionCheckout` | `UNMIGRATED_BLOCKED` | Plan catalog authority, entitlement mapping, idempotency. |
| `/api/functions/stripeCustomerPortal` | `UNMIGRATED_BLOCKED` | Customer ownership, return URL allowlist. |
| `/api/functions/subscriptionStatus` | `UNMIGRATED_BLOCKED` | Stripe/DB reconciliation and stale-state behavior. |
| `/api/functions/calculateFee` | `UNMIGRATED_BLOCKED` | Deterministic fee parity and tamper resistance. |
| `/api/functions/adminFees` | `UNMIGRATED_BLOCKED` | Admin-only access, configuration integrity, audit log. |
| Other payment/order/subscription handlers | `UNMIGRATED_BLOCKED` | Provider verification, ownership, replay/idempotency, state integrity, rollback. |

### Wave 5 — Work, jobs, routes, and communications

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/jobMatches*` | `UNMIGRATED_BLOCKED` | Tenant/user scope, fairness policy, deterministic error behavior. |
| `/api/functions/directionsOptimize` | `UNMIGRATED_BLOCKED` | Auth, provider-key isolation, coordinate validation, timeout/fallback behavior. |
| `/api/functions/createNotification` | `UNMIGRATED_BLOCKED` | Recipient authorization, duplicate prevention, delivery audit. |
| `/api/functions/sendEmail` | `UNMIGRATED_BLOCKED` | Sender/recipient authorization, injection resistance, provider failure handling. |
| `/api/functions/sendFollowUp` | `UNMIGRATED_BLOCKED` | Ownership, scheduling/replay safety, delivery audit. |
| `/api/functions/analyticsIngest` | `UNMIGRATED_BLOCKED` | Abuse limits, schema validation, privacy/tenant separation. |
| `/api/functions/submitFeedback` | `UNMIGRATED_BLOCKED` | Input limits, abuse controls, delivery failure behavior. |

### Wave 6 — Customer portal, contracts, marketplace, and referrals

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| Portal OTP/data/payment/review handlers | `UNMIGRATED_BLOCKED` | Rate limits, enumeration resistance, token/session scope, ownership, replay protection. |
| Public contract/share-token handlers | `UNMIGRATED_BLOCKED` | Ownership, entropy, expiry/revocation, least-data exposure. |
| Marketplace install/seed handlers | `UNMIGRATED_BLOCKED` | Entitlement/admin boundary, allowlists, idempotency. |
| Referral handlers | `UNMIGRATED_BLOCKED` | Ownership, anti-self-referral controls, payment authority, idempotency. |

### Wave 7 — Administrative and specialized services

| Route / family | Current status | Required certification before native promotion |
| --- | --- | --- |
| `/api/functions/adminControl` | `UNMIGRATED_BLOCKED` | Strong admin authorization, request controls, audit log. |
| `/api/functions/receiptVisionOcr` | `UNMIGRATED_BLOCKED` | File/content limits, provider-secret isolation, privacy and retention behavior. |

## Native adapter certification requirements

Before the adapter can be used broadly, tests must prove:

1. GET, HEAD, POST, PATCH, PUT, DELETE, and OPTIONS semantics used by TitanOS are preserved.
2. Query strings and repeated query keys are mapped correctly.
3. Authorization, Origin, Content-Type, Stripe-Signature, idempotency, and application headers are preserved without trusting Cloudflare client-IP headers as application authority.
4. JSON, URL-encoded, text, binary, and raw webhook bodies are preserved exactly where required.
5. Response status, JSON, text, binary data, redirects, CORS, and multiple response headers remain correct.
6. Multiple `Set-Cookie` values are preserved before any cookie-emitting handler is promoted.
7. Streaming/SSE endpoints use a true streaming implementation rather than the adapter's current buffered `res.write()` behavior.
8. Multipart/file-upload handlers receive dedicated compatibility testing before migration.
9. API responses remain `Cache-Control: no-store` and receive request-correlation headers.
10. Unmapped routes return deterministic `503 api_route_not_migrated` without leaking implementation details.

The shared buffered adapter has passed its current parity suite on the `456879f2f3a0567280675ba7400811b5b4386945` baseline and again in validator run `33140295163` on the seven-route runtime head. This does **not** certify SSE/live streaming or multipart handlers; those require dedicated implementations/tests before route promotion.

## Environment and secret rule

- Preview deployment receives Cloudflare deployment authority only unless a dedicated non-production integration credential is intentionally provisioned.
- Production Supabase service-role, Stripe, email-provider, AI-provider, and other privileged secrets must not be copied into a public preview merely to make tests pass.
- Each privileged integration requires its own certification gate before the corresponding native route is enabled in production.
- The Cloudflare runtime must not reintroduce `LEGACY_API_ORIGIN`, `titanos-web.vercel.app`, or any `.vercel.app` API dependency.
- Browser builds use same-origin `/api` by default; native/packaged builds require an explicit `VITE_API_BASE_URL` pointing to the final production HTTPS origin.

## Android/mobile rule

The restored Android release workflow remains manual and fail-closed while its configured live API URL points to the disabled Vercel deployment. It must not resume automatic release packaging until the production Cloudflare API origin is deliberately selected, verified, added to CORS/OAuth/deep-link configuration as applicable, and the Android workflow plus regression test are updated together.

## Production cutover gate

Production traffic remains **NO-GO** until all of the following are independently evidenced:

- the complete canonical TitanOS application remains intact;
- full lint/typecheck and required auth/API/payment/security/TitanAI/Driver/GPS/offline suites pass;
- isolated Cloudflare preview passes SPA, deep-route, security-header, and native API checks;
- every production-used `/api` route is `NATIVE_WORKER`, `EXTERNAL_BACKEND`, or `RETIRED`;
- authenticated Supabase paths are certified without exposing production service-role secrets to preview;
- Stripe and other financial integrations pass deliberate production-safe certification;
- TitanAI streaming and Titan Support behavior pass on the Worker topology;
- Driver Hub/GPS, PWA, Capacitor/Android, camera/microphone/geolocation, and deep-link behavior pass on the target origin;
- CORS, OAuth callbacks, redirect allowlists, CSP, and public-origin settings reference the intended Cloudflare production origin rather than the disabled Vercel origin;
- production custom-domain/DNS activation has an exact rollback procedure;
- `/__titanos/edge-health` continues to report `production_cutover_ready: false` until a final reviewed release-gate commit deliberately changes it.

## Promotion rule

A route status may change from `UNMIGRATED_BLOCKED` to `NATIVE_CANDIDATE` only in the same reviewed change that adds its Worker route and route-specific tests. It may change from `NATIVE_CANDIDATE` to `NATIVE_WORKER` only after deployed certification evidence exists for the route's complete required behavior.

There is no compatibility-bridge retirement step: the Cloudflare migration runtime intentionally has no Vercel API fallback.
