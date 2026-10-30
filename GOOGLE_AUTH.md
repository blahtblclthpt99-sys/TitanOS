# TitanOS Google Authentication

## Production Supabase project

The Android release must use the active production Supabase project:

- Project ref: `xcfjpxcmokdfwkarwomy`
- API URL: `https://xcfjpxcmokdfwkarwomy.supabase.co`
- Google OAuth callback: `https://xcfjpxcmokdfwkarwomy.supabase.co/auth/v1/callback`
- Native app callback: `com.titanos.myapp://auth/callback`

Do not build Android releases against the retired Recovery Staging project
`wbymywwrpbljfbsemung`. That hostname previously returned DNS NXDOMAIN and
prevented Google sign-in from starting.

## Google Cloud OAuth client

Supabase Google provider uses a **Web application** OAuth client:

1. Authorized redirect URI must include the production Supabase callback above.
2. Supabase Authentication → Providers → Google must be enabled and contain that
   Web client ID and client secret.
3. Keep the app callback `com.titanos.myapp://auth/callback` in Supabase
   Authentication → URL Configuration → Redirect URLs.

If using native Google SDK sign-in instead of Supabase browser OAuth, configure
an Android OAuth client for package `com.titanos.myapp` and the SHA-1 of the
Play signing certificate. TitanOS currently uses Supabase browser OAuth and its
custom-scheme callback.

## Release verification

Codemagic now validates the production Supabase hostname and publishable-key
format before building. Verify the provider and OAuth URL using:

```bash
node scripts/check-auth.mjs
```

The check should report `google: ON` and `Google OAuth URL OK`. Then test on
the installed Android release: Google account chooser → consent → return to
TitanOS → authenticated Career Home.

Never commit a Google OAuth client secret, Supabase service-role key, or other
server secret to the repository.
