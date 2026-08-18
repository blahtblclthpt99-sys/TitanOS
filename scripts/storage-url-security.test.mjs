import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

describe("private upload bucket URL safety", () => {
  it("never generates public-object URLs for titanos-uploads", () => {
    const src = read("src/api/integrations.js");
    assert.match(src, /UPLOAD_BUCKET\s*=\s*["']titanos-uploads["']/);
    assert.match(src, /createSignedUrl/);
    assert.doesNotMatch(src, /getPublicUrl\s*\(/);
  });

  it("supports legacy public, signed, authenticated, and storage references", () => {
    const src = read("src/api/integrations.js");
    assert.match(src, /\/storage\/v1\/object\/public\//);
    assert.match(src, /\/storage\/v1\/object\/sign\//);
    assert.match(src, /\/storage\/v1\/object\/authenticated\//);
    assert.match(src, /storage:\/\//);
    assert.match(src, /ResolveFileUrl:\s*resolveStoredUploadUrl/);
  });

  it("refreshes profile media before exposing the signed-in user", () => {
    const src = read("src/api/auth.js");
    assert.match(src, /resolveStoredUploadUrl/);
    assert.match(src, /avatar_url:\s*avatarUrl/);
    assert.match(src, /company_logo_url:\s*companyLogoUrl/);
  });

  it("refreshes marketplace media before returning listings", () => {
    const src = read("src/lib/listingsApi.js");
    assert.match(src, /resolveStoredUploadUrls/);
    assert.match(src, /hydrateListingMedia/);
    assert.match(src, /images:\s*images\.filter\(Boolean\)/);
  });
});
