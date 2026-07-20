import React, { memo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { listActivity } from "@/lib/communityApi";
import { timeAgo } from "@/lib/platformConstants";

/**
 * Live community/platform pulse.
 * @param {{ embedded?: boolean }} props — when embedded inside WidgetShell, hide outer chrome.
 */
function LiveActivityCard({ embedded = false }) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const rows = await listActivity(8);
        if (alive) setEvents(rows);
      } catch {
        if (alive) setEvents([]);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const body = (
    <div className="space-y-0">
      {events.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          No live activity yet — complete a job or share in Community.
        </p>
      ) : (
        events.slice(0, 6).map((event) => (
          <div
            key={event.id}
            className="flex items-start gap-3 border-b border-border py-2.5 last:border-0"
          >
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-foreground">
                {event.summary || event.text || event.title || "Activity"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {timeAgo(event.created_date || event.created_at)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <div className="titan-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2 md:px-5">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Live activity</h2>
        </div>
        <Link
          to="/community"
          className="flex min-h-[36px] items-center gap-1 rounded-md px-1 text-xs text-muted-foreground transition-colors hover:text-primary focus-ring"
        >
          Community <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="px-4 pb-4 md:px-5 md:pb-5">{body}</div>
    </div>
  );
}

export default memo(LiveActivityCard);
