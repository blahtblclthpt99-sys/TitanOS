# TitanOS Future Feature — Multiple-Opening / Dual & Group Job Match

Status: **DEFERRED**. Not part of the current jobs-first Android release gate.

## User purpose
Notify an opt-in job seeker when a verified employer is hiring two or more qualified people. Let the applicant invite someone via a public listing and optionally distribute alerts to other opted-in qualified users. No carpool, shared address, relationship status, group hiring guarantee, or mandatory partner.

## Principles
- Prioritize normal single-person applications, reliable Careers home, login, resumes, application tracking, and actual verified job discovery first.
- Individuals own their profiles, consent, and applications. Employers review and hire each applicant separately.
- Employer-declared vacancy quantity, urgent status, shift, location, and listing expiration must be verified before displaying multiple-opening alerts.
- Do not imply that saving a tracker record submits an application or that an external link represents an additional confirmed vacancy.
- Invite through an explicitly public job URL only; never share applicant notes, resumes, addresses or other private data.
- Future opt-in should be reversible, account-scoped and synced; no deceptive local-only "live alerts".
- Code of conduct forbids harassment, threats, racist or sexist conduct, and workplace disruption; reporting and fair review rather than automatic penalties for unverified allegations.
- No assumption of shared transport. Each worker is independently responsible for commute arrangements.

## Future launch acceptance gates
1. Backend supports verified employer listings with available headcount and audit history.
2. Opt-in persisted per authenticated person; eligibility and notifications work, with opt-out and rate limits.
3. Verified openings only, expired listings hidden, and race conditions covered.
4. Each applicant separately reviews and submits their own application. No automatic application or partner enrollment.
5. Privacy/RLS checks for applicant and employer boundaries, plus reporting and abuse prevention.
6. Full automated tests, successful Android APK device validation, release signing verification.

## Deferred work
The Oct 22 initial local toggle and post-tracker copy invitation were intentionally removed from active UI until a verified backend exists. The former experimental code is recoverable from Git history, not a released feature.
