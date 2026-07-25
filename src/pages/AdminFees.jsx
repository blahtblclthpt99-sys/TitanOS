import React, { useCallback, useEffect, useMemo, useState } from "react";
import { History, Percent, Plus, RotateCcw, Save, Shield } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isUserAdmin } from "@/lib/isAdmin";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { formatFeePercent } from "@/lib/feeEngine";
import { formatMoney } from "@/lib/platformFee";

async function adminFees(action, payload = {}) {
  return api.functions.invoke("adminFees", { action, ...payload });
}

export default function AdminFees() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const isAdmin = isUserAdmin(user);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [source, setSource] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("service_requests");
  const [form, setForm] = useState({
    context_key: "worker_free",
    label: "",
    percentage_rate: "8",
    flat_amount: "0",
    min_fee: "",
    max_fee: "",
    rule_type: "percentage",
    fee_bearer: "buyer",
    effective_from: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFees("list");
      setCategories(data.categories || []);
      setRules(data.rules || []);
      setSource(data.source || "");
      const hist = await adminFees("history").catch(() => ({ history: [] }));
      setHistory(hist.history || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't load fee config",
        description: error.message || "Apply migration 017 and ensure service role is configured.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked && isAdmin) load();
  }, [authChecked, isAdmin, load]);

  const categoryRules = useMemo(
    () =>
      rules
        .filter((r) => r.category_id === selectedCategory)
        .sort((a, b) => (b.version || 0) - (a.version || 0)),
    [rules, selectedCategory]
  );

  const saveRule = async ({ schedule = false } = {}) => {
    setSaving(true);
    try {
      const pct = Number(form.percentage_rate) / 100;
      const payload = {
        category_id: selectedCategory,
        context_key: form.context_key || "*",
        label: form.label || `${form.context_key} ${form.percentage_rate}%`,
        rule_type: form.rule_type,
        percentage_rate: form.rule_type === "flat" ? 0 : pct,
        flat_amount: Number(form.flat_amount) || 0,
        min_fee: form.min_fee === "" ? null : Number(form.min_fee),
        max_fee: form.max_fee === "" ? null : Number(form.max_fee),
        fee_bearer: form.fee_bearer,
        notes: form.notes,
        effective_from: form.effective_from || undefined,
      };
      await adminFees(schedule ? "schedule" : "upsert", payload);
      toast({ title: schedule ? "Fee change scheduled" : "Fee rule published" });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save fee", description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const disableRule = async (id) => {
    try {
      await adminFees("disable", { id });
      toast({ title: "Fee rule disabled" });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't disable", description: error.message });
    }
  };

  const rollback = async (historyId) => {
    if (!window.confirm("Roll back to this fee snapshot? A new version will be published now.")) return;
    try {
      await adminFees("rollback", { history_id: historyId });
      toast({ title: "Fee rolled back" });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Rollback failed", description: error.message });
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading" />;
  if (!isAdmin) {
    return (
      <PageShell maxWidth="md">
        <PageHeader title="Fee management" subtitle="Admins only" />
        <p className="text-sm text-muted-foreground">You don’t have access to platform pricing controls.</p>
      </PageShell>
    );
  }

  if (loading) return <PageLoader variant="list" label="Loading fee configuration" />;

  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Admin · Revenue"
        title="Fee management"
        subtitle="Centralized TitanOS pricing. Live charges always recalculate on the server."
      />
      <FeatureHonestyBanner tone="info">
        Changes here update fee rules in the database (migration 017). Until that migration is applied,
        checkout uses seed defaults matching launch plan rates. Never trust browser-calculated fees.
        {source ? ` Config source: ${source}.` : ""}
      </FeatureHonestyBanner>

      <div className="mb-5 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Button
            key={c.id}
            type="button"
            size="sm"
            variant={selectedCategory === c.id ? "default" : "outline"}
            onClick={() => setSelectedCategory(c.id)}
          >
            {c.name}
            {!c.enabled ? " (off)" : ""}
          </Button>
        ))}
        {!categories.length && (
          <p className="text-sm text-muted-foreground">No categories yet — apply migration 017.</p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="titan-surface space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Percent className="h-4 w-4" aria-hidden="true" /> Publish fee rule
          </div>
          <label className="block text-xs text-muted-foreground">
            Context key (plan / segment)
            <Input
              className="mt-1"
              value={form.context_key}
              onChange={(e) => setForm((f) => ({ ...f, context_key: e.target.value }))}
              placeholder="worker_free | business | *"
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Label
            <Input
              className="mt-1"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Rule type
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.rule_type}
                onChange={(e) => setForm((f) => ({ ...f, rule_type: e.target.value }))}
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
                <option value="composite">Composite</option>
                <option value="tiered">Tiered</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Fee bearer
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.fee_bearer}
                onChange={(e) => setForm((f) => ({ ...f, fee_bearer: e.target.value }))}
              >
                <option value="buyer">Buyer pays</option>
                <option value="seller">Seller pays</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Percent (e.g. 8 for 8%)
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.percentage_rate}
                onChange={(e) => setForm((f) => ({ ...f, percentage_rate: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Flat amount
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.flat_amount}
                onChange={(e) => setForm((f) => ({ ...f, flat_amount: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Min fee
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.min_fee}
                onChange={(e) => setForm((f) => ({ ...f, min_fee: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Max fee
              <Input
                className="mt-1"
                type="number"
                step="0.01"
                value={form.max_fee}
                onChange={(e) => setForm((f) => ({ ...f, max_fee: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            Schedule effective from (optional ISO / datetime-local)
            <Input
              className="mt-1"
              type="datetime-local"
              value={form.effective_from}
              onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Notes
            <Input
              className="mt-1"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => saveRule({ schedule: false })}>
              <Save className="h-4 w-4" aria-hidden="true" /> Publish now
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving || !form.effective_from}
              onClick={() => saveRule({ schedule: true })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Schedule
            </Button>
          </div>
        </section>

        <section className="titan-surface space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Shield className="h-4 w-4" aria-hidden="true" /> Active & recent rules
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {categoryRules.map((rule) => (
              <article key={rule.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">
                      {rule.label || rule.context_key} · v{rule.version}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {rule.context_key} · {rule.rule_type} ·{" "}
                      {rule.rule_type === "flat"
                        ? formatMoney(rule.flat_amount)
                        : formatFeePercent(rule.percentage_rate)}
                      {rule.min_fee != null ? ` · min ${formatMoney(rule.min_fee)}` : ""}
                      {rule.max_fee != null ? ` · max ${formatMoney(rule.max_fee)}` : ""}
                      {" · "}
                      {rule.enabled ? "enabled" : "disabled"}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      From {rule.effective_from ? new Date(rule.effective_from).toLocaleString() : "—"}
                      {rule.effective_until
                        ? ` → ${new Date(rule.effective_until).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  {rule.enabled && (
                    <Button type="button" size="sm" variant="outline" onClick={() => disableRule(rule.id)}>
                      Disable
                    </Button>
                  )}
                </div>
              </article>
            ))}
            {!categoryRules.length && (
              <p className="text-sm text-muted-foreground">No rules for this category yet.</p>
            )}
          </div>
        </section>
      </div>

      <section className="titan-surface mt-5 space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <History className="h-4 w-4" aria-hidden="true" /> Fee history
        </div>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {history.slice(0, 40).map((h) => (
            <div
              key={h.id}
              className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">
                  {h.action} · {new Date(h.created_at).toLocaleString()}
                </p>
                <p className="text-muted-foreground">
                  {h.snapshot?.category_id} / {h.snapshot?.context_key} ·{" "}
                  {h.snapshot?.label || formatFeePercent(h.snapshot?.percentage_rate)}
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => rollback(h.id)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Rollback
              </Button>
            </div>
          ))}
          {!history.length && <p className="text-sm text-muted-foreground">No history yet.</p>}
        </div>
      </section>
    </PageShell>
  );
}
