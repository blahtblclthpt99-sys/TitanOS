import fs from "node:fs";

function replaceOnce(path, before, after) {
  const src = fs.readFileSync(path, "utf8");
  if (!src.includes(before)) throw new Error(`Expected source block not found in ${path}`);
  fs.writeFileSync(path, src.replace(before, after));
}

replaceOnce(
  "api/functions/titanAI.js",
  'import { executeCompensatingWorkflow } from "../_lib/compensatingWorkflow.js";\n',
  'import { executeCompensatingWorkflow } from "../_lib/compensatingWorkflow.js";\nimport { executeIdempotentAction } from "../_lib/actionIdempotency.js";\n'
);

replaceOnce(
  "api/functions/titanAI.js",
  `      try {\n        return res.status(200).json({ data: await executeConfirmedAction(admin, userData.user, confirmedAction) });\n      } catch (execErr) {\n        logError("titanAI:action_execute", execErr);\n        const status = execErr?.status === 400 || execErr?.status === 403 ? execErr.status : 200;\n        if (status !== 200) return res.status(status).json({ error: execErr.message || "Action rejected" });\n        return res.status(200).json({ data: { type: "error", message: "I couldn't save that action. Nothing was silently changed." } });\n      }`,
  `      try {\n        const actionId = confirmedAction.actionId;\n        const data = await executeIdempotentAction({\n          admin,\n          userId: userData.user.id,\n          actionId,\n          intent: confirmedAction.intent,\n          params: confirmedAction.params || {},\n          execute: () => executeConfirmedAction(admin, userData.user, confirmedAction),\n        });\n        return res.status(200).json({ data });\n      } catch (execErr) {\n        logError("titanAI:action_execute", execErr);\n        const allowedStatus = [400, 403, 409, 503].includes(execErr?.status) ? execErr.status : 200;\n        if (allowedStatus !== 200) return res.status(allowedStatus).json({ error: execErr.message || "Action rejected" });\n        return res.status(200).json({ data: { type: "error", message: execErr?.actionCompleted ? execErr.message : "I couldn't save that action. Nothing was silently changed." } });\n      }`
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  'import { confirmedActionErrorMessage, rollbackMessage, shouldRetainRollback } from "@/lib/secondMeActionUi";\n',
  'import { confirmedActionErrorMessage, rollbackMessage, shouldRetainRollback } from "@/lib/secondMeActionUi";\nimport { ensureSecondMeActionId } from "@/lib/secondMeActionId";\n'
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  `            details: data.confirmationDetails || [],\n          },`,
  `            details: data.confirmationDetails || [],\n            actionId: ensureSecondMeActionId({}),\n          },`
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  `    actionInFlightRef.current = true;\n    setConfirming(true);\n    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, type: "executing" } : m)));\n\n    try {`,
  `    actionInFlightRef.current = true;\n    const actionId = ensureSecondMeActionId(confirmMsg.meta);\n    setConfirming(true);\n    setMessages((prev) => prev.map((m, i) => (i === msgIndex ? { ...m, type: "executing", meta: { ...m.meta, actionId } } : m)));\n\n    try {`
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  `        confirmedAction: { intent: confirmMsg.meta.intent, params: confirmMsg.meta.params },`,
  `        confirmedAction: { intent: confirmMsg.meta.intent, params: confirmMsg.meta.params, actionId },`
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  `      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        role: "assistant",\n        content: message,\n        type: "error",\n      } : m));`,
  `      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        ...m,\n        role: "assistant",\n        content: "",\n        type: "confirm",\n        retryError: message,\n        meta: { ...confirmMsg.meta, actionId },\n      } : m));`
);

replaceOnce(
  "src/pages/AIAssistant.jsx",
  `    if (msg.type === "confirm") {\n      return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start"><div className="space-y-2 w-full max-w-2xl"><InvisibleInterface spec={msg.interface} onNavigate={navigate} onPrompt={sendMessage}/><ConfirmationCard summary={msg.meta.summary} details={msg.meta.details} onConfirm={() => handleConfirm(i)} onCancel={() => handleCancel(i)} loading={confirming}/></div></motion.div>;\n    }`,
  `    if (msg.type === "confirm") {\n      return <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start"><div className="space-y-2 w-full max-w-2xl"><InvisibleInterface spec={msg.interface} onNavigate={navigate} onPrompt={sendMessage}/>{msg.retryError ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{msg.retryError} Retry uses the same protected action ID.</div> : null}<ConfirmationCard summary={msg.meta.summary} details={msg.meta.details} onConfirm={() => handleConfirm(i)} onCancel={() => handleCancel(i)} loading={confirming}/></div></motion.div>;\n    }`
);

replaceOnce(
  "package.json",
  "scripts/compensating-workflow.test.mjs scripts/second-me-action-ui.test.mjs",
  "scripts/compensating-workflow.test.mjs scripts/second-me-action-ui.test.mjs scripts/second-me-idempotency.test.mjs"
);
