import React, { useMemo } from "react";
import DriverIntelligencePanel from "@/components/driver/activity/DriverIntelligencePanel";
import ActivityStatsPanel from "@/components/driver/activity/ActivityStatsPanel";
import {
  readShiftHistory,
  readSession,
  readStops,
  readPrefs,
  estimateGasPriceUsd,
} from "@/lib/driverHubApi";
import {
  isDigestFresh,
  readAnalyticsDigest,
} from "@/lib/driverActivity/analyticsDigest.js";

export default function AnalyticsFolder({ user, refreshTick = 0 }) {
  const data = useMemo(() => {
    void refreshTick;
    if (!user?.id) return null;
    const prefs = readPrefs(user.id);
    const history = readShiftHistory(user.id);
    const session = readSession(user.id);
    const stops = readStops(user.id);
    const gasUsd = estimateGasPriceUsd(prefs.zip || "");
    const digest = readAnalyticsDigest(user.id);
    return { prefs, history, session, stops, gasUsd, digest };
  }, [user?.id, refreshTick]);

  if (!data) return <p className="text-sm text-muted-foreground">Sign in for analytics.</p>;

  const digestFresh = isDigestFresh(data.digest);
  const idle = data.digest?.idle;

  return (
    <div className="space-y-4">
      {digestFresh && data.digest ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Auto digest
          </p>
          <p className="text-sm text-foreground">
            {data.digest.tripsDetected != null
              ? `${data.digest.tripsDetected} trips detected`
              : "Latest shift/delivery summary"}
            {data.digest.intensity?.label ? ` · ${data.digest.intensity.label}` : ""}
            {idle?.idleRatio != null ? ` · ${(idle.idleRatio * 100).toFixed(0)}% idle` : ""}
          </p>
          {data.digest.coach?.[0] ? (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {typeof data.digest.coach[0] === "string"
                ? data.digest.coach[0]
                : data.digest.coach[0]?.text || data.digest.coach[0]?.tip || ""}
            </p>
          ) : null}
          <p className="text-[10px] text-muted-foreground">
            Generated {new Date(data.digest.generatedAt).toLocaleString()} · refreshes on shift/delivery end
          </p>
        </div>
      ) : null}
      <ActivityStatsPanel
        history={data.history}
        liveSession={data.session?.active ? data.session : null}
        stops={data.stops}
      />
      <DriverIntelligencePanel
        userId={user.id}
        history={data.history}
        liveSession={data.session?.active ? data.session : null}
        stops={data.stops}
        mpg={Number(data.prefs.mpg) || 22}
        gasUsd={typeof data.gasUsd === "number" ? data.gasUsd : 3.5}
        defaultZip={data.prefs.zip || ""}
      />
    </div>
  );
}
