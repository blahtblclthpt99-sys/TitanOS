import test from "node:test";
import assert from "node:assert/strict";
import {
  buildApplicationPackage,
  buildCoverLetter,
  buildMasterResume,
  matchingEvidence,
} from "../src/lib/resumeBuilder.js";

const profile = {
  display_name: "Test Applicant",
  headline: "Delivery professional",
  city: "Oklahoma City",
  state: "OK",
  bio: "Experienced delivery professional with customer service background.",
  skills: ["Delivery", "Customer service", "Box truck"],
  work_history: [{ role: "Courier", company: "Example Logistics", start: "2022", end: "2026", summary: "Delivered time-sensitive packages using a box truck." }],
  achievements: [{ title: "Attendance", description: "Maintained reliable attendance." }],
};

test("master resume only uses supplied profile evidence", () => {
  const resume = buildMasterResume(profile);
  assert.match(resume, /Test Applicant/);
  assert.match(resume, /Example Logistics/);
  assert.doesNotMatch(resume, /CDL Class A/i);
});

test("matching evidence is limited to terms present in both job and profile", () => {
  const evidence = matchingEvidence(profile, "Seeking box truck delivery driver with forklift and hazmat certification");
  assert.ok(evidence.includes("box"));
  assert.ok(evidence.includes("truck"));
  assert.ok(evidence.includes("delivery"));
  assert.ok(!evidence.includes("forklift"));
  assert.ok(!evidence.includes("hazmat"));
});

test("cover letter does not invent missing credentials", () => {
  const letter = buildCoverLetter(profile, "CDL Class A and hazmat required", { role: "Driver", company: "Acme" });
  assert.match(letter, /Driver/);
  assert.match(letter, /Acme/);
  assert.doesNotMatch(letter, /I have.*CDL|I hold.*CDL|hazmat certified/i);
});

test("application package declares truthful tailoring policy", () => {
  const pkg = buildApplicationPackage(profile, "Box truck delivery", { role: "Driver" });
  assert.match(pkg.policy, /never invented/i);
  assert.ok(pkg.tailoredResume.length > 0);
  assert.ok(pkg.coverLetter.length > 0);
  assert.ok(pkg.interviewBrief.length > 0);
});
