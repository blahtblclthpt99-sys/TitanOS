import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerFromSummary, buildBusinessSummary } from "../src/lib/ai-business-summary.js";
import { buildPersonalizedInsights, getSearchAssistance } from "../src/lib/aiInsights.js";
import { defaultPrivacyPrefs, PRIVACY_OPTIONS, searchSettings } from "../src/lib/settingsCatalog.js";

describe("Titan AI summary signals", () => {
  const summary = buildBusinessSummary({
    jobs: [
      {
        title: "AC Tuneup",
        status: "scheduled",
        scheduled_date: new Date().toISOString().slice(0, 10),
        customer_name: "Ada",
        scheduled_time: "09:00",
      },
    ],
    invoices: [
      { customer_name: "Ada", total: 250, status: "unpaid", due_date: "2026-07-20" },
      {
        customer_name: "Bob",
        total: 100,
        status: "paid",
        paid_at: new Date().toISOString(),
        invoice_date: new Date().toISOString(),
      },
    ],
    customers: [{ first_name: "Ada", last_name: "L", lifetime_value: 5000 }],
    expenses: [{ amount: 40, date: new Date().toISOString() }],
    employees: [{ id: 1 }],
  });

  it("derives a priority signal from the business snapshot", () => {
    assert.ok(summary.prioritySignals);
    assert.equal(summary.prioritySignals.level, "high");
    assert.match(summary.prioritySignals.headline, /Collections need attention/i);
    assert.match(summary.prioritySignals.nextAction, /Open Invoices/i);
  });

  it("answers next-step questions with an operational plan", () => {
    const answer = answerFromSummary("What should I do next?", summary);
    assert.match(answer, /What's next/i);
    assert.match(answer, /Focus/i);
    assert.match(answer, /Collections|Dispatch|Margin/i);
  });
});

describe("Titan opportunity pulse", () => {
  it("keeps proactive Job Matches off until the user explicitly opts in", () => {
    const insights = buildPersonalizedInsights({ todayJobs: [] }, { full_name: "Ada Lovelace" });
    assert.equal(insights.recommendations.some((item) => item.path === "/hire/matches"), false);
    assert.equal(insights.suggestedActions.some((item) => item.path === "/hire/matches"), false);
    assert.ok(insights.recommendations.some((item) => item.path === "/leads"));
  });

  it("surfaces Job Matches after opportunity guidance opt-in without fabricating a match count", () => {
    const insights = buildPersonalizedInsights(
      { todayJobs: [] },
      { full_name: "Ada Lovelace", privacy_prefs: { opportunity_guidance: true } }
    );
    const opportunity = insights.recommendations.find((item) => item.path === "/hire/matches");
    assert.ok(opportunity);
    assert.match(opportunity.title, /Find work that fits you/i);
    assert.match(opportunity.body, /profile-based opportunities/i);
    assert.doesNotMatch(opportunity.body, /\b\d+\s+matches?\b/i);
    assert.ok(insights.suggestedActions.some((item) => item.path === "/hire/matches"));
  });

  it("does not treat unrelated privacy preferences as opportunity consent", () => {
    const insights = buildPersonalizedInsights(
      { todayJobs: [] },
      { full_name: "Ada Lovelace", privacy_prefs: { product_analytics: true, show_in_community: true } }
    );
    assert.equal(insights.recommendations.some((item) => item.path === "/hire/matches"), false);
  });

  it("defines opportunity guidance as an explicit privacy opt-in that defaults off", () => {
    const option = PRIVACY_OPTIONS.find((item) => item.key === "opportunity_guidance");
    assert.ok(option);
    assert.equal(option.default, false);
    assert.equal(defaultPrivacyPrefs().privacy_prefs.opportunity_guidance, false);
    assert.ok(searchSettings("opportunity guidance").options.some((item) => item.id === "settings-privacy-opportunity_guidance"));
  });

  it("includes Job Matches in explicit job-related search guidance", () => {
    const assistance = getSearchAssistance("jobs");
    assert.match(assistance.tip, /Job Matches/);
  });
});
