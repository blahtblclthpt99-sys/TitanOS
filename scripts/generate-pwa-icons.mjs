/**
 * Generate maskable PWA icons from the TitanOS circular badge.
 * Circular-masks the badge so light studio corners don't show, then
 * composites onto a full-bleed navy fill (maskable safe zone ~68–72%).
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const badgePath = path.join(root, "public", "brand", "titanos-badge.png");
const outDir = path.join(root, "public");

/** Brand space navy — matches badge interior */
const BG = { r: 11, g: 18, b: 32, alpha: 1 };

function circleMaskSvg(size) {
  const r = size / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
    </svg>`
  );
}

/** Trim light studio padding, square-crop to content, circular-mask. */
async function prepareBadge(targetPx) {
  const trimmed = await sharp(badgePath)
    .trim({ threshold: 28 })
    .png()
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  const side = Math.max(meta.width || 1, meta.height || 1);

  const squared = await sharp(trimmed)
    .resize(side, side, {
      fit: "contain",
      background: { r: 11, g: 18, b: 32, alpha: 1 },
    })
    .png()
    .toBuffer();

  const sized = await sharp(squared)
    .resize(targetPx, targetPx, { fit: "cover" })
    .png()
    .toBuffer();

  return sharp(sized)
    .composite([{ input: circleMaskSvg(targetPx), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function makeIcon(size, outName, { safeRatio = 0.72 } = {}) {
  const content = Math.round(size * safeRatio);
  const badge = await prepareBadge(content);
  const left = Math.round((size - content) / 2);
  const top = Math.round((size - content) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: badge, left, top }])
    .png()
    .toFile(path.join(outDir, outName));

  console.log(`wrote ${outName} (${size}×${size}, content ${content}px)`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  await makeIcon(512, "pwa-512.png", { safeRatio: 0.78 });
  await makeIcon(192, "pwa-192.png", { safeRatio: 0.78 });
  await makeIcon(180, "apple-touch-icon.png", { safeRatio: 0.88 });
  await makeIcon(512, "pwa-512-maskable.png", { safeRatio: 0.7 });
  await makeIcon(192, "pwa-192-maskable.png", { safeRatio: 0.7 });

  const meta = {
    source: "public/brand/titanos-badge.png",
    background: "#0B1220",
    generatedAt: new Date().toISOString(),
    notes: "Circular-masked badge on navy full-bleed for Android adaptive icons",
    files: [
      "pwa-192.png",
      "pwa-512.png",
      "pwa-192-maskable.png",
      "pwa-512-maskable.png",
      "apple-touch-icon.png",
    ],
  };
  await writeFile(
    path.join(root, "docs", "brand", "pwa-icons.json"),
    JSON.stringify(meta, null, 2)
  );
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
