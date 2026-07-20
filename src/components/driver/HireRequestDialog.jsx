import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FormField from "@/components/shared/FormField";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { createHireJob } from "@/lib/hireApi";
import { formatDriverRate } from "@/lib/driverDirectoryApi";

/**
 * Shared “Request driver” dialog — creates a Hire post prefilled for a driver.
 *
 * @param {object} props
 * @param {object | null} props.driver — normalized driver from the directory
 * @param {boolean} props.open
 * @param {(open: boolean) => void} props.onOpenChange
 */
export default function HireRequestDialog({ driver, open, onOpenChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ title: "", description: "", budget: "", sameDay: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !driver) return;
    setForm({
      title: `Need ${driver.vehicleType} driver — ${driver.city}`,
      description: `Requesting ${driver.name} (${formatDriverRate(driver)}). ${driver.bio || ""}`.trim(),
      budget: String(driver.rateHourly || ""),
      sameDay: driver.availability === "available",
    });
  }, [open, driver]);

  const submit = async (e) => {
    e.preventDefault();
    if (!driver || saving || !form.title.trim()) return;
    if (!user?.id) {
      toast({ title: "Sign in to request a driver", variant: "destructive" });
      navigate("/login");
      return;
    }
    setSaving(true);
    try {
      const cityParts = String(driver.city || "").split(",").map((s) => s.trim());
      await createHireJob(user, {
        title: form.title,
        description: form.description,
        category: "Driving / Hauling",
        city: cityParts[0] || user.city || "",
        state: cityParts[1] || user.state || "",
        budget_min: Number(form.budget) || null,
        budget_max: Number(form.budget) ? Math.round(Number(form.budget) * 8) : null,
        is_same_day: form.sameDay,
        is_urgent: form.sameDay,
      });
      toast.success(`Request posted for ${driver.name}`, "Open Hire → My posts to track applications.");
      onOpenChange(false);
      navigate("/hire");
    } catch (err) {
      toast({
        variant: "destructive",
        title: err?.message || "Couldn't create request",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle>Request {driver?.name || "driver"}</DialogTitle>
          <DialogDescription>
            Creates a Hire post prefilled for this driver
            {driver ? ` (${formatDriverRate(driver)})` : ""}. Track it under Hire → My posts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-3">
          <FormField
            label="Job title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FormField label="Details">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="border-border bg-muted text-foreground"
            />
          </FormField>
          <FormField
            label="Budget ($ / hour)"
            type="number"
            min="0"
            value={form.budget}
            onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
          />
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.sameDay}
              onChange={(e) => setForm((f) => ({ ...f, sameDay: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            Same-day / urgent
          </label>
          <Button type="submit" disabled={saving || !form.title.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Post request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
