# TitanOS Career Core Product Contract

## Primary objective

TitanOS is a career and work operating system. Its primary user journey is:

DISCOVER -> MATCH -> PREPARE -> APPLY -> INTERVIEW -> GET HIRED -> ORGANIZE WORK -> BUILD CAREER

## Primary surfaces

1. Career Command Center
2. Jobs
3. Opportunity Matches
4. Career Profile
5. Companies
6. Schedule
7. Notifications
8. TitanAI Career Coach

These surfaces must remain understandable and useful without requiring persistent location, broad contacts access, accessibility-service automation, or unrelated device permissions.

## Secondary work surfaces

Secondary tools support users after they obtain work or while self-employed:

- Driver Hub
- Route Planner
- Booking
- Customers and leads
- Estimates and invoices
- Payments and finances
- Business documents
- Employees, fleet, inventory
- Reporting and tax tools

Secondary tools must not displace the career journey in primary navigation or store positioning.

## Matching and employment decisions

TitanOS matching is assistive, not determinative.

- Explain why a job may match.
- Let users change preferences and inputs.
- Do not silently disqualify a person.
- Do not make protected-trait inferences.
- Do not claim employment certainty.
- Do not present an interaction score as an employer hiring decision.
- Keep employer and job-seeker decisions human controlled.

## Permission contract

Permissions are feature-scoped and just-in-time.

- Location: prefer non-location search inputs, coarse location, or a one-time user initiated location action. Persistent/background access must never be a prerequisite for core career discovery.
- Contacts: do not require broad address-book access for career functionality. Prefer explicit recipient entry or system picker flows.
- Camera/photos/files: request only after the user starts a resume, credential, document, receipt, or profile upload action.
- Notifications: opt-in and tied to concrete user benefit such as application, interview, job, schedule, or account updates.
- Accessibility APIs: never use them as a general autonomous agent that plans and executes actions across other apps.

## AI contract

TitanAI may:

- explain job matches;
- help write or improve resumes and applications;
- conduct interview practice;
- suggest career-development steps;
- help organize a user's own work;
- draft actions for explicit user review.

TitanAI must not impersonate employer authority, promise hiring outcomes, submit consequential actions invisibly, or use sensitive personal data to infer employment eligibility.

## Product test

Before adding or promoting a feature, ask:

1. Does it help a user get work, advance a career, organize/complete work, or safely operate those functions?
2. Does it require the minimum data and permission scope necessary?
3. Can a user understand what it does and remain in control?

If the answer to any question is no, the feature must be redesigned, demoted, or removed from the career core.
