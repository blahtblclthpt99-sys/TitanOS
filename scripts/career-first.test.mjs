import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function source(path) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
const landing = source("src/pages/Landing.jsx");
const routes = source("src/components/layout/TabStack.jsx");
const nav = source("src/lib/nav-items.js");
const home = source("src/pages/CareerHome.jsx");
const builder = source("src/pages/ResumeBuilder.jsx");
const entry = source("src/main.jsx");

test("TitanOS opens a jobs-first career home rather than the advertising product", () => {
  assert.match(routes, /pages\/CareerHome/);
  assert.match(home, /Find jobs/);
  assert.match(landing, /Jobs & Careers/);
  assert.doesNotMatch(landing, /Start earning|attention marketplace|sponsor campaign/i);
  assert.doesNotMatch(home, /Earn from campaigns|advertiser dashboard/i);
});

test("job search, matching and résumé builder appear in primary navigation", () => {
  assert.match(nav, /label: "Find Jobs", path: "\/hire"/);
  assert.match(nav, /label: "Job Matches", path: "\/hire\/matches"/);
  assert.match(nav, /label: "Résumé Builder", path: "\/resume"/);
  const publicNav = nav.split("export const APP_NAV_ITEMS = [")[1].split("\n];")[0];
  assert.doesNotMatch(publicNav, /Advertising|Campaigns|Promoted|Sponsored|Driver Hub|Invoices/);
});

test("résumé editor is routed, account-scoped and exportable", () => {
  assert.match(routes, /"\/resume": ResumeBuilder/);
  assert.match(builder, /titanos:resume:v1:/);
  assert.match(builder, /localStorage\.setItem/);
  assert.match(builder, /window\.print\(\)/);
  assert.match(builder, /new Blob/);
  assert.match(builder, /draft\.experience/);
  assert.match(builder, /draft\.education/);
  assert.match(builder, /draft\.certifications/);
});

test("app bootstrap does not purge prior TitanOS storage during a jobs-first rollout", () => {
  assert.doesNotMatch(entry, /removeLegacyStorageKeys|purgeLegacyClientState|titan-attention:legacy-client-state-purged/);
});

test("job matching and application UI remain available", () => {
  const matches = source("src/pages/JobMatches.jsx");
  const hire = source("src/pages/Hire.jsx");
  assert.match(routes, /"\/hire\/matches": JobMatches/);
  assert.match(routes, /"\/hire": Hire/);
  assert.match(hire, /"applications"/);
  assert.match(matches, /getJobMatches/);
});