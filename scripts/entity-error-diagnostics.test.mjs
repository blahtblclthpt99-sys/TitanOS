import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";

const source = readFileSync(new URL("../src/api/entityAdapter.js", import.meta.url), "utf8");
const section = source.match(/function apiError\([\s\S]*?(?=async function currentUserId)/)?.[0];
assert.ok(section, "Error conversion helpers must remain discoverable");
const convert = runInNewContext(section + "\nthrowIfError", { Error, Number, String });

for (const [input, expected] of [
  [{ status: 401, message: "secret session detail" }, 401],
  [{ code: "42501", message: "private SQL details" }, 403],
  [{ code: "42P01", message: "relation private_data missing" }, 404],
  [{ code: "PGRST205", message: "schema details" }, 404],
  [{ status: 503, message: "internal service host" }, 503],
]) {
  test(`backend failure is categorized as ${expected} without leaking details`, () => {
    assert.throws(() => convert(input), (error) => {
      assert.equal(error.status, expected);
      assert.doesNotMatch(error.message, /secret|private|relation|schema|internal service host/i);
      return true;
    });
  });
}
test("PostgREST error code remains available for safe UI categories", () => {
  assert.throws(() => convert({ code: "PGRST205", message: "hidden" }), (error) => {
    assert.equal(error.code, "PGRST205");
    return true;
  });
});
