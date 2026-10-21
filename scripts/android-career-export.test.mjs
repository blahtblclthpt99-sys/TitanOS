import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(new URL(file, import.meta.url), "utf8");
const tracker = read("../src/pages/ApplicationTracker.jsx");
const resume = read("../src/pages/ResumeStudio.jsx");
test("applications can be backed up as a JSON file", () => {
  assert.match(tracker, /TitanOS-Applications-Backup\.json/);
  assert.match(tracker, /JSON\.stringify\(\{ version: 1, exportedAt:/);
  assert.match(tracker, /onClick=\{exportRecords\}/);
});
test("resume print stylesheet excludes the editor", () => {
  assert.match(resume, /@media print/);
  assert.match(resume, /\.resume-print-preview/);
  assert.match(resume, /body \* \{ visibility: hidden !important;/);
});
