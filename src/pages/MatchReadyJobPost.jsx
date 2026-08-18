import React, { useState } from "react";
import { useNavigate } from "react-router";
import { BriefcaseBusiness, CheckCircle2, Handshake, Loader2, MapPin, Sparkles } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import FormField from "@/components/shared/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { SERVICE_CATEGORIES, US_STATES } from "@/lib/platformConstants";
import { createMatchReadyHireJob } from "@/lib/matchReadyHirePostApi";
import { DATA_SOURCE, getSource } from "@/lib/dataSource";

const fieldClass = "bg-muted border-border text-foreground rounded-md";
const initial = {
  relationshipType: "employment",
  title: "",
  description: "",
  category: "General",
  city: "",
  state: "",
  budget_min: "",
  budget_max: "",
  deadline: "",
  is_same_day: false,
  is_urgent: false,
  requiredSkills: "",
  requiredCertifications: "",
  minimumYearsExperience: "0",
  employmentType: "full_time",
  payType: "hourly",
  scheduleTags: "",
  workMode: "onsite",
  lat: null,
  lng: null,
};

function csv(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export default function MatchReadyJobPost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const hasLocation = form.lat != null && form.lng != null;
  const employee = form.relationshipType === "employment";

  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  const chooseRelationship = (relationshipType) => {
    setForm((old) => ({
      ...old,
      relationshipType,
      employmentType: relationshipType === "employment" ? "full_time" : "contract",
      payType: relationshipType === "employment" ? "hourly" : "flat",
    }));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location is not available on this device" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((old) => ({ ...old, lat: position.coords.latitude, lng: position.coords.longitude }));
        toast({ title: "Opportunity location captured", description: "Titan can use this point for radius matching." });
      },
      () => toast({ variant: "destructive", title: "Location permission was not granted", description: "You can still post with city/state matching." }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const job = await createMatchReadyHireJob(user, {
        ...form,
        relationship_type: form.relationshipType,
        required_skills: csv(form.requiredSkills),
        required_certifications: csv(form.requiredCertifications),
        minimum_years_experience: Number(form.minimumYearsExperience),
        employment_type: form.employmentType,
        pay_type: form.payType,
        schedule_tags: csv(form.scheduleTags),
        work_mode: form.workMode,
        lat: form.lat,
        lng: form.lng,
      });
      if (getSource(job) === DATA_SOURCE.local) {
        toast({ title: "Opportunity saved on this device", description: "The live board was unavailable, so other users will not see this post yet." });
        navigate("/talent");
      } else if (employee) {
        toast({ title: "Employee opportunity posted", description: "Titan will rank qualified Job Seeker profiles against the employment requirements." });
        navigate(`/hire/candidates?job=${encodeURIComponent(job.id)}`);
      } else {
        toast({ title: "Independent-help opportunity posted", description: "This opportunity is labeled as independent work and will not appear as an employee opening." });
        navigate("/talent");
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't post opportunity", description: error.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (!user?.id) return null;

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader
        eyebrow="Business · Talent"
        title="Create an opportunity"
        subtitle="Start by defining the relationship. Titan keeps employee hiring separate from independent contracting so neither side is misled about the kind of work being offered."
      />

      <form onSubmit={submit} className="titan-surface space-y-6 p-5 md:p-7">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">What do you need?</p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">Choose the work relationship</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => chooseRelationship("employment")} aria-pressed={employee} className={`rounded-xl border p-4 text-left transition-colors focus-ring ${employee ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:border-primary/30"}`}>
              <div className="flex items-start justify-between gap-3"><BriefcaseBusiness className="h-6 w-6 text-primary" aria-hidden="true" />{employee ? <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" /> : null}</div>
              <h3 className="mt-3 font-semibold text-foreground">Hire an Employee</h3>
              <p className="mt-1 text-sm text-muted-foreground">Full-time, part-time, temporary, or seasonal-style employment. This appears only in Job Seeker.</p>
            </button>
            <button type="button" onClick={() => chooseRelationship("contract")} aria-pressed={!employee} className={`rounded-xl border p-4 text-left transition-colors focus-ring ${!employee ? "border-primary bg-primary/5" : "border-border bg-muted/10 hover:border-primary/30"}`}>
              <div className="flex items-start justify-between gap-3"><Handshake className="h-6 w-6 text-primary" aria-hidden="true" />{!employee ? <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" /> : null}</div>
              <h3 className="mt-3 font-semibold text-foreground">Hire Independent Help</h3>
              <p className="mt-1 text-sm text-muted-foreground">Contractor, subcontractor, project, route, one-time service, or recurring independent help. This appears only in Independent Work.</p>
            </button>
          </div>
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
            Titan labels the relationship you choose; it does not determine legal worker classification for you. Use the relationship that accurately reflects the arrangement you intend to offer.
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="font-semibold text-foreground">Opportunity basics</h2>
            <p className="mt-1 text-xs text-muted-foreground">These fields are shown to {employee ? "Job Seekers" : "Independent Work users"}.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={employee ? "Job title" : "Project / service title"} value={form.title} onChange={(e) => set("title", e.target.value)} required />
            <FormField label="Category"><select value={form.category} onChange={(e) => set("category", e.target.value)} className={fieldClass}>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
          </div>
          <FormField label="Description"><Textarea required rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={fieldClass} /></FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <FormField label="State"><select value={form.state} onChange={(e) => set("state", e.target.value)} className={fieldClass}><option value="">Select state</option>{US_STATES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label={employee ? "Minimum compensation" : "Minimum project budget"}><Input type="number" min="0" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} className={fieldClass} /></FormField>
            <FormField label={employee ? "Maximum compensation" : "Maximum project budget"}><Input type="number" min="0" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} className={fieldClass} /></FormField>
            <FormField label="Pay basis"><select value={form.payType} onChange={(e) => set("payType", e.target.value)} className={fieldClass}>{employee ? <><option value="hourly">Hourly</option><option value="salary">Salary</option></> : <><option value="flat">Flat / project</option><option value="hourly">Hourly</option><option value="per_mile">Per mile</option><option value="per_stop">Per stop</option></>}</select></FormField>
            <FormField label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className={fieldClass} /></FormField>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={form.is_same_day} onChange={(e) => set("is_same_day", e.target.checked)} className="accent-primary" />Same-day need</label>
            <label className="flex min-h-[44px] items-center gap-2"><input type="checkbox" checked={form.is_urgent} onChange={(e) => set("is_urgent", e.target.checked)} className="accent-primary" />Urgent</label>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />Matching requirements</h2>
            <p className="mt-1 text-xs text-muted-foreground">Required credentials are hard filters. Skills, experience, schedule, location, and compensation influence qualification matching. Engagement never enters this calculation.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Required skills" hint="Comma-separated"><Input value={form.requiredSkills} onChange={(e) => set("requiredSkills", e.target.value)} placeholder="delivery, box truck, forklift" className={fieldClass} /></FormField>
            <FormField label="Required certifications" hint="Comma-separated"><Input value={form.requiredCertifications} onChange={(e) => set("requiredCertifications", e.target.value)} placeholder="CDL A, DOT medical card" className={fieldClass} /></FormField>
            <FormField label="Minimum years experience"><Input type="number" min="0" max="80" value={form.minimumYearsExperience} onChange={(e) => set("minimumYearsExperience", e.target.value)} className={fieldClass} /></FormField>
            <FormField label={employee ? "Employment type" : "Independent arrangement"}>
              <select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} className={fieldClass}>
                {employee ? <><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="temporary">Temporary / seasonal</option></> : <><option value="contract">Contract / subcontract</option><option value="gig">One-time / project</option><option value="temporary">Short-term independent help</option></>}
              </select>
            </FormField>
            <FormField label="Schedule tags" hint="Comma-separated"><Input value={form.scheduleTags} onChange={(e) => set("scheduleTags", e.target.value)} placeholder="weekday, day, weekend" className={fieldClass} /></FormField>
            <FormField label="Work mode"><select value={form.workMode} onChange={(e) => set("workMode", e.target.value)} className={fieldClass}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></FormField>
          </div>

          {form.workMode !== "remote" ? (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />Use current opportunity location</Button>
              {hasLocation ? <Button type="button" variant="ghost" onClick={() => setForm((old) => ({ ...old, lat: null, lng: null }))}>Clear precise location</Button> : null}
              <p className="text-xs text-muted-foreground">{hasLocation ? "Precise radius matching will be available." : "Without coordinates, Titan falls back to city/state matching."}</p>
            </div>
          ) : null}
        </section>

        <Button type="submit" disabled={saving} className="min-h-[48px] w-full gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : employee ? <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" /> : <Handshake className="h-4 w-4" aria-hidden="true" />}{saving ? "Posting…" : employee ? "Post Employee Opportunity" : "Post Independent Opportunity"}</Button>
      </form>
    </PageShell>
  );
}
