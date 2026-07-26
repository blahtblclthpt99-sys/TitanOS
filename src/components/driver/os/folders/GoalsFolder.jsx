import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { readDriverGoals, saveDriverGoals } from "@/lib/driverActivity/goals.js";
import { toast } from "@/components/ui/use-toast";

export default function GoalsFolder({ user }) {
  const initial = useMemo(() => (user?.id ? readDriverGoals(user.id) : {}), [user?.id]);
  const [goals, setGoals] = useState(initial);

  if (!user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to set goals.</p>;
  }

  const save = () => {
    const next = saveDriverGoals(user.id, {
      daily_earnings: Number(goals.daily_earnings) || 0,
      daily_hours_cap: Number(goals.daily_hours_cap) || 0,
      weekly_earnings: Number(goals.weekly_earnings) || 0,
    });
    setGoals(next);
    toast({ title: "Goals updated", description: "Mission Control will track daily progress." });
  };

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily earnings ($)</span>
        <input
          type="number"
          min="0"
          value={goals.daily_earnings ?? ""}
          onChange={(e) => setGoals({ ...goals, daily_earnings: e.target.value })}
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Daily hours</span>
        <input
          type="number"
          min="0"
          step="0.5"
          value={goals.daily_hours_cap ?? ""}
          onChange={(e) => setGoals({ ...goals, daily_hours_cap: e.target.value })}
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekly earnings ($)</span>
        <input
          type="number"
          min="0"
          value={goals.weekly_earnings ?? ""}
          onChange={(e) => setGoals({ ...goals, weekly_earnings: e.target.value })}
          className="w-full h-11 rounded-xl border border-border bg-muted px-3 text-sm"
        />
      </label>
      <Button type="button" className="min-h-[44px]" onClick={save}>
        Save goals
      </Button>
    </div>
  );
}
