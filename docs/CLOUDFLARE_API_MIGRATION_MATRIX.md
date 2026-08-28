# TitanOS Cloudflare API Migration Matrix

## Release rule

TitanOS is using a staged strangler migration. Cloudflare owns the web edge and SPA delivery first; the canonical Vercel API remains a temporary compatibility origin until each production-used route is either ported to Cloudflare, explicitly retired, or independently certified to remain on a separate backend.

**The compatibility bridge must not be removed while any production-used route remains `BRIDGED`.**

A route may move to `NATIVE_WORKER` only after its authentication, authorization, input validation, side effects, idempotency, error behavior, observability, and regression tests pass against the Cloudflare implementation.

## Status definitions

| Status | Meaning | Cutover implication |
| --- | --- | --- |
| `BRIDGED` | Cloudflare forwards the request unchanged to the canonical TitanOS Vercel API origin. | Allowed during staged migration; blocks removal of legacy API origin. |
| `NATIVE_WORKER` | Route executes on Cloudflare Workers and has passed parity/security certification. | Eligible for permanent Cloudflare operation. |
| `EXTERNAL_BACKEND` | Route intentionally targets another independently certified backend. | Allowed only with an explicit owner, health check, and rollback path. |
| `RETIRED` | Route has no production callers and has been intentionally removed. | Must fail closed. |
| `BLOCKED` | Route has unresolved security, data-integrity, payment, or platform incompatibility. | Blocks production cutover for any dependent feature. |

## Migration waves

All routes below begin as `BRIDGED` unless a later commit changes the ledger together with implementation and certification evidence.

### Wave 0 — Edge and health

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/health` | `BRIDGED` | GET/HEAD parity, deep-health authorization, readiness semantics, no secret disclosure, no-store. |
| `/api/functions/appVersion` | `BRIDGED` | Version/cache semantics and mobile update behavior. |
| `/api/functions/featureFlags` | `BRIDGED` | Auth/tenant visibility, cache policy, safe defaults. |
| `/api/functions/sentryDebug` | `BRIDGED` | Environment restriction and non-production exposure policy. |

### Wave 1 — Identity and account boundary

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/auth/*` | `BRIDGED` | Session/bearer parity, invalid-token 401, role/tenant authorization, cookie/header behavior. |
| `/api/register` and `/api/functions/auth/register` | `BRIDGED` | Signup validation, duplicate identity behavior, email flow, abuse/rate controls. |
| `/api/functions/accountDeletionRequest` | `BRIDGED` | Reauthentication/ownership, deletion workflow, audit trail, data-retention policy. |
| `/api/signup-emails` | `BRIDGED` | Trigger authorization, replay protection, provider failure behavior. |

### Wave 2 — TitanAI and action execution

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/titanAI` | `BRIDGED` | Auth, workspace context isolation, prompt/input limits, failure behavior, observability. |
| `/api/functions/titanAILive` | `BRIDGED` | Streaming/live parity, disconnect handling, auth, timeout behavior. |
| `/api/functions/titanAICapabilities` | `BRIDGED` | Capability truthfulness and entitlement boundaries. |
| `/api/functions/aiExecuteAction` | `BRIDGED` | Action authorization, confirmation gates, idempotency, compensating actions, audit trail. |

### Wave 3 — Titan Support

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/supportAI` | `BRIDGED` | Workspace-aware context without authorization leakage; escalation behavior. |
| `/api/functions/supportCreateCase` | `BRIDGED` | Ownership, validation, deduplication, auditability. |
| `/api/functions/supportListCases` | `BRIDGED` | Tenant/user isolation. |
| `/api/functions/supportGetCase` | `BRIDGED` | Case ownership/agent authorization. |
| `/api/functions/supportPostMessage` | `BRIDGED` | Sender authorization, attachment/content boundaries. |
| `/api/functions/supportRegisterAttachment` | `BRIDGED` | File metadata validation and authorization. |
| `/api/functions/supportReopenCase` | `BRIDGED` | State-machine correctness and authorization. |
| `/api/functions/supportSubmitCsat` | `BRIDGED` | Case/user association and duplicate handling. |
| `/api/functions/supportEscalate` | `BRIDGED` | Escalation permission and audit trail. |
| `/api/functions/supportAgentInbox` | `BRIDGED` | Agent/admin authorization and tenant boundaries. |
| `/api/functions/supportAgentGetCase` | `BRIDGED` | Agent authorization and sensitive-data handling. |
| `/api/functions/supportAgentReply` | `BRIDGED` | Agent authorization, message integrity, audit trail. |
| `/api/functions/supportAdminAssignCase` | `BRIDGED` | Admin-only enforcement and assignment consistency. |
| `/api/functions/supportIncidentAdmin` | `BRIDGED` | Admin-only enforcement and incident state integrity. |
| `/api/functions/supportAnalytics` | `BRIDGED` | Admin/agent scope, aggregation privacy. |
| `/api/functions/supportRefreshSubscription` | `BRIDGED` | Billing source of truth and authorization. |

### Wave 4 — Money, billing, and commerce

These routes receive the strictest migration gate. No payment route becomes native merely because it compiles or accepts a synthetic request.

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/attention/create-checkout` | `BRIDGED` | Authenticated ownership, server-side amount authority, idempotency, exact return origin. |
| `/api/functions/stripeWebhook` | `BRIDGED` | Raw-body signature verification, event idempotency, duplicate delivery, authoritative DB transitions, rollback. |
| `/api/functions/createPaymentLink` | `BRIDGED` | Server-side amount/customer authority, idempotency, redirect integrity. |
| `/api/functions/createSubscriptionCheckout` | `BRIDGED` | Plan catalog authority, entitlement mapping, idempotency. |
| `/api/functions/stripeCustomerPortal` | `BRIDGED` | Customer ownership, return URL allowlist. |
| `/api/functions/subscriptionStatus` | `BRIDGED` | Stripe/DB reconciliation and stale-state behavior. |
| `/api/functions/calculateFee` | `BRIDGED` | Deterministic fee parity and tamper resistance. |
| `/api/functions/adminFees` | `BRIDGED` | Admin-only access, configuration integrity, audit log. |
| `/api/functions/paypalWebhook` | `BRIDGED` | Signature/authenticity verification, idempotency, authoritative DB transitions. |
| `/api/functions/mppPaid` | `BRIDGED` | Payment proof validation, replay protection, authoritative state transitions. |
| `/api/functions/createAutopilotOrder` | `BRIDGED` | Authorization, amount/order integrity, idempotency. |
| `/api/functions/runAutopilotOrder` | `BRIDGED` | Execution authorization, retry safety, duplicate prevention. |
| `/api/functions/runAutopilotMembership` | `BRIDGED` | Subscription/entitlement authority and replay safety. |
| `/api/functions/googlePlayVerifySubscription` | `BRIDGED` | Store verification, package/product binding, replay prevention. |

### Wave 5 — Work, jobs, routes, and communications

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/jobMatches` | `BRIDGED` | Tenant/user scope, fairness policy, deterministic error behavior. |
| `/api/functions/jobMatchesV2` | `BRIDGED` | Same as above plus version-parity contract. |
| `/api/functions/directionsOptimize` | `BRIDGED` | Auth, provider-key isolation, coordinate validation, timeout/fallback behavior. |
| `/api/functions/createNotification` | `BRIDGED` | Recipient authorization, duplicate prevention, delivery audit. |
| `/api/functions/sendEmail` | `BRIDGED` | Sender/recipient authorization, injection resistance, provider failure handling. |
| `/api/functions/sendFollowUp` | `BRIDGED` | Ownership, scheduling/replay safety, delivery audit. |
| `/api/functions/analyticsIngest` | `BRIDGED` | Abuse limits, schema validation, privacy/tenant separation. |
| `/api/functions/submitFeedback` | `BRIDGED` | Input limits, abuse controls, delivery failure behavior. |

### Wave 6 — Customer portal, contracts, marketplace, and referrals

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/portalRequestOtp` | `BRIDGED` | Rate limiting, enumeration resistance, expiration behavior. |
| `/api/functions/portalVerifyOtp` | `BRIDGED` | One-time use, expiry, brute-force limits, session integrity. |
| `/api/functions/portalGetData` | `BRIDGED` | Token/session scope and least-data exposure. |
| `/api/functions/portalAcceptEstimate` | `BRIDGED` | Customer authority, immutable acceptance evidence, replay protection. |
| `/api/functions/portalPayInvoice` | `BRIDGED` | Invoice/customer authority, amount integrity, payment idempotency. |
| `/api/functions/portalLeaveReview` | `BRIDGED` | Customer/job association, duplicate handling, moderation policy. |
| `/api/functions/publicContract` | `BRIDGED` | Share-token scope, expiry, least-data exposure. |
| `/api/functions/contractShareToken` | `BRIDGED` | Ownership, token entropy, expiry/revocation. |
| `/api/functions/installMarketplaceModule` | `BRIDGED` | Entitlement/admin boundary and module allowlist. |
| `/api/functions/seedMarketplace` | `BRIDGED` | Non-production/admin restriction and idempotency. |
| `/api/functions/attachReferral` | `BRIDGED` | Referral ownership, anti-self-referral rules, idempotency. |
| `/api/functions/markReferralPaying` | `BRIDGED` | Payment authority, duplicate prevention, audit trail. |

### Wave 7 — Administrative and specialized services

| Route / family | Initial status | Required certification before native cutover |
| --- | --- | --- |
| `/api/functions/adminControl` | `BRIDGED` | Strong admin authorization, CSRF/request controls where applicable, audit log. |
| `/api/functions/receiptVisionOcr` | `BRIDGED` | File/content limits, provider-secret isolation, privacy and retention behavior. |

## Bridge certification requirements

Before the Cloudflare frontend is allowed to serve production traffic while APIs remain bridged, the preview must prove:

1. GET, HEAD, POST, PUT/PATCH where used, DELETE where used, and OPTIONS semantics survive the bridge.
2. Authorization, cookies, content type, raw request bodies, and idempotency headers are preserved.
3. Stripe/external redirects remain external; only redirects back to the legacy TitanOS origin are rewritten to the Cloudflare origin.
4. API responses are never cached by Cloudflare.
5. Upstream failures return a deterministic 502/503 edge failure without exposing secrets.
6. Request correlation IDs cross the edge boundary.
7. No Cloudflare preview deployment can attach production routes or mutate payment-provider routing.
8. The canonical Vercel backend remains deployed and healthy until the final bridged route is retired or ported.

## Production cutover gate

Production traffic remains **NO-GO** until all of the following are independently evidenced:

- full canonical TitanOS build and regression suites pass;
- isolated Cloudflare preview passes SPA, auth boundary, API bridge, security-header, PWA/deep-link, and device-capability checks;
- OAuth/auth redirect allowlists include the intended production origin;
- Stripe and any other financial integrations are certified with deliberate production procedures, not preview automation;
- TitanAI, Titan Support, Driver Hub/GPS, jobs/workflows, customer portal, and billing flows are exercised end-to-end on the migration topology;
- production DNS/custom-domain activation has an exact rollback procedure;
- the Worker health endpoint continues to report `production_cutover_ready: false` until the final release gate is deliberately changed in a reviewed commit.

## Retirement rule

The `LEGACY_API_ORIGIN` binding and `/api/*` compatibility proxy may be deleted only when this ledger contains no `BRIDGED` production-used routes and the replacement topology has passed the same regression/security suites that protected the original API.
