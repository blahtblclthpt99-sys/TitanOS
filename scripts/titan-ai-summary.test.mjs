import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerFromSummary, buildBusinessSummary } from "../src/lib/ai-business-summary.js";

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