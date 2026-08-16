import fs from 'node:fs';
const path = 'src/pages/AIAssistant.jsx';
let s = fs.readFileSync(path, 'utf8');
const replacements = [
  [
    'rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || confirmMsg.meta.actionId } : null,',
    'rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || null } : null,'
  ],
  [
    'rollback: data.rollback || null,\n      } : m));',
    'rollback: data.rollback ? { ...data.rollback, correlationId: data.correlationId || data.actionId || actionId } : null,\n        correlationId: data.correlationId || data.actionId || actionId,\n      } : m));'
  ],
  [
    'detail: error?.message || message,\n        });',
    'detail: error?.message || message,\n          correlationId: actionId,\n        });'
  ]
];
for (const [from,to] of replacements) {
  if (!s.includes(from)) throw new Error(`Missing target: ${from.slice(0,80)}`);
  s = s.replace(from,to);
}
fs.writeFileSync(path,s);
