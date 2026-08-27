import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCareerPipelineDetails } from "../src/lib/careerPipelineDetails.js";

test("normalizes valid pipeline dates to ISO and trims notes", () => {
  const result = normalizeCareerPipelineDetails({
    interviewAt: "2026-08-27T09:30",
    followUpAt: "2026-08-28T14:00",
    notes: "  Call recruiter after interview.  ",
  });
  assert.match(result.interview_at, /^2026-08-27T/);
  assert.match(result.follow_up_at, /^2026-08-28T/);
  assert.equal(result.private_notes, "Call recruiter after interview.");
});

test("rejects malformed pipeline dates before persistence", () => {
  assert.throws(
    () => normalizeCareerPipelineDetails({ interviewAt: "not-a-date" }),
    /Interview time is not a valid date and time/,
  );
  assert.throws(
    () => normalizeCareerPipelineDetails({ followUpAt: "2026-99-99" }),
    /Follow-up time is not a valid date and time/,
  );
});

test("bounds private notes and converts empty values to null", () => {
  assert.equal(normalizeCareerPipelineDetails({ notes: "   " }).private_notes, null);
  assert.equal(normalizeCareerPipelineDetails({ notes: "x".repeat(6000) }).private_notes.length, 5000);
  assert.equal(normalizeCareerPipelineDetails({}).interview_at, null);
  assert.equal(normalizeCareerPipelineDetails({}).follow_up_at, null);
});
