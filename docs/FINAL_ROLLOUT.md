# TitanOS 1.6.5 final rollout

## Release candidate

1. Build with JDK 21 and the configured Android SDK: `npm run android:sign`.
2. Confirm R8 completes and archive `mapping.txt`, `usage.txt`, `seeds.txt`, and the signed AAB with the release record.
3. Install the release build on a compact Android phone and an Android tablet.
4. Smoke test sign-in, navigation, jobs, Driver Hub, camera/file access, deep links, theme switching, offline recovery, and keyboard/cutout behavior.
5. Run `npm run gate:ship` and the mobile/tablet Playwright projects.

## Play Console rollout

1. Upload version code 28 to Internal testing and resolve every pre-launch report issue.
2. Promote the identical AAB to Closed testing for at least one full business day.
3. Start Production at 10% after crash-free startup, ANR, authentication, and core workflow checks are green.
4. Hold at 10% for 24 hours, then move to 25%, 50%, and 100% with a 24-hour observation window at each stage.
5. Halt promotion if crash-free users fall below 99.5%, ANRs exceed Play thresholds, sign-in fails, or a critical workflow regresses.

## Rollback readiness

- Keep the prior production AAB, signing material, database migration record, R8 mapping, and web deployment identifier available.
- Use Play Console rollout halt for native regressions. Use a forward-fix release with a new version code; never reuse version code 28.
- Do not ship schema changes that cannot coexist with both the prior and current app versions during the staged rollout.
