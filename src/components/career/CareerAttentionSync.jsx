import { useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { getJobMatches } from "@/lib/jobMatchApi";
import { listMyJobMatchInteractions } from "@/lib/jobMatchInteractionsApi";
import { getMyProfessionalProfile } from "@/lib/professionalProfileApi";
import { buildCareerAttention } from "@/lib/careerAttention";
import { readCareerPreference, writeCareerPreference } from "@/lib/careerPreferenceStorage";
import { pushNotification } from "@/lib/notificationsApi";

const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MAX_NOTIFIED_KEYS = 300;

export default function CareerAttentionSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;

    (async () => {
      const lastSync = Number(readCareerPreference(user.id, "attention-last-sync", 0));
      if (Date.now() - lastSync < MIN_SYNC_INTERVAL_MS) return;
      writeCareerPreference(user.id, "attention-last-sync", Date.now());

      try {
        const [interactions, matchResult, profile] = await Promise.all([
          listMyJobMatchInteractions(user.id),
          getJobMatches({ includeExternal: true }),
          getMyProfessionalProfile(user),
        ]);
        if (!alive) return;

        const alerts = readCareerPreference(user.id, "job-alerts", []);
        const notified = new Set(readCareerPreference(user.id, "attention-notified", []));
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
          writeCareerPreference(
            user.id,
            "attention-notified",
            [...successful, ...notified].slice(0, MAX_NOTIFIED_KEYS)
          );
        }
      } catch {
        // Career attention is advisory. Never block the authenticated shell when
        // a provider, profile, or notification backend is temporarily unavailable.
      }
    })();

    return () => { alive = false; };
  }, [user]);

  return null;
}
