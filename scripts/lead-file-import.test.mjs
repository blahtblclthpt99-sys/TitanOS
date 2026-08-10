import assert from "node:assert/strict";
import test from "node:test";
import { parseLeadsCsv, parseLeadsText } from "../src/lib/leadImportApi.js";

test("CSV import maps named columns and ignores invalid emails", () => {
  const rows = parseLeadsCsv('company,email,name,phone\nTitan Co,WORK@Example.com,Jane,555-0100\nBad,nope,Invalid,');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "work@example.com");
  assert.equal(rows[0].name, "Jane");
  assert.equal(rows[0].company, "Titan Co");
});

test("TXT and PDF text extraction keeps unique valid emails", () => {
  const rows = parseLeadsText("Contact One@Example.com or one@example.com and sales@titanos.test.");
  assert.deepEqual(rows.map((row) => row.email), ["one@example.com", "sales@titanos.test"]);
});
