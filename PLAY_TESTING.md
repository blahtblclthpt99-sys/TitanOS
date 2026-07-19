# Google Play — fix testers who can’t download or use TitanOS

Official package: **`com.titanos.myapp`** (label: TitanOS)

This is **not** the old Base44 / TitanFieldOS package (`com.base6a40…`). Those are different apps. Testers invited to the wrong listing will never see your Capacitor build.

## Why testers say “can’t download”

Almost always one of these:

1. **They never opted in** to closed/internal testing  
2. **Wrong Google account** on the phone vs the invite email  
3. **Track not published** / release still in Draft  
4. **Wrong Play app** (Base44 listing instead of `com.titanos.myapp`)  
5. They’re trying to **sideload an APK** instead of installing from Play  

## Fix it in Play Console (do this once)

1. Open [Google Play Console](https://play.google.com/console) → app **TitanOS** (`com.titanos.myapp`).
2. **Testing → Closed testing** (or Internal testing).
3. Create a release → upload `release/TitanOS.aab` → review → **Start rollout to Closed testing**.
4. **Testers** tab → add emails (or a Google Group) → save.
5. Copy the **opt-in link** (also always):

   `https://play.google.com/apps/testing/com.titanos.myapp`

6. Send that link to every tester. They must:
   - Sign into Play with the **same** Google account you invited  
   - Tap **Become a tester**  
   - Wait 1–15 minutes  
   - Open the Play listing and Install  

Store listing link:

`https://play.google.com/store/apps/details?id=com.titanos.myapp`

## If Play says “item not found” / not available

| Check | What to do |
|--------|------------|
| Opt-in | Open testing URL above again |
| Account | Settings → Accounts on phone = invite email |
| Country | Release countries must include theirs |
| Draft | Release must be **Available** / rolled out, not Draft |
| Package | Confirm Console package is `com.titanos.myapp` |

## Upload a new build

```powershell
npm run android:sign
```

Upload **`release/TitanOS.aab`** only (not the APK, not Base44 files).  
Bump `versionCode` in `android/app/build.gradle` before every upload (current: **15** / **1.5.0**).

## If the app installs but login / Google sign-in fails

In Supabase → Authentication → URL configuration, allow:

- `com.titanos.myapp://auth/callback`
- `https://titanfieldos.com/auth/callback` (or your live web origin)
- Your IONOS origin if used for web auth

Enable Email (and Google if you use it) under Auth providers.

## Sideload (backup only)

APK: `release/TitanOS.apk` or site `/static/TitanOS.apk`  
Play Protect may warn — prefer Play for testers.
