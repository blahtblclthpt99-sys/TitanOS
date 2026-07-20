# Google Auth setup (required once)

Google sign-in is wired in the app (web + Android). Supabase currently has **Google disabled** until you add a Google Cloud OAuth client.

## 1. Google Cloud Console

1. Open [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create project (or pick existing) → **Create credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
  - `https://titanos-web.vercel.app`
  - `https://titanfieldos.com` (when DNS is live)
  - `http://localhost:5173`
5. Authorized redirect URIs (exact):
  - `https://xcfjpxcmokdfwkarwomy.supabase.co/auth/v1/callback`
6. Copy **Client ID** and **Client secret**



## 2. Supabase Dashboard

1. Open [Authentication → Providers → Google](https://supabase.com/dashboard/project/xcfjpxcmokdfwkarwomy/auth/providers)
2. Enable Google
3. Paste Client ID + Client secret → Save



## 3. Supabase URL allow-list

[Authentication → URL Configuration](https://supabase.com/dashboard/project/xcfjpxcmokdfwkarwomy/auth/url-configuration)

**Site URL:** `https://titanos-web.vercel.app`

**Redirect URLs** (one per line):

```
https://titanos-web.vercel.app
https://titanos-web.vercel.app/auth/callback
https://titanos-web.vercel.app/reset-password
https://titanfieldos.com
https://titanfieldos.com/auth/callback
https://titanfieldos.com/reset-password
http://localhost:5173
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
com.titanos.myapp://auth/callback
```

The app forwards `/?code=…` to `/auth/callback` automatically if Google returns to the Site URL.



## 4. Verify

```bash
node scripts/check-auth.mjs
```

Expect `google: ON`. Then try **Continue with Google** on [https://titanos-web.vercel.app/login](https://titanos-web.vercel.app/login)

## Android note

The app opens Google in the system browser, then returns via `com.titanos.myapp://auth/callback`. That deep link is already in `AndroidManifest.xml`.

## PKCE note

TitanOS uses PKCE with durable storage (Preferences on Android, localStorage on web).  
If you see “PKCE code verifier not found”, retry Google sign-in once — do not start login in one browser and finish in another.