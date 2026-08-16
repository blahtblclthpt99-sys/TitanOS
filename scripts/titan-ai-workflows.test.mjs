import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectConfirmIntent } from "../api/functions/titanAI.js";
import { executeAiOfficeAction } from "../api/functions/aiExecuteAction.js";

function insertAdmin(capture) {
  return {
    from(table) {
      return {
        insert(row) {
          capture.table = table;
          capture.row = row;
          return {
            select() {
              return {
                async maybeSingle() {
                  return { data: { id: "test-id", ...row }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("Titan AI workflows", () => {
  it("detects morning ops workflow", () => {
    const cmd = detectConfirmIntent("run morning ops workflow");
    assert.equal(cmd.intent, "run_workflow");
    assert.equal(cmd.params.workflowId, "morning_ops");
    assert.ok(Array.isArray(cmd.params.steps));
    assert.ok(cmd.params.steps.length >= 3);
  });

  it("detects cash recovery workflow", () => {
    const cmd = detectConfirmIntent("run cash recovery sprint");
    assert.equal(cmd.intent, "run_workflow");
    assert.equal(cmd.params.workflowId, "cash_recovery");
    assert.ok(cmd.params.steps.some((step) => step.intent === "send_invoice"));
  });

  it("detects daily closeout workflow", () => {
    const cmd = detectConfirmIntent("run daily closeout workflow");
    assert.equal(cmd.intent, "run_workflow");
    assert.ok(cmd.params.steps.some((step) => step.intent === "record_expense"));
  });

  it("returns clarify when expense amount missing", () => {
    const cmd = detectConfirmIntent("record expense for fuel");
    assert.equal(cmd.type, "clarify");
    assert.match(cmd.message, /need an amount/i);
  });

  it("normalizes hostile estimate line items into a fixed data-only schema", async () => {
    const capture = {};
    await executeAiOfficeAction(insertAdmin(capture), { id: "user-1" }, "create_estimate", {
      total: 125,
      customer_name: "Test Customer",
      line_items: [
        {
          description: "Service",
          qty: 2,
          unit_price: 50,
          total: 100,
          html: "<script>alert(1)</script>",
          nested: { exploit: true },
          url: "javascript:alert(1)",
        },
      ],
    });

    assert.equal(capture.table, "estimates");
    assert.deepEqual(Object.keys(capture.row.line_items[0]).sort(), ["description", "qty", "total", "unit_price"]);
    assert.equal(capture.row.line_items[0].description, "Service");
    assert.equal(capture.row.line_items[0].qty, 2);
  });

  it("rejects non-http receipt URLs", async () => {
    await assert.rejects(
      () => executeAiOfficeAction(insertAdmin({}), { id: "user-1" }, "record_expense", {
        amount: 25,
        description: "Fuel",
        receipt_url: "javascript:alert(1)",
      }),
      /Receipt URL must use http or https/
    );
  });

  it("normalizes malformed job date and time before insert", async () => {
    const capture = {};
    const today = new Date().toISOString().slice(0, 10);
    await executeAiOfficeAction(insertAdmin(capture), { id: "user-1" }, "schedule_job", {
      title: "Bad date test",
      scheduled_date: "2099-99-99",
      scheduled_time: "99:99",
    });

    assert.equal(capture.row.scheduled_date, today);
    assert.equal(capture.row.scheduled_time, "09:00");
  });

  it("rejects malformed customer email instead of storing it", async () => {
    await assert.rejects(
      () => executeAiOfficeAction(insertAdmin({}), { id: "user-1" }, "create_customer", {
        customer_name: "Test Customer",
        email: "not-an-email",
      }),
      /Invalid customer email address/
    );
  });
});