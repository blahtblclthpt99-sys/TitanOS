import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessCareerReadiness,
  buildInterviewPrepPrompt,
  normalizeSkills,
  profileCompleteness,
} from "../src/lib/careerReadiness.js";

const profile = {
  headline: "Delivery and logistics professional",
  bio: "Experienced route and delivery professional focused on safe, dependable customer service and time-critical work.",
  city: "Oklahoma City",
  state: "OK",
  skills: ["Delivery", "Box Truck", "Customer Service", "delivery"],
  work_history: [
    { role: "Courier", company: "Example Logistics", summary: "Completed scheduled deliveries and route work." },
  ],
};

describe("career readiness", () => {
  it("normalizes and deduplicates skills", () => {
    assert.deepEqual(normalizeSkills(profile.skills), ["delivery", "box truck", "customer service"]);
  });

  it("scores complete seeker-owned profile fields", () => {
    const result = profileCompleteness(profile);
    assert.equal(result.score, 100);
    assert.ok(result.checks.every((item) => item.complete));
  });

  it("flags credentials mentioned by a job but absent from the profile", () => {
    const result = assessCareerReadiness(profile, "CDL Class B required. Box truck delivery and customer service experience preferred.");
    assert.ok(result.missingCredentials.some((item) => item.includes("cdl")));
    assert.ok(result.matchedTerms.includes("delivery"));
  });

  it("never frames readiness as an employer eligibility decision", () => {
    const result = assessCareerReadiness(profile, "Delivery role");
    assert.match(result.disclaimer, /private coaching signal/i);
    assert.match(result.disclaimer, /not an employer decision/i);
  });

  it("interview prompt explicitly prohibits fabricated experience or credentials", () => {
    const prompt = buildInterviewPrepPrompt(profile, "CDL Class B required for delivery work");
    assert.match(prompt, /do not invent experience, credentials, achievements, or employment history/i);
    assert.match(prompt, /CDL/i);
    assert.match(prompt, /Courier at Example Logistics/i);
  });
});
