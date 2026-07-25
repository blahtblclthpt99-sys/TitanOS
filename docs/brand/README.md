# TitanOS brand assets

## Logos (`public/brand/`)

| File | Use |
|------|-----|
| `titanos-stacked.png` | Auth, landing hero (shield above wordmark) |
| `titanos-horizontal.png` | Settings / wide headers |
| `titanos-badge.png` | Circular sticker / splash / PWA source |
| `titanos-badge-alt.png` | Alternate badge |
| `titanos-mark-glow.png` | Glow mark for dark surfaces |
| `titanos-apparel.png` | Merch / apparel reference |

## PWA icons (`public/`)

Generated from the badge via `npm run icons:pwa` (`scripts/generate-pwa-icons.mjs`):

| File | Purpose |
|------|---------|
| `pwa-192.png` / `pwa-512.png` | `purpose: any` |
| `pwa-192-maskable.png` / `pwa-512-maskable.png` | Android adaptive (`purpose: maskable`) |
| `apple-touch-icon.png` | iOS home screen |

Full-bleed navy `#0B1220` with circular-masked badge in the safe zone.

## React components (`src/components/brand/`)

- `TitanMark` — SVG shield (theme-aware)
- `TitanWordmark` — Titan + cyan OS
- `TitanBrandLogo` — lockups (`svg` \| `stacked` \| `horizontal` \| `badge` \| `glow`)
- `ThemeToggle` — system / light / dark

## UI references

Screenshots used as dark-theme product reference live in `docs/brand/ui-references/`.
App chrome should stay on design tokens (`bg-background`, `text-foreground`, …) so light mode works.
