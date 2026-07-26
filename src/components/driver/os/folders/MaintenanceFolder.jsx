import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  listServiceReminders,
  addServiceReminder,
  toggleServiceReminder,
} from "@/lib/driverActivity/vehicleLogbook.js";
import { toast } from "@/components/ui/use-toast";

export default function MaintenanceFolder({ user }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [tick, setTick] = useState(0);

  const reminders = useMemo(() => {
    if (!user?.id) return [];
    void tick;
    return listServiceReminders(user.id) || [];
  }, [user?.id, tick]);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in for maintenance reminders.</p>;
  }

  const add = () => {
    if (!title.trim()) return;
    addServiceReminder(user.id, { title: title.trim(), due_date: due || null });
    setTitle("");
    setDue("");
    setTick((t) => t + 1);
    toast({ title: "Reminder added" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Oil change, tires, brakes…"
          className="flex-1 h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
        <Button type="button" className="min-h-[44px]" onClick={add}>
          Add
        </Button>
      </div>
      {reminders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No maintenance reminders yet.</p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 min-h-[48px]"
            >
              <div className="min-w-0">
                <p className={`text-sm font-medium truncate ${r.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {r.title}
                </p>
                {r.due_date ? <p className="text-xs text-muted-foreground">Due {r.due_date}</p> : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-[40px] shrink-0"
                onClick={() => {
                  toggleServiceReminder(user.id, r.id);
                  setTick((t) => t + 1);
                }}
              >
                {r.done ? "Undo" : "Done"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
