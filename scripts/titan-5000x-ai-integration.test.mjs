import fs from "node:fs";
import assert from "node:assert/strict";

const server = fs.readFileSync("api/functions/titanAI.js", "utf8");
const client = fs.readFileSync("src/pages/AIAssistant.jsx", "utf8");

assert(!server.includes("owner_autopilot_execute"), "owner autopilot execution bypass must be removed");
assert(!server.includes("ownerMode && (confirm.intent"), "owner mode must not bypass confirmation");
assert(server.includes("buildConfirmationInterface(confirm)"), "confirmation UI must come from server builder");
assert(server.includes("buildInvisibleInterface({ question: lastMessage, summary, pageContext })"), "normal Titan responses must include safe Invisible Interface specs");
assert(client.includes("InvisibleInterface spec={msg.interface}"), "assistant must render Invisible Interface specs");
assert(client.includes("interface: data.interface || null"), "assistant must retain server interface specs");
console.log("Titan 5000X AI integration assertions passed");
