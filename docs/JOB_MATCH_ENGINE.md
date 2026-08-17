# TitanOS Job Match Engine

Status: implementation contract for Issue #24

## Mission

Match a TitanOS user to legitimate work based on their authorized work profile. Search TitanOS-native opportunities first, then approved external providers only when native inventory is insufficient.

## Non-negotiable flow

`UNDERSTAND -> RETRIEVE -> NORMALIZE -> DEDUPE -> FILTER -> SCORE -> EXPLAIN -> PROPOSE -> PERMISSION -> APPLY/RECORD -> LEARN`

The engine must never fabricate a vacancy, hide the source of a listing, cross tenant/user boundaries, or submit an application without explicit user authorization.

## Work profile

The matching input is an authenticated user's work profile. It may include:

- skills and proficiency
- work history / experience duration
- licenses and certifications, including expiration
- job interests / desired roles
- city/state and authorized search radius
- schedule / availability
- minimum or preferred compensation
- work arrangement preferences
- saved, ignored, and applied history

Missing profile data must degrade gracefully. A new account with no skills receives an onboarding state rather than invented matches.

## Opportunity sources

### Tier 1: TitanOS native

Native inventory includes company and homeowner opportunities created inside TitanOS. Every native result must retain its posting ID, owner/tenant identity, status, timestamps, location and provenance.

### Tier 2: approved external providers

External retrieval is permitted only after user consent and only through approved integrations that allow the intended use. Provider identity and outbound destination must be visible to the user. Provider failure must not break native matching.

## Canonical normalized result

Every result presented by the engine should normalize to this conceptual shape:

```ts
type JobMatch = {
  id: string;
  source: "titan" | string;
  sourceJobId: string;
  sourceUrl?: string;
  title: string;
  organization?: string;
  description?: string;
  location?: { city?: string; state?: string; remote?: boolean };
  compensation?: { min?: number; max?: number; period?: string; currency?: string };
  employmentType?: string;
  schedule?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  requiredCredentials?: string[];
  postedAt?: string;
  expiresAt?: string;
  matchScore: number;
  reasons: string[];
  gaps: string[];
  provenance: { provider: string; retrievedAt: string };
};
```

External raw payloads must not be trusted as authorization or rendered as executable HTML.

## Filtering

Reject or suppress results that are:

- expired, closed, removed, or materially stale
- outside hard location/radius constraints unless remote work is acceptable
- incompatible with required credentials the user does not possess
- duplicates of the same vacancy
- missing enough provenance to establish where the vacancy came from
- blocked by user state (ignored/applied) when the active view excludes those states

## Deduplication

Prefer stable provider IDs. Cross-provider duplicates should use a conservative fingerprint based on normalized organization, title, location and posting characteristics. When uncertain, retain both rather than accidentally hiding distinct jobs.

## Scoring

Score from 0-100 using deterministic components before any AI explanation. Suggested initial weights:

- skills: 35
- credentials: 20
- location/radius: 15
- schedule/availability: 10
- role interest: 10
- compensation preference: 10

Hard requirements can disqualify a result rather than merely lowering its score. The UI must expose concise reasons such as `4 of 5 requested skills`, `12 miles away`, or `matches your weekday availability`. Do not claim a qualification that is absent from the user's profile.

## Permission boundary

Searching, ranking, saving and ignoring are low-risk account actions. Opening an external listing is user-directed navigation. Any application submission, message to an employer, document transmission, or disclosure of personal data requires an explicit preview and approval immediately before execution.

Invisible Interface may generate the preview UI but may not bypass this boundary.

## State and learning

Record at minimum:

- seen
- saved
- ignored
- applied
- application outcome when supplied/authorized

Learning may adjust ranking preferences from explicit and appropriate behavioral signals, but it must not silently invent skills, credentials, availability or compensation requirements.

## Security and privacy

- Scope every user-owned query to authenticated user identity.
- Scope tenant-owned native opportunities to authorized visibility.
- Enforce authorization server-side / through RLS; UI filtering is not security.
- Do not place provider credentials in client bundles.
- Validate outbound URLs and use an allowlist for configured providers.
- Sanitize untrusted descriptions.
- Rate-limit provider retrieval and cache within provider terms.
- Audit consent and application actions.
- Do not expose one user's profile, saved jobs, applications or ranking history to another user.

## Required tests

1. Existing account with complete work profile gets deterministic native matches.
2. New account/no skills gets onboarding, not fabricated matches.
3. Sparse native inventory invokes external fallback only with consent.
4. No consent means no external provider call.
5. Expired/stale jobs are excluded.
6. Duplicate provider/native results collapse safely.
7. Missing required credential disqualifies when credential is hard-required.
8. Cross-user saved/applied state cannot leak.
9. Cross-tenant private native opportunities cannot leak.
10. External provider failure preserves native results and produces a recoverable state.
11. Every external result displays provenance/source.
12. Application cannot execute without explicit approval.
13. Malicious external description is rendered inert.
14. Invalid/non-allowlisted outbound URL is rejected.

## Delivery sequence

1. Profile schema audit and reuse of existing skill/certification fields.
2. Native opportunity schema audit; do not overload Marketplace service listings if semantics differ.
3. Normalizer + deterministic scorer as pure tested modules.
4. Native retrieval with authorization/RLS verification.
5. Consent model and provider adapter interface.
6. First approved external provider adapter.
7. Match UI / Invisible Interface cards with reasons, source and gaps.
8. Save/ignore/applied state.
9. Explicit application preview/approval boundary.
10. Integration, RLS and abuse tests.
11. Production telemetry and release certification.

A green build alone does not certify this feature.