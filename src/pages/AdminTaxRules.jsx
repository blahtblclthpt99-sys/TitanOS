import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Percent, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isUserAdmin } from "@/lib/isAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import PageLoader from "@/components/shared/PageLoader";
import {
  deleteTaxRule,
  loadTaxRules,
  resetTaxRulesToSeed,
  upsertTaxRule,
} from "@/lib/taxEngine";

const BLANK = {
  id: "",
  country: "US",
  state: "",
  county: "",
  city: "",
  postalPrefix: "",
  label: "",
  ratePercent: "",
  priority: "20",
  taxExemptAllowed: true,
  active: true,
  notes: "",
};

export default function AdminTaxRules() {
  const { user, authChecked } = useAuth();
  const isAdmin = isUserAdmin(user);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setRules(loadTaxRules());
  }, []);

  useEffect(() => {
    if (authChecked && isAdmin) reload();
  }, [authChecked, isAdmin, reload]);

  const sorted = useMemo(
    () => [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    [rules]
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        ratePercent: Number(form.ratePercent),
        priority: Number(form.priority) || 0,
        components: [
          { name: form.label || "Sales tax", ratePercent: Number(form.ratePercent) || 0 },
        ],
      };
      const result = upsertTaxRule(payload);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Invalid rule",
          description: result.errors?.[0] || "Check fields.",
        });
        return;
      }
      setRules(result.rules);
      setForm(BLANK);
      toast({ title: "Tax rule saved" });
    } finally {
      setSaving(false);
    }
  };

  const edit = (rule) => {
    setForm({
      id: rule.id,
      country: rule.country || "US",
      state: rule.state || "",
      county: rule.county || "",
      city: rule.city || "",
      postalPrefix: rule.postalPrefix || "",
      label: rule.label || "",
      ratePercent: String(rule.ratePercent ?? ""),
      priority: String(rule.priority ?? 20),
      taxExemptAllowed: rule.taxExemptAllowed !== false,
      active: rule.active !== false,
      notes: rule.notes || "",
    });
  };

  const remove = (id) => {
    setRules(deleteTaxRule(id));
    toast({ title: "Rule removed" });
  };

  const resetSeed = () => {
    setRules(resetTaxRulesToSeed());
    toast({ title: "Restored starter tax catalog", description: "Verify rates before production use." });
  };

  if (!authChecked) return <PageLoader variant="list" label="Loading tax rules" />;
  if (!isAdmin) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Admin access required.</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="xl" className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Tax Rules"
        subtitle="Configure sales-tax jurisdictions by Job Location. Driver Location never sets tax."
      />

      <FeatureHonestyBanner>
        Configurable rates — verify before charging. Starter rules are illustrative. Keep historical
        estimate/invoice tax snapshots unless you intentionally recalculate.
      </FeatureHonestyBanner>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground">Add / edit rule</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Input placeholder="Rule id" value={form.id} onChange={(e) => set("id", e.target.value)} />
          <Input placeholder="Label" value={form.label} onChange={(e) => set("label", e.target.value)} />
          <Input placeholder="Country" value={form.country} onChange={(e) => set("country", e.target.value)} />
          <Input placeholder="State" value={form.state} onChange={(e) => set("state", e.target.value)} />
          <Input placeholder="County" value={form.county} onChange={(e) => set("county", e.target.value)} />
          <Input placeholder="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <Input
            placeholder="Postal prefix"
            value={form.postalPrefix}
            onChange={(e) => set("postalPrefix", e.target.value)}
          />
          <Input
            type="number"
            placeholder="Rate %"
            value={form.ratePercent}
            onChange={(e) => set("ratePercent", e.target.value)}
          />
          <Input
            type="number"
            placeholder="Priority"
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.taxExemptAllowed}
            onChange={(e) => set("taxExemptAllowed", e.target.checked)}
          />
          Allow tax-exempt customers
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Active
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={saving} onClick={save}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save rule"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm(BLANK)}>
            <Plus className="h-4 w-4" /> Clear form
          </Button>
          <Button type="button" variant="outline" onClick={resetSeed}>
            <RotateCcw className="h-4 w-4" /> Reset to starter catalog
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" /> Active catalog ({sorted.length})
        </p>
        {sorted.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {rule.label || rule.id}{" "}
                <span className="text-muted-foreground font-normal">· {rule.ratePercent}%</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {[rule.country, rule.state, rule.county, rule.city, rule.postalPrefix]
                  .filter(Boolean)
                  .join(" / ")}{" "}
                · priority {rule.priority}
                {!rule.active ? " · inactive" : ""}
              </p>
            </div>
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => edit(rule)}>
                Edit
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(rule.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
