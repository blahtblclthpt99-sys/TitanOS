import fs from "node:fs";

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from, to);
}

const pagePath = "src/pages/AIAssistant.jsx";
let page = fs.readFileSync(pagePath, "utf8");

page = replaceOnce(
  page,
  'import { upsertSearchDocs } from "@/lib/searchIndex";\n',
  'import { upsertSearchDocs } from "@/lib/searchIndex";\nimport { confirmedActionErrorMessage, rollbackMessage, shouldRetainRollback } from "@/lib/secondMeActionUi";\n',
  "action UI helper import"
);

page = replaceOnce(
  page,
  '  const seededQ = useRef(false);\n',
  '  const seededQ = useRef(false);\n  const actionInFlightRef = useRef(false);\n',
  "action in-flight ref"
);

page = replaceOnce(
  page,
  '  const handleConfirm = async (msgIndex) => {\n    const confirmMsg = messages[msgIndex];\n    if (!confirmMsg?.meta) return;\n    setConfirming(true);\n',
  '  const handleConfirm = async (msgIndex) => {\n    const confirmMsg = messages[msgIndex];\n    if (!confirmMsg?.meta || actionInFlightRef.current) return;\n    actionInFlightRef.current = true;\n    setConfirming(true);\n',
  "confirm double-submit guard"
);

page = replaceOnce(
  page,
  '    } catch {\n      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        role: "assistant",\n        content: "That action failed safely. Nothing was assumed or silently changed.",\n        type: "error",\n      } : m));\n    } finally {\n      setConfirming(false);\n    }\n',
  '    } catch (error) {\n      const message = confirmedActionErrorMessage(error);\n      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        role: "assistant",\n        content: message,\n        type: "error",\n      } : m));\n      if (user?.id && ownerMode) {\n        appendTitanActionLog(user.id, {\n          status: "error",\n          title: "Confirmed action failed",\n          detail: error?.message || message,\n        });\n        refreshOpsState();\n      }\n    } finally {\n      actionInFlightRef.current = false;\n      setConfirming(false);\n    }\n',
  "confirm error clarity"
);

page = replaceOnce(
  page,
  '  const handleRollback = async (msgIndex) => {\n    const row = messages[msgIndex];\n    const rollback = row?.rollback;\n    if (!rollback || !user?.id || !ownerMode || rollbackingId) return;\n    setRollbackingId(row?.rollback?.id || `msg-${msgIndex}`);\n',
  '  const handleRollback = async (msgIndex) => {\n    const row = messages[msgIndex];\n    const rollback = row?.rollback;\n    if (!rollback || !user?.id || !ownerMode || rollbackingId || actionInFlightRef.current) return;\n    actionInFlightRef.current = true;\n    setRollbackingId(row?.rollback?.id || `msg-${msgIndex}`);\n',
  "rollback double-submit guard"
);

page = replaceOnce(
  page,
  '      const data = result.data || {};\n      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        ...m,\n        content: `${m.content}\\n\\nRollback: ${data.message || "completed."}`,\n        rollback: null,\n      } : m));\n',
  '      const data = result.data || {};\n      const retainRollback = shouldRetainRollback(data);\n      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        ...m,\n        content: rollbackMessage(m.content, data),\n        rollback: retainRollback ? m.rollback : null,\n      } : m));\n',
  "retain failed rollback"
);

page = replaceOnce(
  page,
  '      refreshOpsState();\n      loadBusinessData();\n    } finally {\n      setRollbackingId(null);\n    }\n  };\n',
  '      refreshOpsState();\n      if (!shouldRetainRollback(data)) loadBusinessData();\n    } catch (error) {\n      const data = { type: "error", message: error?.message || "Rollback could not be completed." };\n      setMessages((prev) => prev.map((m, i) => i === msgIndex ? {\n        ...m,\n        content: rollbackMessage(m.content, data),\n        rollback: m.rollback,\n      } : m));\n      appendTitanActionLog(user.id, {\n        status: "error",\n        title: "Rollback failed",\n        detail: data.message,\n      });\n      refreshOpsState();\n    } finally {\n      actionInFlightRef.current = false;\n      setRollbackingId(null);\n    }\n  };\n',
  "rollback catch and reload policy"
);

fs.writeFileSync(pagePath, page);

const packagePath = "package.json";
let pkg = fs.readFileSync(packagePath, "utf8");
pkg = replaceOnce(
  pkg,
  'scripts/titan-ai-api-contract.test.mjs scripts/compensating-workflow.test.mjs",',
  'scripts/titan-ai-api-contract.test.mjs scripts/compensating-workflow.test.mjs scripts/second-me-action-ui.test.mjs",',
  "test:ai registration"
);
fs.writeFileSync(packagePath, pkg);
