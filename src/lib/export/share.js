/**
 * Shareable report snapshots — tokenized local links (same browser / device).
 * Cloud email share is scheduled separately and labeled honestly.
 */
import { readLocal, writeLocal, uid } from "@/lib/localStore";
import { toCsv } from "@/lib/export/csv";

const PREFIX = "titanos_report_share";

function allShares() {
  return readLocal(PREFIX, "global", "tokens", {});
}

function saveShares(map) {
  writeLocal(PREFIX, "global", "tokens", map);
}

/**
 * Persist a lightweight snapshot and return a relative share path.
 */
export function createReportShare(userId, spec) {
  if (!userId) throw new Error("Sign in to create a share link");
  const rows = typeof spec.getRows === "function" ? spec.getRows() : spec.rows || [];
  const columns = spec.columns || [];
  const token = uid().replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || uid();
  const snapshot = {
    token,
    owner_id: userId,
    title: spec.title || "TitanOS Report",
    subtitle: spec.subtitle || "",
    module: spec.id || "report",
    columns: columns.map((c) => c.label),
    // Store rendered cell strings so the share page doesn't need column fns
    rows: rows.slice(0, 500).map((row) => columns.map((c) => {
      const v = c.value(row);
      return v == null ? "" : String(v);
    })),
    csv: toCsv(rows.slice(0, 500), columns),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const map = allShares();
  map[token] = snapshot;
  // Cap store
  const keys = Object.keys(map);
  if (keys.length > 40) {
    keys
      .sort((a, b) => String(map[a].created_at).localeCompare(String(map[b].created_at)))
      .slice(0, keys.length - 40)
      .forEach((k) => delete map[k]);
  }
  saveShares(map);
  return {
    token,
    path: `/share/report/${token}`,
    url: typeof window !== "undefined" ? `${window.location.origin}/share/report/${token}` : `/share/report/${token}`,
    expires_at: snapshot.expires_at,
    deviceOnly: true,
  };
}

export function getReportShare(token) {
  const snap = allShares()[token];
  if (!snap) return null;
  if (snap.expires_at && new Date(snap.expires_at).getTime() < Date.now()) return null;
  return snap;
}

export async function copyReportShareLink(userId, spec) {
  const share = createReportShare(userId, spec);
  const text = share.url;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
  if (navigator?.share) {
    try {
      await navigator.share({ title: spec.title || "TitanOS Report", url: text, text: spec.subtitle || "" });
    } catch {
      /* user cancelled share sheet */
    }
  }
  return share;
}
