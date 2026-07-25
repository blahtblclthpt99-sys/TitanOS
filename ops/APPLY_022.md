# Apply migration 022 — Driver profiles (required for live directory)

Driver Hub publish/list needs this table on Supabase.

1. Open https://supabase.com/dashboard/project/xcfjpxcmokdfwkarwomy/sql/new  
2. Paste `supabase/migrations/022_driver_profiles.sql` → Run  
3. In the app: Driver Hub → Find drivers → **Go available / publish**

Until 022 is applied, publish will show an error asking you to run the migration. Shift tools still work without it.
