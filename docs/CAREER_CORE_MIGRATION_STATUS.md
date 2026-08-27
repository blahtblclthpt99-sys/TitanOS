# TitanOS Career Core Migration Status

## Completed in this branch

- Restored work from the last certified TitanOS application lineage rather than the later Titan Attention replacement.
- Re-centered primary navigation on jobs, matches, career profile, companies, schedule, notifications, and TitanAI.
- Demoted fleet/business/financial tooling to secondary work tools.
- Removed the DoorDash-specific global keepalive from the authenticated core shell.
- Replaced driver-income-first public marketing with jobs/careers/work-opportunity positioning.
- Replaced the operations-heavy authenticated dashboard with a Career Command Center.
- Added Google Play sensitive-permission guidance and a permanent Career Core Product Contract.

## Next engineering gates

1. Verify lint, typecheck, build, and route integrity from the career branch.
2. Audit Android manifest and Capacitor plugins for minimum necessary permissions.
3. Audit Jobs and Match flows for transparent ranking, human control, and safe employment-decision boundaries.
4. Update Privacy Policy, Terms, Play Data Safety mapping, and permission disclosures to match actual runtime behavior.
5. Remove or isolate remaining legacy gig-provider-specific code from the default runtime graph.
6. Certify job discovery, profile, application tracking, interview preparation, notifications, and account deletion end-to-end.

## Release rule

Do not merge this branch into the current Titan Attention `main` branch. The two product lineages must remain isolated until repository ownership/branch strategy is intentionally resolved.
