# TitanOS — Google Play Career-Core Product Policy

## Product objective

TitanOS is a jobs, careers, worker-opportunity, and work-success platform.

The primary user journey is:

1. Build or maintain a career profile.
2. Discover jobs and legitimate work opportunities.
3. Evaluate job matches and companies.
4. Organize applications, interviews, schedules, credentials, and follow-up.
5. Use TitanAI for user-controlled career assistance.
6. Manage work after an opportunity is won.
7. Use specialized operational tools only when the user's work actually requires them.

No secondary feature may redefine TitanOS as a device-control, passive-tracking, ad-engagement, social, or unrelated marketplace app.

## Google Play implementation principles

### Minimum permissions

Request only the permission required for the feature the user is actively using. Prefer no permission, then user-selected data, then approximate/foreground access before precise/background access.

### Location

Location is not a prerequisite for account creation, career profiles, job browsing, applications, company discovery, AI career assistance, or ordinary scheduling.

If a specialized work feature needs location:

- start collection only from a clear user action;
- use foreground or approximate location whenever sufficient;
- stop collection when the task ends;
- never use location solely for advertising or analytics;
- do not make background location part of TitanOS's general career experience;
- keep prominent disclosure, consent, privacy policy, and Play Console declarations synchronized with actual behavior.

### Contacts

Do not request broad contact access for ordinary career workflows. Use user selection / platform pickers where contact selection is genuinely useful.

### Accessibility and automation

TitanOS must not use AccessibilityService as a general autonomous agent for navigating other apps, submitting applications, clicking controls, or making decisions on the user's behalf.

Automation should remain transparent, bounded, reversible, and user-authorized. Prefer in-app APIs and deterministic workflows.

### AI and third-party services

TitanOS remains responsible for user-data handling by integrated AI and third-party services. Send only data needed for the requested feature. Disclose material collection/sharing and obtain consent where required.

## Information architecture priority

Primary:

- Career Home
- Jobs
- Opportunities / Matches
- Career Profile
- Companies
- Schedule
- Notifications
- TitanAI Career Coach

Secondary:

- Customers
- Leads
- Communications
- Estimates
- Invoices
- Payments
- Finances
- Reports
- Booking

Specialized / opt-in:

- Driver Hub
- Route Planner
- Fleet
- Employees
- Inventory
- Business Documents
- Analytics

## Release gate

A Google Play release is blocked if any of the following are true:

- the store listing does not accurately describe the jobs/careers core;
- Data Safety declarations do not match production collection/sharing;
- an SDK collects undeclared personal or sensitive data;
- location scope exceeds the feature's minimum requirement;
- background location is enabled without a qualifying core use case and required disclosures;
- broad contacts permission is used when a picker/user-selection flow is adequate;
- AccessibilityService is used for prohibited autonomous behavior;
- users cannot delete their account/data where policy requires it;
- AI integrations receive more personal data than necessary for the requested task;
- a job or opportunity claim cannot be traced to a legitimate source.

## Product-quality rule

Every feature must answer at least one of these questions:

1. Does this help the user get work?
2. Does this help the user advance their career?
3. Does this help the user successfully organize or complete work they obtained?
4. Is this required for trust, safety, account management, or platform operation?

If the answer to all four is no, the feature should not occupy the primary TitanOS experience.
