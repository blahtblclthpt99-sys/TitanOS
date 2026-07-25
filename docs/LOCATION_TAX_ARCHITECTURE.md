# TitanOS Intelligent Location & Tax Architecture

**Principle:** Driver Location personalizes the driver experience. Job Location determines sales tax, travel, and service calculations. They never overwrite each other.

## Architecture changes

### Separation of concerns

| Concept | Purpose | Must not do |
|---------|---------|-------------|
| **Driver Location** | Map center, nearby jobs, service radius, timezone, distance units, currency display, weather, notifications | Set sales tax on estimates/invoices |
| **Job Location** | Sales tax jurisdiction, travel distance/time, delivery radius checks, service availability | Be replaced by driver home coords |

### Centralized Tax Engine

- Pure core: `shared/taxEngine.js` (no I/O)
- Client store + helpers: `src/lib/taxEngine.js` (admin-editable rules in `localStorage`, seed catalog default)
- Resolution: most specific matching rule for **Job Location** (postal → city → county → state)
- Documents store a frozen `tax_snapshot` at create time; historical totals stay unless explicitly recalculated
- Tax-exempt customers supported when the rule allows
- Platform Fee Engine (`shared/feeEngine.js`) remains separate (marketplace fees ≠ sales tax)

### Job Location model

- Pure helpers: `shared/jobLocation.js`
- Client geocode/validate: `src/lib/jobLocation.js`
- UI: `src/components/location/JobLocationFields.jsx`
- Persisted on estimates/invoices (`job_location`, `job_*` columns, `tax_snapshot`) via migration `025`

### Driver Location model

- `src/lib/driverLocation.js` — prefs extension (home address, service area, radius, units, timezone, currency)
- UI: `src/components/driver/DriverLocationPanel.jsx` on Driver Hub → My shift
- Syncs legacy `city` / `zip` / `lat` / `lng` for weather & hotspots without touching tax

### Estimate / invoice workflow

1. Select customer (may prefill Job Location from customer address)
2. Confirm / edit **Job Location**
3. Tax Engine resolves jurisdiction → rate (no manual % in normal flow)
4. Totals: subtotal, tax, grand total (+ optional discount / platform fee hooks)
5. Persist `tax_snapshot` + Job Location fields

### Administration

- **Admin → Tax Rules** (`/admin/tax-rules`): CRUD jurisdictions, rates, priority, tax-exempt flag
- Starter catalog is illustrative — verify rates before production charging
- Migration `025` adds optional `tax_rules` table for future server sync

## Files modified / added

### Added
- `shared/taxEngine.js`
- `shared/jobLocation.js`
- `src/lib/taxEngine.js`
- `src/lib/jobLocation.js`
- `src/lib/driverLocation.js`
- `src/components/location/JobLocationFields.jsx`
- `src/components/driver/DriverLocationPanel.jsx`
- `src/pages/AdminTaxRules.jsx`
- `supabase/migrations/025_job_location_tax_engine.sql`
- `scripts/tax-engine.test.mjs`
- `docs/LOCATION_TAX_ARCHITECTURE.md`

### Updated
- `src/lib/moneyDocument.js` — discounts / exempt / `totalsFromTaxResult`
- `src/pages/Estimates.jsx` — Job Location + Tax Engine
- `src/pages/Invoices.jsx` — Job Location + Tax Engine
- `src/pages/DriverHub.jsx` — Driver Location panel
- `src/lib/nav-items.js`, `TabStack.jsx`, `MoreMenu.jsx` — Tax Rules admin route
- `package.json` — `test:tax` script

## Test results

Run:

```bash
node --test scripts/tax-engine.test.mjs
npm run test:money
```

Covered scenarios:
- Different cities / counties / states (Dallas vs Waco, NYC, Chicago)
- Border locations (Texarkana TX vs AR)
- Tax-exempt
- Multiple drivers, identical Job Location → identical tax
- Historical snapshot retention when Job Location later changes
- Travel distance uses Driver Location without changing tax

## Apply migration

```sql
-- See supabase/migrations/025_job_location_tax_engine.sql
```

Until migration is applied, extra columns may be ignored by PostgREST; client still stores what the API accepts and keeps snapshots in document payloads when columns exist.

## Future scalability recommendations

1. Sync `tax_rules` from Supabase (replace localStorage as source of truth)
2. Integrate a certified tax provider (Avalara / TaxJar / Stripe Tax) behind the same `calculateSalesTax` interface
3. Add invoice/estimate “Recalculate tax” explicit action (never silent)
4. Persist Driver Location on `profiles` / `driver_profiles` server-side
5. Booking requests: require Job Location at request time
6. International VAT/GST via country-specific rule packs without redesigning the engine
7. Server-side revalidation of tax on portal pay / Stripe Checkout
