import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, FilePlus2, Loader2, Receipt, Save, Sparkles } from "lucide-react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import { useAuth } from "@/lib/AuthContext";
import { estimateJobPrice, MARKET_HOURLY } from "@/lib/priceEstimator";
import { optimizePriceFactors, withPriceOptimization } from "@/lib/priceOptimizer";
import { SERVICE_CATEGORIES } from "@/lib/platformConstants";
import { betaBadgeLabel } from "@/lib/plan";
import { generateAiEstimateDraft } from "@/lib/aiEstimate";

const initialForm = {
  service_type: "General",
  hours: 1,
  labor_rate: MARKET_HOURLY.General,
  materials: 0,
  equipment: 0,
  mileage: 0,
  difficulty: "standard",
  urgency: "normal",
  market_rate_factor: 1,
  zip: "",
  competition: "medium",
  job_size: "standard",
};

const inputClass = "bg-card border-border text-foreground rounded-xl h-10";

export default function JobEstimator() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(() => {
    try {
      const raw = sessionStorage.getItem("titanos_estimator_draft");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.inputs) {
        sessionStorage.removeItem("titanos_estimator_draft");
        return { ...initialForm, ...parsed.inputs };
      }
    } catch {
      /* ignore */
    }
    return initialForm;
  });
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askingAi, setAskingAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");

  const optimization = useMemo(
    () =>
      optimizePriceFactors({
        zip: form.zip,
        service_type: form.service_type,
        hours: form.hours,
        job_size: form.job_size,
        competition: form.competition,
      }),
    [form.zip, form.service_type, form.hours, form.job_size, form.competition]
  );

  const estimate = useMemo(() => {
    const raw = estimateJobPrice({ ...form, market_rate_factor: optimization.market_rate_factor });
    return withPriceOptimization(raw, optimization);
  }, [form, optimization]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const changeService = (service_type) => setForm((current) => ({ ...current, service_type, labor_rate: MARKET_HOURLY[service_type] || MARKET_HOURLY.General }));
  const draft = { inputs: form, estimate, created_at: new Date().toISOString() };

  const createDocument = (path) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      sessionStorage.setItem("titanos_estimator_draft", JSON.stringify(draft));
      navigate(path, { state: { estimatorDraft: draft } });
    } catch {
      toast({ title: "Couldn't prepare draft", variant: "destructive" });
      setSubmitting(false);
    }
  };

  const saveEstimate = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.entities.PriceEstimate.create({
        user_id: user?.id || "",
        service_type: form.service_type,
        inputs: form,
        low_estimate: estimate.low_estimate,
        avg_estimate: estimate.avg_estimate,
        premium_estimate: estimate.premium_estimate,
        labor_cost: estimate.labor_cost,
        profit_estimate: estimate.profit_estimate,
        suggested_price: estimate.suggested_price,
      });
      toast({ title: "Price estimate saved" });
    } catch (error) {
      toast({ title: "Couldn't save estimate", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const askAi = async () => {
    setAskingAi(true);
    try {
      const prompt = aiPrompt.trim() || `${form.service_type}, ${form.hours} hours, ${form.difficulty} difficulty`;
      const draft = await generateAiEstimateDraft(prompt, { user: user?.full_name });
      if (Object.keys(draft.fields || {}).length) setForm((current) => ({ ...current, ...draft.fields }));
      const range = draft.market_range;
      toast({
        title: "AI estimate ready",
        description: range
          ? `${draft.text} Line items: ${(draft.line_items || []).length}.`
          : draft.text,
      });
    } finally {
      setAskingAi(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader title="Job Price Estimator" subtitle="Build a market-aware price range for any job." />
      {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">{betaBadgeLabel()}</div>}
      <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-5">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-5"><Calculator className="w-5 h-5 text-titan-cyan" /><h2 className="font-semibold text-foreground">Job inputs</h2></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Service type"><select value={form.service_type} onChange={(event) => changeService(event.target.value)} className={`${inputClass} px-3 w-full`}>{SERVICE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></Field>
            <Field label="Hours"><Input type="number" min="0" step="0.25" value={form.hours} onChange={(event) => update("hours", event.target.value)} className={inputClass} /></Field>
            <Field label="Labor rate ($/hr)"><Input type="number" min="0" value={form.labor_rate} onChange={(event) => update("labor_rate", event.target.value)} className={inputClass} /></Field>
            <Field label="Materials ($)"><Input type="number" min="0" value={form.materials} onChange={(event) => update("materials", event.target.value)} className={inputClass} /></Field>
            <Field label="Equipment ($)"><Input type="number" min="0" value={form.equipment} onChange={(event) => update("equipment", event.target.value)} className={inputClass} /></Field>
            <Field label="Mileage"><Input type="number" min="0" value={form.mileage} onChange={(event) => update("mileage", event.target.value)} className={inputClass} /></Field>
            <Field label="Difficulty"><select value={form.difficulty} onChange={(event) => update("difficulty", event.target.value)} className={`${inputClass} px-3 w-full`}><option value="easy">Easy</option><option value="standard">Standard</option><option value="hard">Hard</option><option value="expert">Expert</option></select></Field>
            <Field label="Urgency"><select value={form.urgency} onChange={(event) => update("urgency", event.target.value)} className={`${inputClass} px-3 w-full`}><option value="normal">Normal</option><option value="soon">Soon</option><option value="same_day">Same day</option><option value="emergency">Emergency</option></select></Field>
            <Field label="Job ZIP"><Input value={form.zip} onChange={(event) => update("zip", event.target.value)} placeholder="75201" className={inputClass} /></Field>
            <Field label="Local competition"><select value={form.competition} onChange={(event) => update("competition", event.target.value)} className={`${inputClass} px-3 w-full`}><option value="low">Low (charge more)</option><option value="medium">Average</option><option value="high">High (price tight)</option></select></Field>
            <Field label="Job size"><select value={form.job_size} onChange={(event) => update("job_size", event.target.value)} className={`${inputClass} px-3 w-full`}><option value="small">Small</option><option value="standard">Standard</option><option value="large">Large</option></select></Field>
          </div>
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-titan-cyan mb-1">AI Price Optimizer · {optimization.market_rate_factor.toFixed(2)}× market</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{estimate.why_price}</p>
          </div>
        </section>

        <section className="glass rounded-2xl p-5 h-fit">
          <h2 className="font-semibold text-foreground mb-4">Recommended range</h2>
          <div className="grid grid-cols-3 gap-2 mb-5">{[["Low", estimate.low_estimate, "text-foreground/90"], ["Average", estimate.avg_estimate, "text-titan-cyan"], ["Premium", estimate.premium_estimate, "text-titan-amber"]].map(([label, value, color]) => <div key={label} className="bg-white/[0.04] rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className={`font-bold mt-1 ${color}`}>${Number(value).toLocaleString()}</p></div>)}</div>
          <div className="space-y-3 border-t border-border pt-4">
            <Metric label="Suggested Customer Price" value={estimate.suggested_price} prominent />
            <Metric label="Estimated Profit" value={estimate.profit_estimate} positive={estimate.profit_estimate >= 0} />
            <Metric label="Labor Cost" value={estimate.labor_cost} />
          </div>
          <div className="grid gap-2 mt-5">
            <label className="block text-sm text-muted-foreground text-left">
              Describe the job in plain English
              <Input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Pressure wash a 2-story house driveway and sidewalk"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <Button onClick={askAi} disabled={askingAi} variant="outline" className="border-titan-cyan/30 text-titan-cyan rounded-xl"><Sparkles className="w-4 h-4 mr-2" />{askingAi ? "Asking AI…" : "Ask AI for estimate"}</Button>
            <Button onClick={() => createDocument("/estimates?prefill=1")} disabled={submitting} className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl"><FilePlus2 className="w-4 h-4 mr-2" />Create Estimate</Button>
            <Button onClick={() => createDocument("/invoices?new=1")} disabled={submitting} variant="outline" className="border-border text-foreground rounded-xl"><Receipt className="w-4 h-4 mr-2" />Create Invoice</Button>
            <Button onClick={saveEstimate} disabled={saving} variant="ghost" className="text-foreground/85 hover:text-foreground rounded-xl">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}{saving ? "Saving…" : "Save price estimate"}</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="text-xs text-muted-foreground grid gap-2">{label}{children}</label>;
}

function Metric({ label, value, positive, prominent = false }) {
  return <div className="flex items-center justify-between gap-3"><span className={prominent ? "text-foreground font-semibold" : "text-muted-foreground text-sm"}>{label}</span><span className={`${prominent ? "text-lg text-titan-cyan" : positive ? "text-titan-cyan" : "text-foreground"} font-bold`}>${Number(value).toLocaleString()}</span></div>;
}
