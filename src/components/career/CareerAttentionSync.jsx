import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches } from "@/lib/jobMatchApi";
import { listMyJobMatchInteractions } from "@/lib/jobMatchInteractionsApi";
import { getMyProfessionalProfile } from "@/lib/professionalProfileApi";
import { buildCareerAttention } from "@/lib/careerAttention";
import { pushNotification } from "@/lib/notificationsApi";

const ALERT_KEY = "titanos_job_alerts_v1";
const NOTIFIED_PREFIX = "titanos_career_attention_notified_v1";
const LAST_SYNC_PREFIX = "titanos_career_attention_last_sync_v1";
const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MAX_NOTIFIED_KEYS = 300;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export default function CareerAttentionSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;

    (async () => {
      const lastSyncKey = `${LAST_SYNC_PREFIX}:${user.id}`;
      const notifiedKey = `${NOTIFIED_PREFIX}:${user.id}`;
      const lastSync = Number(readJson(lastSyncKey, 0));
      if (Date.now() - lastSync < MIN_SYNC_INTERVAL_MS) return;
      writeJson(lastSyncKey, Date.now());

      try {
        const [interactions, matchResult, profile] = await Promise.all([
          listMyJobMatchInteractions(user.id),
          getJobMatches({ includeExternal: true }),
          getMyProfessionalProfile(user),
        ]);
        if (!alive) return;

        const alerts = readJson(ALERT_KEY, []);
        const notified = new Set(readJson(notifiedKey, []));
        const items = buildCareerAttention({
          interactions,
          jobs: matchResult.matches || [],
          alerts,
          profile,
          seenAlertKeys: [],
        });

        const fresh = items.filter((item) => !notified.has(item.id)).slice(0, 8);
        const successful = [];
        for (const item of fresh) {
          if (!alive) return;
          const created = await pushNotification(user.id, {
            type: item.kind === "new_match" ? "jobs" : "applications",
            category: "jobs",
            title: item.title,
            body: item.body,
            link: item.link,
            meta: {
              career_attention: true,
              attention_id: item.id,
              priority: item.priority,
              due_at: item.due_at || null,
            },
          });
          if (created) successful.push(item.id);
        }

        if (successful.length) {
          const merged = [...successful, ...notified].slice(0, MAX_NOTIFIED_KEYS);
          writeJson(notifiedKey, merged);
        }
      } catch {
        // Career attention is advisory. Never block the authenticated shell when
        // a provider, profile, or notification backend is temporarily unavailable.
      }
    })();

    return () => { alive = false; };
  }, [user?.id]);

  return null;
}
