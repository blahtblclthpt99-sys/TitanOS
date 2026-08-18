import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

describe("TitanOS production host configuration", () => {
  const env = read(".env.production.example");
  const cors = read("api/_lib/cors.js");
  const authRedirect = read("src/lib/auth-redirect.js");
  const updateGate = read("src/components/shared/AppUpdateGate.jsx");
  const wrangler = read("wrangler.jsonc");

  it("uses TitanfieldOS as the canonical public and API origin", () => {
    assert.match(env, /VITE_TITANOS_PUBLIC_ORIGIN=https:\/\/titanfieldos\.com/);
    assert.match(env, /VITE_API_BASE_URL=https:\/\/titanfieldos\.com/);
    assert.match(cors, /https:\/\/titanfieldos\.com/);
    assert.match(authRedirect, /https:\/\/titanfieldos\.com/);
    assert.match(updateGate, /https:\/\/titanfieldos\.com/);
  });

  it("preserves native OAuth while moving web OAuth to TitanfieldOS", () => {
    assert.match(authRedirect, /com\.titanos\.myapp:\/\/auth\/callback/);
    assert.match(authRedirect, /https:\/\/www\.titanfieldos\.com/);
  });

  it("builds production from dist on Cloudflare Pages", () => {
    assert.match(wrangler, /"pages_build_output_dir"\s*:\s*"\.\/dist"/);
    assert.match(wrangler, /"nodejs_compat"/);
  });

  it("does not use the old Vercel hostname as a canonical runtime fallback", () => {
    for (const [name, source] of [
      ["production env", env],
      ["CORS", cors],
      ["auth redirect", authRedirect],
      ["update gate", updateGate],
    ]) {
      assert.doesNotMatch(source, /titanos-web\.vercel\.app/, `${name} still depends on the old Vercel host`);
    }
  });
});
