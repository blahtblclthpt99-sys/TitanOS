import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch target: ${label}`);
  return text.replace(from, to);
}

let server = fs.readFileSync('api/functions/titanAI.js', 'utf8');
server = replaceOnce(server,
'import { executeIdempotentAction } from "../_lib/actionIdempotency.js";',
'import { executeIdempotentAction, listActionHistory } from "../_lib/actionIdempotency.js";',
'idempotency import');
server = replaceOnce(server,
'    const { messages = [], confirmedAction = null, rollbackAction = null, lawMastermind = false, guardrails = {} } = body;\n',
'    const { messages = [], confirmedAction = null, rollbackAction = null, historyRequest = false, lawMastermind = false, guardrails = {} } = body;\n',
'body destructure');
server = replaceOnce(server,
'    const killSwitchOn = Boolean(guardrails?.killSwitch);\n\n    if (rollbackAction) {',
'    const killSwitchOn = Boolean(guardrails?.killSwitch);\n\n    if (historyRequest) {\n      try {\n        const items = await listActionHistory(admin, userData.user.id, body.historyLimit || 8);\n        return res.status(200).json({ data: { type: "action_history", items } });\n      } catch (historyErr) {\n        logError("titanAI:action_history", historyErr);\n        captureApiException(historyErr, { tags: { route: "titanAI", phase: "action_history" } });\n        return res.status(200).json({ data: { type: "action_history", items: [] } });\n      }\n    }\n\n    if (rollbackAction) {',
'history route');
server = replaceOnce(server,
'        return res.status(200).json({ data: await executeRollback(admin, userData.user, rollbackAction) });',
'        const data = await executeRollback(admin, userData.user, rollbackAction);\n        const correlationId = String(rollbackAction?.correlationId || "").slice(0, 128) || null;\n        return res.status(200).json({ data: correlationId ? { ...data, correlationId } : data });',
'rollback result');
server = replaceOnce(server,
'        logError("titanAI:rollback", execErr);',
'        logError("titanAI:rollback", execErr);\n        captureApiException(execErr, { tags: { route: "titanAI", phase: "rollback", correlation_id: String(rollbackAction?.correlationId || "unknown") } });',
'rollback sentry');
server = replaceOnce(server,
'        logError("titanAI:action_execute", execErr);',
'        logError("titanAI:action_execute", execErr);\n        captureApiException(execErr, { tags: { route: "titanAI", phase: "confirmed_action", intent: String(confirmedAction.intent || "unknown"), correlation_id: String(execErr?.correlationId || confirmedAction?.actionId || "unknown") } });',
'action sentry');
fs.writeFileSync('api/functions/titanAI.js', server);

let ui = fs.readFileSync('src/pages/AIAssistant.jsx', 'utf8');
ui = replaceOnce(ui,
'  const [rollbackingId, setRollbackingId] = useState(null);\n',
'  const [rollbackingId, setRollbackingId] = useState(null);\n  const [actionHistory, setActionHistory] = useState([]);\n',
'history state');
ui = replaceOnce(ui,
'  const refreshOpsState = useCallback(() => {\n',
'  const loadActionHistory = useCallback(async () => {\n    if (!user?.id || lawMastermind) { setActionHistory([]); return; }\n    try {\n      const result = await api.functions.invoke("titanAI", { messages: [], historyRequest: true, historyLimit: 6, secondSelf: true });\n      setActionHistory(Array.isArray(result?.data?.items) ? result.data.items : []);\n    } catch {\n      setActionHistory([]);\n    }\n  }, [lawMastermind, user?.id]);\n\n  useEffect(() => { void loadActionHistory(); }, [loadActionHistory]);\n\n  const refreshOpsState = useCallback(() => {\n',
'history loader');
ui = replaceOnce(ui,
'          rollback: data.rollback || null,\n',
'          rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || confirmMsg.meta.actionId } : null,\n',
'confirm rollback correlation');
ui = replaceOnce(ui,
'          rollback: data.rollback || null,\n        });\n        refreshOpsState();',
'          rollback: data.rollback || null,\n          correlationId: data.correlationId || data.actionId || confirmMsg.meta.actionId,\n        });\n        refreshOpsState();',
'confirm log correlation');
ui = replaceOnce(ui,
'      if (!isError) loadBusinessData();\n',
'      if (!isError) { loadBusinessData(); void loadActionHistory(); }\n',
'confirm history refresh');
ui = replaceOnce(ui,
'        rollbackAction: rollback,\n',
'        rollbackAction: { ...rollback, correlationId: rollback.correlationId || row?.correlationId || null },\n',
'rollback payload correlation');
ui = replaceOnce(ui,
'        detail: data.message || "Rollback result.",\n',
'        detail: data.message || "Rollback result.",\n        correlationId: data.correlationId || rollback.correlationId || null,\n',
'rollback log correlation');
ui = replaceOnce(ui,
'      if (!shouldRetainRollback(data)) loadBusinessData();\n',
'      if (!shouldRetainRollback(data)) { loadBusinessData(); void loadActionHistory(); }\n',
'rollback history refresh');
ui = replaceOnce(ui,
'      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">',
'      {!lawMastermind && actionHistory.length > 0 ? <div className="px-4 md:px-8 pt-3 flex-shrink-0"><div className="max-w-4xl mx-auto rounded-xl border border-border bg-card/50 px-3 py-2"><div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Recent 2nd Me actions</div><div className="flex gap-2 overflow-x-auto pb-1">{actionHistory.map((item) => <div key={item.correlationId} className="min-w-[180px] rounded-lg bg-background/70 border border-border px-2.5 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold truncate">{String(item.intent || "action").replaceAll("_", " ")}</span><span className={`text-[10px] ${item.status === "completed" ? "text-emerald-500" : item.status === "failed" ? "text-destructive" : "text-amber-500"}`}>{item.status}</span></div><div className="text-[10px] text-muted-foreground mt-1 truncate">{item.message}</div><div className="text-[9px] text-muted-foreground/70 mt-1 font-mono" title={item.correlationId}>ID {String(item.correlationId).slice(-10)}</div></div>)}</div></div></div> : null}\n\n      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">',
'history UI');
fs.writeFileSync('src/pages/AIAssistant.jsx', ui);
