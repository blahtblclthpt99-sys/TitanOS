import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTitanKnowledgeForPrompt, normalizeKnowledgeQuery } from "../api/_lib/titanKnowledgeContext.js";
import { extractOpenAIResponseText } from "../api/_lib/openaiResponses.js";
import { buildTitanSystemPrompt } from "../api/_lib/aiContext.js";

describe("TitanAI knowledge retrieval contract", () => {
  it("bounds and sanitizes retrieval queries", () => {
    const query = normalizeKnowledgeQuery(`  invoices\n\t${"x".repeat(500)}  `);
    assert.ok(query.startsWith("invoices"));
    assert.ok(query.length <= 300);
    assert.doesNotMatch(query, /\n|\t/);
  });

  it("formats Titan knowledge as platform context, not user memory", () => {
    const text = formatTitanKnowledgeForPrompt([
      {
        classification: "TITAN_KNOWLEDGE",
        domain: "money",
        title: "Invoice workflow",
        content: "Invoices are managed from the invoice workflow.",
        tags: ["invoice"],
        source: "titanos_core",
        quality: 1,
      },
    ]);
    assert.match(text, /TITAN_KNOWLEDGE/);
    assert.match(text, /Invoice workflow/);
  });

  it("keeps retrieved platform knowledge separate from durable memory in the system prompt", () => {
    const prompt = buildTitanSystemPrompt({
      summary: { counts: {}, todaysJobs: [], unpaidInvoices: [], topCustomers: [], collectedThisMonth: 0, outstandingTotal: 0, expensesThisMonth: 0, netThisMonth: 0 },
      memoryContext: [
        { classification: "REMEMBERED", type: "preference", label: "Prefers morning jobs", data: {}, source: "user_memory", confidence: 1, updatedAt: "2026-08-18" },
        { classification: "TITAN_KNOWLEDGE", domain: "jobs", title: "Jobs workflow", content: "Jobs are managed in Jobs and Schedule.", tags: ["jobs"], source: "titanos_core", quality: 1 },
      ],
    });
    assert.match(prompt, /TITAN KNOWLEDGE/);
    assert.match(prompt, /Jobs workflow/);
    assert.match(prompt, /DURABLE MEMORY/);
    assert.match(prompt, /Prefers morning jobs/);
    const durableSection = prompt.split("DURABLE MEMORY (AUTHORIZED USER DATA):")[1]?.split("BUSINESS SNAPSHOT")[0] || "";
    assert.doesNotMatch(durableSection, /Jobs workflow/);
  });
});

describe("OpenAI Responses payload parsing", () => {
  it("extracts SDK-style output_text", () => {
    assert.equal(extractOpenAIResponseText({ output_text: "Titan ready" }), "Titan ready");
  });

  it("extracts raw Responses API message output", () => {
    const payload = { output: [{ type: "message", content: [{ type: "output_text", text: "Titan answer" }] }] };
    assert.equal(extractOpenAIResponseText(payload), "Titan answer");
  });
});
