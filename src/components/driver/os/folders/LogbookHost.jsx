import React, { useMemo } from "react";
import VehicleLogbookPanel from "@/components/driver/activity/VehicleLogbookPanel";
import {
  readShiftHistory,
  readSession,
  readStops,
} from "@/lib/driverHubApi";

/** Shared logbook host — Vehicle / Expenses / Tax / Reports folders. */
export default function LogbookHost({ user }) {
  const data = useMemo(() => {
    if (!user?.id) return { history: [], session: null, stops: [] };
    return {
      history: readShiftHistory(user.id) || [],
      session: readSession(user.id),
      stops: readStops(user.id) || [],
    };
  }, [user?.id]);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to open the logbook.</p>;
  }

  return (
    <VehicleLogbookPanel
      userId={user.id}
      history={data.history}
      liveSession={data.session?.active ? data.session : null}
      stops={data.stops}
    />
  );
}
