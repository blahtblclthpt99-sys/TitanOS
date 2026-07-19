import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronRight } from "lucide-react";
import { listActivity } from "@/lib/communityApi";
import { timeAgo } from "@/lib/platformConstants";

export default function LiveActivityCard() {
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
    const id = setInterval(load, 25000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="glass rounded-2xl overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-titan-cyan" />
          <h2 className="text-sm font-semibold text-foreground/90 uppercase tracking-widest">Live Activity</h2>
        </div>
        <Link to="/community" className="text-xs text-muted-foreground hover:text-titan-cyan flex items-center gap-1">
          Community <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="px-5 pb-5 space-y-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No live activity yet — complete a job or share in Community.</p>
        ) : (
          events.slice(0, 5).map((event) => (
            <div key={event.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <div className="w-2 h-2 rounded-full bg-titan-cyan mt-1.5 flex-shrink-0 animate-pulse" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground leading-snug">{event.summary}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {timeAgo(event.created_date || event.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
