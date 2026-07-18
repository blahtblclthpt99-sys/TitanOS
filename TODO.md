# TitanOS — Follow-Up

## Required before first run

- [ ] Install Node.js 18+ if not present
- [ ] Run `npm install` in project root
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add `public/downloads/TitanOS.apk` for Android downloads
- [ ] Run `npm run lint` and `npm run build` locally

## Recommended follow-up

- [ ] Fleet page: replace hardcoded vehicles with entity data
- [x] Marketplace: connect to real API when available
- [ ] Insurance: migrate localStorage docs to InsuranceDoc entity for sync
- [ ] Payments: wire checkout when paid plans launch
- [ ] Add Vitest/Playwright smoke tests and CI pipeline
- [ ] Verify customer portal OTP against live deployment
