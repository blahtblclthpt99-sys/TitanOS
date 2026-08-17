import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, MapPin, Sparkles } from "lucide-react";
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
  employmentType: "gig",
  payType: "flat",
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

  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location is not available on this device" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((old) => ({ ...old, lat: position.coords.latitude, lng: position.coords.longitude }));
        toast({ title: "Job location captured", description: "Titan can use this point for worker radius matching." });
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
        toast({ title: "Job saved on this device", description: "The live Hire board was unavailable, so other users will not see this post yet." });
        navigate("/hire?tab=posts");
      } else {
        toast({ title: "Match-ready job posted", description: "Titan is ranking eligible published workers against these requirements." });
        navigate(`/hire/candidates?job=${encodeURIComponent(job.id)}`);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't post job", description: error.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (!user?.id) return null;

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader eyebrow="Hire" title="Post a match-ready job" subtitle="Tell Titan what the work really requires so qualified people rise to the top instead of relying on title keywords alone." />

      <form onSubmit={submit} className="titan-surface p-5 md:p-7 space-y-6">
        <section className="space-y-4">
          <div>
            <h2 className="font-semibold text-foreground">Job basics</h2>
            <p className="text-xs text-muted-foreground mt-1">These fields appear on the Hire board.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Job title" value={form.title} onChange={(e) => set("title", e.target.value)} required />
            <FormField label="Category"><select value={form.category} onChange={(e) => set("category", e.target.value)} className={fieldClass}>{SERVICE_CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
          </div>
          <FormField label="Description"><Textarea required rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={fieldClass} /></FormField>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <FormField label="State"><select value={form.state} onChange={(e) => set("state", e.target.value)} className={fieldClass}><option value="">Select state</option>{US_STATES.map((value) => <option key={value}>{value}</option>)}</select></FormField>
            <FormField label="Minimum pay"><Input type="number" min="0" value={form.budget_min} onChange={(e) => set("budget_min", e.target.value)} className={fieldClass} /></FormField>
            <FormField label="Maximum pay"><Input type="number" min="0" value={form.budget_max} onChange={(e) => set("budget_max", e.target.value)} className={fieldClass} /></FormField>
            <FormField label="Pay basis"><select value={form.payType} onChange={(e) => set("payType", e.target.value)} className={fieldClass}><option value="flat">Flat / per job</option><option value="hourly">Hourly</option><option value="salary">Salary</option></select></FormField>
            <FormField label="Deadline"><Input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className={fieldClass} /></FormField>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={form.is_same_day} onChange={(e) => set("is_same_day", e.target.checked)} className="accent-primary" />Need service same day</label>
            <label className="flex items-center gap-2 min-h-[44px]"><input type="checkbox" checked={form.is_urgent} onChange={(e) => set("is_urgent", e.target.checked)} className="accent-primary" />Urgent request</label>
          </div>
        </section>

        <section className="border-t border-border pt-6 space-y-4">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />Matching requirements</h2>
            <p className="text-xs text-muted-foreground mt-1">Required credentials are hard filters. Skills, experience, schedule, location and pay influence ranking.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="Required skills" hint="Comma-separated"><Input value={form.requiredSkills} onChange={(e) => set("requiredSkills", e.target.value)} placeholder="delivery, box truck, forklift" className={fieldClass} /></FormField>
            <FormField label="Required certifications" hint="Comma-separated"><Input value={form.requiredCertifications} onChange={(e) => set("requiredCertifications", e.target.value)} placeholder="CDL A, DOT medical card" className={fieldClass} /></FormField>
            <FormField label="Minimum years experience"><Input type="number" min="0" max="80" value={form.minimumYearsExperience} onChange={(e) => set("minimumYearsExperience", e.target.value)} className={fieldClass} /></FormField>
            <FormField label="Employment type"><select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value)} className={fieldClass}><option value="gig">Gig</option><option value="full_time">Full time</option><option value="part_time">Part time</option><option value="contract">Contract</option><option value="temporary">Temporary</option></select></FormField>
            <FormField label="Schedule tags" hint="Comma-separated"><Input value={form.scheduleTags} onChange={(e) => set("scheduleTags", e.target.value)} placeholder="weekday, day, weekend" className={fieldClass} /></FormField>
            <FormField label="Work mode"><select value={form.workMode} onChange={(e) => set("workMode", e.target.value)} className={fieldClass}><option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option></select></FormField>
          </div>

          {form.workMode !== "remote" && (
            <div className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-2"><MapPin className="h-4 w-4" aria-hidden="true" />Use current job location</Button>
              {hasLocation && <Button type="button" variant="ghost" onClick={() => setForm((old) => ({ ...old, lat: null, lng: null }))}>Clear precise location</Button>}
              <p className="text-xs text-muted-foreground">{hasLocation ? "Precise radius matching will be available for this job." : "Without coordinates, Titan falls back to city/state matching."}</p>
            </div>
          )}
        </section>

        <Button type="submit" disabled={saving} className="w-full min-h-[48px] gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}Post match-ready job</Button>
      </form>
    </PageShell>
  );
}
