import fs from "node:fs";

const titanPath = "api/functions/titanAI.js";
let titan = fs.readFileSync(titanPath, "utf8");

const importNeedle = `} from "../_lib/secondMeMemoryActions.js";`;
const importReplacement = `${importNeedle}\nimport { executeCompensatingWorkflow } from "../_lib/compensatingWorkflow.js";`;
if (!titan.includes(importReplacement)) {
  if (!titan.includes(importNeedle)) throw new Error("Could not find titanAI import anchor");
  titan = titan.replace(importNeedle, importReplacement);
}

const oldBlock = `async function executeWorkflow(admin, user, params = {}) {
  const steps = Array.isArray(params.steps) ? params.steps : [];
  if (steps.length < 1 || steps.length > 10) {
    const err = new Error("Workflow steps are invalid.");
    err.status = 400;
    throw err;
  }
  const { executeAiOfficeAction } = await import("./aiExecuteAction.js");
  const results = [];
  for (const step of steps) {
    const intent = String(step?.intent || "");
    if (!isAllowedAiIntent(intent) || intent === "remember_memory" || intent === "create_memory_rule") {
      const err = new Error(\`Workflow step intent is not allowed: \${intent || "unknown"}\`);
      err.status = 400;
      throw err;
    }
    const result = await executeAiOfficeAction(admin, user, intent, step?.params || {});
    results.push({ intent, ...result });
  }
  return {
    type: "workflow_done",
    workflowId: String(params.workflowId || "custom"),
    message: \`Workflow complete: \${results.length} step(s) executed.\`,
    steps: results,
    rollback: { kind: "workflow", steps: results.map((r) => r.rollback).filter(Boolean).reverse() },
  };
}`;

const newBlock = `async function executeWorkflow(admin, user, params = {}) {
  const steps = Array.isArray(params.steps) ? params.steps : [];
  const { executeAiOfficeAction, rollbackAiOfficeAction } = await import("./aiExecuteAction.js");

  const results = await executeCompensatingWorkflow({
    steps,
    executeStep: async (step) => {
      const intent = String(step?.intent || "");
      if (!isAllowedAiIntent(intent) || intent === "remember_memory" || intent === "create_memory_rule" || intent === "run_workflow") {
        const err = new Error(\`Workflow step intent is not allowed: \${intent || "unknown"}\`);
        err.status = 400;
        throw err;
      }
      const result = await executeAiOfficeAction(admin, user, intent, step?.params || {});
      return { intent, ...result };
    },
    rollbackStep: async (rollback) => rollbackAiOfficeAction(admin, user, rollback),
  });

  return {
    type: "workflow_done",
    workflowId: String(params.workflowId || "custom"),
    message: \`Workflow complete: \${results.length} step(s) executed.\`,
    steps: results,
    rollback: { kind: "workflow", steps: results.map((r) => r.rollback).filter(Boolean).reverse() },
  };
}`;

if (!titan.includes(newBlock)) {
  if (!titan.includes(oldBlock)) throw new Error("Could not find executeWorkflow block");
  titan = titan.replace(oldBlock, newBlock);
}
fs.writeFileSync(titanPath, titan);

const packagePath = "package.json";
let pkg = fs.readFileSync(packagePath, "utf8");
const testNeedle = "scripts/titan-ai-api-contract.test.mjs";
const testReplacement = `${testNeedle} scripts/compensating-workflow.test.mjs`;
if (!pkg.includes(testReplacement)) {
  if (!pkg.includes(testNeedle)) throw new Error("Could not find test:ai anchor");
  pkg = pkg.replace(testNeedle, testReplacement);
  fs.writeFileSync(packagePath, pkg);
}

console.log("Applied workflow atomicity patch.");
