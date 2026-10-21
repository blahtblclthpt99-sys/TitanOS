# TitanOS Android recovery baseline — 2026-10-20

## User-provided reference APK
- Filename: `19.apk` (provided in ChatGPT; not committed to GitHub)
- SHA-256: `4eaa7f422dc8335857259ae5e9fa48269988bb65cafa53020189e052c53542fc`
- ZIP integrity: passed; 782 members
- Packaged Capacitor app ID: `com.titanos.myapp`
- Packaged app name: `TitanOS`
- Embedded local application assets: `assets/public/` (340 entries)
- Inspectable compiled modules include `Jobs`, `Marketplace`, `DriverHub`, `AIAssistant`, `Login`, `Dashboard`, `AuthenticatedShell`, and `Profile`.
- The APK is a **reference artifact** only. Its underlying source commit, version code, signing certificate, Play eligibility, and runtime functionality have **not been verified**.
- Do not upload, distribute, or replace the production Play release on the basis of this inspection.

## Recovery candidate
- Branch `recovery/android-original-20261020` begins at `archive/titanfieldos-before-earn-takeover-2026-08-18`.
- Archived native source declares `com.titanos.myapp` and version `2.0.4`, code `37`; this does **not** establish that `19.apk` corresponds to that code.
- `.github/workflows/android-recovery-apk.yml` builds a **debug preview** with a distinct package ID (`.recovery` suffix) to avoid overwriting the installed app.
- Do not assume debug preview authentication works with production OAuth redirect allowlists.

## Release acceptance gates
1. Obtain a successful GitHub Actions debug APK artifact.
2. Compare installed reference APK and preview on an Android device: shell layout, routes, job search, TitanAI, signup/login, session refresh.
3. Confirm app signing and Play Console's currently highest version code before choosing a new production version code.
4. Preserve native package `com.titanos.myapp` only for the signed Play release, not side-by-side previews.
5. Verify auth redirects, API connectivity, non-destructive storage migrations, Android 12+ launch behavior, and basic navigation.
6. Release to Google Play internal testing first; promote only after validation.

No release, signing, or production deployment is authorized by this document.
