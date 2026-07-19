import { buildBusinessSummary, answerFromSummary } from "../src/lib/ai-business-summary.js";

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
    { customer_name: "Ada", total: 250, status: "unpaid", due_date: "2026-08-01" },
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

const checks = [
  ["today", "What jobs do I have scheduled today?"],
  ["owe", "Who owes money?"],
  ["rev", "How much revenue have I collected this month?"],
];

let failed = 0;
for (const [name, q] of checks) {
  const ans = answerFromSummary(q, summary);
  if (!ans) {
    console.error("FAIL", name, "no answer");
    failed += 1;
  } else {
    console.log("OK", name, ans.slice(0, 70).replace(/\n/g, " "));
  }
}
process.exit(failed ? 1 : 0);
