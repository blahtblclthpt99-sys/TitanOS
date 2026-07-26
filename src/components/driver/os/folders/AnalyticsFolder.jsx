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

export default function AnalyticsFolder({ user }) {
  const data = useMemo(() => {
    if (!user?.id) return null;
    const prefs = readPrefs(user.id);
    const history = readShiftHistory(user.id);
    const session = readSession(user.id);
    const stops = readStops(user.id);
    const gasUsd = estimateGasPriceUsd(prefs.zip || "");
    return { prefs, history, session, stops, gasUsd };
  }, [user?.id]);

  if (!data) return <p className="text-sm text-muted-foreground">Sign in for analytics.</p>;

  return (
    <div className="space-y-4">
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
