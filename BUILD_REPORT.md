# TitanOS — Build Report

**Project:** TitanOS  
**Release archive:** `release/TitanOS_Production.zip`

## Build Status

Run locally to verify:

```powershell
cd TitanOS
npm install
npm run lint
npm run typecheck
npm run build
npm run package
```

| Check | Command |
|-------|---------|
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Production build | `npm run build` |
| Release zip | `npm run package` |

## Archive contents

**Included:** `src/`, `server/`, `public/`, `dist/`, config files, `package.json`, `package-lock.json`, `.env.example`, documentation

**Excluded:** `node_modules`, `.git`

## Smoke test checklist

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts on http://localhost:5173
- [ ] Login page loads at `/login`
- [ ] Dashboard loads after login at `/`
- [ ] Sidebar routes navigate (Jobs, Customers, Invoices, Marketplace)
- [ ] **Download App** button triggers APK download
- [ ] Create customer, job, invoice
- [ ] Public pricing page at `/pricing`
- [ ] Marketplace install/remove flow

## First-run setup

1. Extract the zip
2. `npm install`
3. Copy `.env.example` to `.env.local`
4. Place `TitanOS.apk` in `public/downloads/`
5. `npm run dev`
