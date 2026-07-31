# Legacy CSV Import Runbook (AAB-Safe)

This runbook imports your legacy CSV exports into TitanOS/Supabase without rebuilding or modifying the accepted Android App Bundle.

## Safety guarantees

- This flow does not run Android build or signing scripts.
- This flow does not edit or overwrite `bin/static/TitanOS.aab`.
- Bundle integrity can be validated with `npm run aab:fingerprint`.

## Files added for this flow

- `supabase/migrations/039_legacy_csv_archives.sql`
- `scripts/import-legacy-csv.mjs`
- `scripts/aab-fingerprint.mjs`

## 1) Capture AAB baseline checksum

```powershell
npm run aab:fingerprint
```

Output is written to `ops/aab-baseline.json`.

## 2) Apply migration 039 in Supabase

Open Supabase SQL Editor and run:

- `supabase/migrations/039_legacy_csv_archives.sql`

This creates additive archive tables plus id-mapping records. No existing production tables are dropped or changed.

## 3) Set import owner user id

Mapped rows for customers/jobs/invoices/expenses/equipment are written with a current TitanOS owner uuid.

Quick start: copy `.env.legacy-import.example` values into `.env.local`.

Add this to `.env.local`:

```env
MIGRATION_OWNER_USER_ID=YOUR_AUTH_USER_UUID
```

You can also pass it at runtime with `--ownerUserId`.

## 4) Run legacy CSV import

Default source folder is `%USERPROFILE%/Downloads`.

```powershell
npm run import:legacy-csv
```

Or with explicit source directory:

```powershell
node scripts/import-legacy-csv.mjs --sourceDir "C:\Users\Karen Lafferty\Downloads"
```

To also archive root-level non-test Python learning scripts:

```powershell
node scripts/import-legacy-csv.mjs --archiveLearningScripts
```

## 5) Confirm import report

The importer prints JSON with per-file counts:

- `rows`
- `mappedInserted`
- `mappedSkipped`
- `archivedInserted`

Empty CSVs are reported as `status: "empty"` and treated as success.

## Mapping behavior

### Mapped into existing runtime tables

- `Customer_export.csv` -> `customers`
- `Job_export.csv` -> `jobs`
- `Invoice_export.csv` -> `invoices`
- `Expense_export.csv` -> `expenses`
- `Vehicle_export.csv` -> `equipment` (category=`vehicle`)

### Archived into additive legacy tables

- `VehicleCapacity_export.csv` -> `legacy_vehicle_capacity`
- `AreaStat_export.csv` -> `legacy_area_stats`
- `AuditLog_export.csv` -> `legacy_audit_logs`
- `Base44Purchase_export.csv` -> `legacy_base44_purchases`
- `FuelLog_export.csv` -> `legacy_fuel_logs`
- `GigOrder_export.csv` -> `legacy_gig_orders`
- `Reminder_export (1).csv` -> `legacy_reminders`
- `Shift_export.csv` -> `legacy_shifts`
- `TeamMember_export.csv` -> `legacy_team_members`

## Idempotency

- Mapped entities use `legacy_import_id_map` to avoid duplicate imports by `entity_name + source_id`.
- Archive tables use `source_file + source_hash` unique constraints.

## Post-import validation

- Open Customers, Jobs, Invoices, Expenses, Fleet in TitanOS and confirm data is visible.
- Re-run checksum:

```powershell
npm run aab:fingerprint
```

If `sha256` and `bytes` match `ops/aab-baseline.json`, your accepted AAB was not compromised.

## Important

Do not run `npm run android:build` or `npm run android:sign` in this migration flow.
