import React, { useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  AUTOPILOT_PROFILES,
  readAutopilotSettings,
  saveAutopilotSettings,
  decideOfferSetForget,
  parseOfferQuickText,
  logAutopilotDecision,
  listAutopilotDecisions,
  summarizeMoneyProtected,
} from "@/lib/driverActivity/autopilot";
import { buildZipBenchmarks } from "@/lib/driverActivity/zipBenchmarks";
import { listTripJournal } from "@/lib/driverActivity/tripJournal";
import { classifyRushWindow } from "@/lib/driverActivity/intelligence";
import VehicleTrueCostPanel from "@/components/driver/activity/VehicleTrueCostPanel";

const SPECTRUM_LABELS = [
  ["hourly", "$/hr"],
  ["profit", "Profit"],
  ["per_mile", "$/mi"],
  ["zip", "ZIP"],
  ["stack", "Stack"],
  ["parking", "Park"],
  ["cost_efficiency", "Costs"],
  ["rush", "Rush"],
];

function SpectrumBar({ id, label, value }) {
  const tone =
    value >= 70 ? "bg-emerald-500" : value >= 45 ? "bg-titan-amber" : "bg-red-500";
  return (
    <div className="space-y-0.5" title={`${label}: ${value}`}>
      <div className="flex justify-between text-[9px] uppercase text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-[width]", tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/**
 * Set-&-forget offer coach for live driving — one glance ACCEPT / DENY.
 * Does not control third-party apps; driver taps accept/deny there.
 */
export default function SetForgetOfferPanel({
  userId,
  mpg = 22,
  gasUsd = 3.5,
  defaultZip = "",
  history = [],
  drivingActive = false,
  voiceSeed = null,
}) {
  const [settings, setSettings] = useState(() => readAutopilotSettings(userId));
  const [showSetup, setShowSetup] = useState(false);
  const [paste, setPaste] = useState("");
  const [form, setForm] = useState({
    pay: "",
    tip: "",
    miles: "",
    minutes: "",
    stack_count: "1",
    same_restaurant: false,
    parking: "",
    zip: defaultZip || "",
  });
  const [lastDecision, setLastDecision] = useState(null);
  const [recent, setRecent] = useState(() => (userId ? listAutopilotDecisions(userId, 5) : []));
  const moneyStats = useMemo(
    () => (userId ? summarizeMoneyProtected(userId) : null),
    [userId, recent]
  );

  useEffect(() => {
    setSettings(readAutopilotSettings(userId));
    setRecent(userId ? listAutopilotDecisions(userId, 5) : []);
  }, [userId]);

  useEffect(() => {
    if (!voiceSeed?.decision) return;
    setLastDecision(voiceSeed.decision);
    setSettings(readAutopilotSettings(userId));
    setRecent(userId ? listAutopilotDecisions(userId, 5) : []);
    if (voiceSeed.input) {
      setForm((f) => ({
        ...f,
        pay: voiceSeed.input.pay != null ? String(voiceSeed.input.pay) : f.pay,
        tip: voiceSeed.input.tip != null ? String(voiceSeed.input.tip) : f.tip,
        miles: voiceSeed.input.miles != null ? String(voiceSeed.input.miles) : f.miles,
        minutes: voiceSeed.input.minutes != null ? String(voiceSeed.input.minutes) : f.minutes,
        zip: voiceSeed.input.zip || f.zip,
        stack_count: String(voiceSeed.input.stack_count || f.stack_count || 1),
        same_restaurant: Boolean(voiceSeed.input.same_restaurant),
      }));
    }
  }, [voiceSeed, userId]);

  useEffect(() => {
    if (defaultZip && !form.zip) {
      setForm((f) => ({ ...f, zip: String(defaultZip).replace(/\D/g, "").slice(0, 5) }));
    }
  }, [defaultZip]);

  const benchmarks = useMemo(() => {
    if (!settings.useZipAverages) return null;
    const journal = userId ? listTripJournal(userId) : [];
    return buildZipBenchmarks({
      journal,
      sessions: history,
      fallbackZip: defaultZip || form.zip,
    });
  }, [userId, history, defaultZip, form.zip, settings.useZipAverages]);

  const rush = useMemo(() => classifyRushWindow(new Date()), [lastDecision, settings.enabled]);

  const persist = (patch) => {
    if (!userId) return;
    setSettings(saveAutopilotSettings(userId, patch));
  };

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const runDecision = (override = null) => {
    const input = override || {
      pay: form.pay,
      tip: form.tip,
      miles: form.miles,
      minutes: form.minutes,
      stack_count: form.stack_count,
      same_restaurant: form.same_restaurant,
      parking: form.parking,
      zip: form.zip || defaultZip,
      mpg,
      gasUsd,
    };
    if (!(Number(input.pay) > 0 || Number(input.miles) > 0)) return null;
    const decision = decideOfferSetForget(input, {
      userId,
      settings,
      benchmarks,
      zip: defaultZip,
      mpg,
      gasUsd,
      rush,
    });
    setLastDecision(decision);
    if (userId) {
      logAutopilotDecision(userId, decision, input);
      setRecent(listAutopilotDecisions(userId, 5));
    }
    return decision;
  };

  const onPasteBlur = () => {
    const parsed = parseOfferQuickText(paste);
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      pay: parsed.pay ? String(parsed.pay) : f.pay,
      tip: parsed.tip ? String(parsed.tip) : f.tip,
      miles: parsed.miles ? String(parsed.miles) : f.miles,
      minutes: parsed.minutes ? String(parsed.minutes) : f.minutes,
      zip: parsed.zip || f.zip,
      stack_count: String(parsed.stack_count || f.stack_count || 1),
    }));
  };

  // Live recompute while typing when set-&-forget is ON
  const live = useMemo(() => {
    if (!settings.enabled) return null;
    if (!(Number(form.pay) > 0 && Number(form.miles) > 0 && Number(form.minutes) > 0)) {
      return lastDecision;
    }
    return decideOfferSetForget(
      {
        ...form,
        zip: form.zip || defaultZip,
        mpg,
        gasUsd,
      },
      { userId, settings, benchmarks, zip: defaultZip, mpg, gasUsd, rush }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, settings, benchmarks, mpg, gasUsd, defaultZip, rush.id]);

  const decision = live || lastDecision;
  const verdictStyle =
    decision?.verdict === "ACCEPT"
      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
      : decision?.verdict === "DENY"
        ? "border-red-500/50 bg-red-500/20 text-red-300"
        : "border-titan-amber/40 bg-titan-amber/10 text-titan-amber";
  const VerdictIcon =
    decision?.verdict === "ACCEPT"
      ? CheckCircle2
      : decision?.verdict === "DENY"
        ? Ban
        : AlertTriangle;

  return (
    <section
      className={cn(
        "mt-4 rounded-2xl border p-4 space-y-3",
        settings.enabled
          ? "border-titan-cyan/40 bg-titan-cyan/5"
          : "border-border bg-card/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-titan-cyan flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Make more money
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {settings.enabled
              ? "Money autopilot ON — skip cheap trips, take the ones that pay"
              : "Set & forget · built to raise your take-home"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Protects your $/hr with ZIP averages, costs, stacks, parking &amp; rush. Titan tells you
            ACCEPT or DENY — you still tap the gig app.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowSetup((v) => !v)}>
            <Settings2 className="w-4 h-4" />
          </Button>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => persist({ enabled: !settings.enabled })}
            className={cn(
              "relative h-9 w-14 rounded-full border transition-colors",
              settings.enabled
                ? "bg-titan-cyan/30 border-titan-cyan/50"
                : "bg-muted border-border"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-7 w-7 rounded-full bg-foreground transition-transform",
                settings.enabled ? "translate-x-6" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {showSetup ? (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold">Money mode — pick once, then drive</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(AUTOPILOT_PROFILES).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => persist({ profileId: p.id })}
                className={cn(
                  "rounded-xl border px-2 py-2 text-left transition-colors",
                  settings.profileId === p.id
                    ? "border-titan-cyan bg-titan-cyan/15"
                    : "border-border bg-card/50"
                )}
              >
                <p className="text-xs font-bold">{p.label}</p>
                <p className="text-[10px] text-muted-foreground leading-snug">{p.blurb}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.protectHourlyAverage !== false}
                onChange={(e) => persist({ protectHourlyAverage: e.target.checked })}
              />
              Protect $/hr average
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.useZipAverages}
                onChange={(e) => persist({ useZipAverages: e.target.checked })}
              />
              Use ZIP averages
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.rushAware}
                onChange={(e) => persist({ rushAware: e.target.checked })}
              />
              Rush-aware
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoParking}
                onChange={(e) => persist({ autoParking: e.target.checked })}
              />
              Auto parking $0
            </label>
            <div>
              <span className="text-muted-foreground">Assume deadhead mi</span>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={settings.assumeDeadheadMiles}
                onChange={(e) => persist({ assumeDeadheadMiles: Number(e.target.value) || 0 })}
                className="h-8 mt-1 bg-muted border-border"
              />
            </div>
          </div>
          <VehicleTrueCostPanel userId={userId} mpg={mpg} gasUsd={gasUsd} />
        </div>
      ) : null}

      {settings.enabled || drivingActive ? (
        <>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground">
              Paste offer (optional) — e.g. $14.50 4.2mi 18min
            </label>
            <Input
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              onBlur={onPasteBlur}
              placeholder="$12 · 5 mi · 20 min · 75201"
              className="h-10 mt-1 bg-muted border-border text-base"
            />
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              ["pay", "Pay $", "0.01"],
              ["tip", "Tip $", "0.01"],
              ["miles", "Miles", "0.1"],
              ["minutes", "Min", "1"],
              ["stack_count", "Stack", "1"],
              ["zip", "ZIP", null],
            ].map(([key, label, step]) => (
              <div key={key}>
                <label className="text-[10px] uppercase text-muted-foreground">{label}</label>
                <Input
                  type={key === "zip" ? "text" : "number"}
                  inputMode={key === "zip" ? "numeric" : "decimal"}
                  step={step || undefined}
                  maxLength={key === "zip" ? 5 : undefined}
                  value={form[key]}
                  onChange={(e) =>
                    set(
                      key,
                      key === "zip"
                        ? e.target.value.replace(/\D/g, "").slice(0, 5)
                        : e.target.value
                    )
                  }
                  className="h-11 bg-muted border-border text-base tabular-nums"
                />
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={form.same_restaurant}
              onChange={(e) => set("same_restaurant", e.target.checked)}
            />
            Same restaurant stack
          </label>

          <Button
            type="button"
            className="w-full h-12 text-base font-bold gap-2"
            onClick={() => runDecision()}
            disabled={!(Number(form.pay) > 0)}
          >
            <Zap className="w-5 h-5" /> Decide now
          </Button>

          {decision ? (
            <div className={cn("rounded-2xl border p-4 space-y-3", verdictStyle)}>
              <div className="flex items-center gap-3">
                <VerdictIcon className="w-10 h-10 shrink-0" />
                <div className="min-w-0">
                  <p className="text-3xl font-black tracking-tight">{decision.verdict}</p>
                  <p className="text-sm opacity-90 leading-snug">{decision.action}</p>
                </div>
                <div className="ml-auto text-right shrink-0">
                  <p className="text-[10px] uppercase opacity-70">Money score</p>
                  <p className="text-2xl font-bold tabular-nums">{decision.spectrum.overall}</p>
                </div>
              </div>
              {decision.money ? (
                <p className="text-xs font-semibold tabular-nums">
                  vs your usual: {decision.money.delta_per_hour >= 0 ? "+" : ""}
                  ${decision.money.delta_per_hour}/hr · offer ${decision.money.offer_hourly}/hr net
                  {decision.money.baseline_hourly
                    ? ` · baseline $${decision.money.baseline_hourly}/hr`
                    : ""}
                </p>
              ) : null}
              {decision.trueCost ? (
                <p className="text-[11px] opacity-90 tabular-nums">
                  All-in cost ${decision.trueCost.true_cost_per_mile.toFixed(3)}/mi · need ≥ $
                  {decision.trueCost.recommended_min_gross_per_mile.toFixed(2)}/mi · offer $
                  {decision.breakdown.perMileGross}/mi gross
                </p>
              ) : null}
              <div className="grid grid-cols-4 gap-2">
                {SPECTRUM_LABELS.map(([id, label]) => (
                  <SpectrumBar key={id} id={id} label={label} value={decision.spectrum[id] ?? 0} />
                ))}
              </div>
              <p className="text-[11px] opacity-80 tabular-nums">
                Net ${decision.breakdown.netProfit.toFixed(2)} · ${decision.breakdown.hourlyNet}/hr · $
                {decision.breakdown.perMileNet}/mi · {rush.label} ·{" "}
                {AUTOPILOT_PROFILES[settings.profileId]?.label || "Balanced"}
              </p>
            </div>
          ) : settings.enabled ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Enter pay + miles + minutes when an offer pops — verdict updates automatically.
            </p>
          ) : null}

          {moneyStats && moneyStats.decisions > 0 ? (
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Recent: ~${moneyStats.estimated_protected_usd} protected by skips · ~$
              {moneyStats.estimated_captured_usd} captured on accepts
            </p>
          ) : null}

          {recent.length > 0 ? (
            <div className="pt-1 border-t border-border">
              <p className="text-[10px] uppercase text-muted-foreground mb-1">Recent decisions</p>
              <ul className="text-xs space-y-0.5">
                {recent.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 tabular-nums text-muted-foreground">
                    <span>
                      {r.verdict} · ${r.pay} / {r.miles}mi
                    </span>
                    <span>{r.spectrum_overall != null ? `σ ${r.spectrum_overall}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Turn on money autopilot, pick Keep busy / Max money / High roller once — then only punch in
          offer numbers while you drive. Titan is built to make you more money by skipping trips that
          drag your average down.
        </p>
      )}
    </section>
  );
}
