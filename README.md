# TitanOS

**The AI operating system for field service businesses.**

Official TitanOS app — React frontend, Supabase backend, Capacitor Android shell for Google Play (`com.titanos.myapp`).

## Features

| Area | What it does |
|------|----------------|
| Dashboard | Business overview, quick actions |
| Jobs & Schedule | Dispatch and calendar |
| Customers | CRM |
| Invoices & Estimates | Billing |
| Finances & Tax Center | Expenses, mileage, tax tools |
| AI Assistant | Titan AI |
| Marketplace / Fleet / Reports | Growth and ops tools |
| Auth | Email + Google (Supabase Auth) |

## Free launch

The app ships **free**. Monetization hooks live in `src/lib/plan.js` (`FREE_LAUNCH`). Flip that flag and set `profiles.is_pro` when you add paid plans later.

## Setup

1. Copy `.env.example` → `.env.local` and add Supabase keys
2. Run `supabase/migrations/001_titanos_schema.sql` in the Supabase SQL editor
3. Auth → enable Email; optionally enable Google provider
4. Add redirect URLs in Supabase:
   - `http://localhost:5173/auth/callback`
   - `https://YOUR_DOMAIN/auth/callback`
   - `com.titanos.myapp://auth/callback`
5. `npm install` && `npm run dev`

## Google Play

```powershell
npm run android:sign
```

Upload **`release/TitanOS.aab`** to Play Console for package **`com.titanos.myapp`** only.  
Bump `versionCode` in `android/app/build.gradle` before each upload.

**Testers can’t download?** They must open the opt-in link first:

`https://play.google.com/apps/testing/com.titanos.myapp`

Full checklist: [`PLAY_TESTING.md`](./PLAY_TESTING.md).

## IONOS website

```powershell
npm run ionos:package
```

Upload `release/TitanOS-IONOS-Web.zip` contents to your IONOS web root. Keep `.htaccess` so routes/clicks work.

The Android app and website are the same TitanOS product (Supabase-backed).

Privacy policy route: `/privacy-policy` (required for Play).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local web |
| `npm run build` | Production web bundle |
| `npm run ionos:package` | Zip for IONOS hosting |
| `npm run android:build` | Debug APK + release AAB |
| `npm run android:sign` | Signed Play AAB + APK |
| `npm run supabase:check` | Verify tables |
