import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Award,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FormField from "@/components/shared/FormField";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { uid } from "@/lib/localStore";
import {
  SKILL_SUGGESTIONS,
  getMyProfessionalProfile,
  getProfileReviews,
  publicProfilePath,
  saveProfessionalProfile,
} from "@/lib/professionalProfileApi";

const inputClass = "bg-muted border-border text-foreground rounded-md";
const MAX_ACHIEVEMENTS = Math.max(
  1,
  Number.parseInt(import.meta.env.VITE_MAX_PROFILE_ACHIEVEMENTS || "12", 10) || 12
);

function Section({ title, description, children, action }) {
  return (
    <section className="titan-surface p-4 sm:p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function TrustStatus({ verified }) {
  return (
    <div className={`rounded-xl border p-4 ${verified ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${verified ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground"}`}>
          {verified ? <BadgeCheck className="h-5 w-5" aria-hidden="true" /> : <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{verified ? "Verified by TitanOS" : "Verification not established"}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {verified
              ? "This status comes from TitanOS verification records and cannot be edited from your profile."
              : "Verification and reputation badges cannot be self-assigned. TitanOS only displays trust signals backed by platform records."}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviewsMeta, setReviewsMeta] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");

  useEffect(() => {
    if (!authChecked || !user?.id) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [nextProfile, reviews] = await Promise.all([
          getMyProfessionalProfile(user),
          getProfileReviews(user.id),
        ]);
        if (!alive) return;
        setProfile(nextProfile);
        setReviewsMeta({ average: reviews.average, count: reviews.count });
      } catch {
        if (alive) {
          setLoadError(true);
          toast({ variant: "destructive", title: "Couldn't load career profile" });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [authChecked, user?.id]);

  const patch = (partial) => setProfile((current) => ({ ...current, ...partial }));
  const patchSocial = (key, value) => setProfile((current) => ({
    ...current,
    social: { ...(current.social || {}), [key]: value },
  }));

  const addSkill = (candidate = skillDraft) => {
    const skill = String(candidate || "").trim();
    if (!skill) return;
    setProfile((current) => ({
      ...current,
      skills: [...new Set([...(current.skills || []), skill])].slice(0, 24),
    }));
    setSkillDraft("");
  };

  const save = async () => {
    if (!user || !profile || saving) return;
    const achievements = (profile.achievements || []).filter((item) => String(item?.title || "").trim());
    const normalizedTitles = achievements.map((item) => String(item.title).trim().toLocaleLowerCase());
    if (new Set(normalizedTitles).size !== normalizedTitles.length) {
      toast({
        variant: "destructive",
        title: "Remove duplicate achievements",
        description: "Each achievement needs a unique title.",
      });
      return;
    }

    setSaving(true);
    try {
      // Explicit allowlist: never forward verification, badges, ratings, Titan
      // score, completed-job counts or other platform-owned trust claims.
      const saved = await saveProfessionalProfile(user, {
        slug: profile.slug,
        display_name: profile.display_name,
        headline: profile.headline,
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        city: profile.city,
        state: profile.state,
        company_name: profile.company_name,
        social: profile.social,
        skills: profile.skills,
        portfolio: profile.portfolio,
        work_history: profile.work_history,
        achievements,
        public: profile.public,
      });
      setProfile(saved);
      toast({ title: "Career profile saved" });
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't save career profile" });
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || isLoadingAuth || loading) {
    return <PageLoader variant="list" label="Loading career profile" />;
  }
  if (loadError || !profile) {
    return <ErrorState title="Couldn't load career profile" onRetry={() => window.location.reload()} />;
  }

  const publicPath = publicProfilePath(profile.slug);

  return (
    <div className="relative page-pad max-w-4xl mx-auto pb-32 space-y-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-20 w-80 h-80 rounded-full bg-titan-cyan/8 blur-[100px]" />
      </div>

      <div className="relative space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            eyebrow="Career identity"
            title="Career Profile"
            subtitle="Keep the experience, skills and evidence used for matching, resumes and interview preparation accurate."
          />
          <div className="flex flex-wrap gap-2">
            {profile.public ? (
              <Button asChild variant="outline" className="rounded-xl">
                <Link to={publicPath} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> View public
                </Link>
              </Button>
            ) : null}
            <Button onClick={save} disabled={saving} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
            </Button>
          </div>
        </div>

        <TrustStatus verified={profile.verified === true} />

        <Section title="Basics" description="These fields describe you to career tools. Keep them factual and current.">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Display name" value={profile.display_name || ""} onChange={(e) => patch({ display_name: e.target.value })} />
            <FormField label="Public URL slug" value={profile.slug || ""} onChange={(e) => patch({ slug: e.target.value })} />
            <FormField label="Headline" value={profile.headline || ""} onChange={(e) => patch({ headline: e.target.value })} className="sm:col-span-2" />
            <FormField label="City" value={profile.city || ""} onChange={(e) => patch({ city: e.target.value })} />
            <FormField label="State" value={profile.state || ""} onChange={(e) => patch({ state: e.target.value })} />
          </div>
          <label className="block text-sm text-muted-foreground">
            Bio
            <Textarea rows={4} value={profile.bio || ""} onChange={(e) => patch({ bio: e.target.value })} className={`mt-1 ${inputClass}`} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(profile.public)}
                onChange={(e) => patch({ public: e.target.checked })}
                className="accent-cyan-400"
              />
              Public profile
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {reviewsMeta.count > 0 ? `${reviewsMeta.average.toFixed(1)}★ · ${reviewsMeta.count} public reviews` : "No public reviews yet"}
            </span>
          </div>
          {profile.public ? <p className="text-xs text-muted-foreground">Public link: <span className="text-primary">{publicPath}</span></p> : null}
        </Section>

        <Section title="Skills" description="Add skills you can truthfully demonstrate. TitanOS uses them as advisory matching evidence.">
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).map((skill) => (
              <span key={skill} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {skill}
                <button
                  type="button"
                  aria-label={`Remove ${skill}`}
                  onClick={() => setProfile((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill"
              className={inputClass}
            />
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => addSkill()} aria-label="Add skill">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_SUGGESTIONS.filter((skill) => !(profile.skills || []).includes(skill)).slice(0, 10).map((skill) => (
              <button key={skill} type="button" onClick={() => addSkill(skill)} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted">
                + {skill}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Work history"
          description="This is source material for resumes and interview preparation. TitanOS will not invent missing history."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => setProfile((current) => ({
                ...current,
                work_history: [{ id: uid(), role: "", company: "", start: "", end: "Present", summary: "" }, ...(current.work_history || [])],
              }))}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          }
        >
          {(profile.work_history || []).length === 0 ? <p className="text-sm text-muted-foreground">No work history added yet.</p> : null}
          <div className="space-y-3">
            {(profile.work_history || []).map((job, index) => (
              <div key={job.id || index} className="rounded-xl border border-border p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={job.role || ""} placeholder="Role" className={inputClass} onChange={(e) => {
                    const role = e.target.value;
                    setProfile((current) => ({ ...current, work_history: current.work_history.map((row, i) => i === index ? { ...row, role } : row) }));
                  }} />
                  <Input value={job.company || ""} placeholder="Company" className={inputClass} onChange={(e) => {
                    const company = e.target.value;
                    setProfile((current) => ({ ...current, work_history: current.work_history.map((row, i) => i === index ? { ...row, company } : row) }));
                  }} />
                  <Input value={job.start || ""} placeholder="Start date" className={inputClass} onChange={(e) => {
                    const start = e.target.value;
                    setProfile((current) => ({ ...current, work_history: current.work_history.map((row, i) => i === index ? { ...row, start } : row) }));
                  }} />
                  <Input value={job.end || ""} placeholder="End date or Present" className={inputClass} onChange={(e) => {
                    const end = e.target.value;
                    setProfile((current) => ({ ...current, work_history: current.work_history.map((row, i) => i === index ? { ...row, end } : row) }));
                  }} />
                </div>
                <Textarea rows={3} value={job.summary || ""} placeholder="Responsibilities, scope and factual accomplishments" className={inputClass} onChange={(e) => {
                  const summary = e.target.value;
                  setProfile((current) => ({ ...current, work_history: current.work_history.map((row, i) => i === index ? { ...row, summary } : row) }));
                }} />
                <Button type="button" size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => setProfile((current) => ({ ...current, work_history: current.work_history.filter((_, i) => i !== index) }))}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Achievements"
          description="Use factual awards, certifications, milestones or recognition. Platform verification remains separate."
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(profile.achievements || []).length}/{MAX_ACHIEVEMENTS}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl"
                disabled={(profile.achievements || []).length >= MAX_ACHIEVEMENTS}
                onClick={() => setProfile((current) => ({
                  ...current,
                  achievements: [{ id: uid(), title: "", year: String(new Date().getFullYear()), description: "" }, ...(current.achievements || [])],
                }))}
              >
                <Award className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(profile.achievements || []).map((item, index) => (
              <div key={item.id || index} className="rounded-xl border border-border p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                  <Input value={item.title || ""} className={inputClass} placeholder="Achievement" onChange={(e) => {
                    const title = e.target.value;
                    setProfile((current) => ({ ...current, achievements: current.achievements.map((row, i) => i === index ? { ...row, title } : row) }));
                  }} />
                  <Input value={item.year || ""} className={inputClass} placeholder="Year" onChange={(e) => {
                    const year = e.target.value;
                    setProfile((current) => ({ ...current, achievements: current.achievements.map((row, i) => i === index ? { ...row, year } : row) }));
                  }} />
                </div>
                <Textarea rows={2} value={item.description || ""} className={inputClass} placeholder="What happened and why it matters" onChange={(e) => {
                  const description = e.target.value;
                  setProfile((current) => ({ ...current, achievements: current.achievements.map((row, i) => i === index ? { ...row, description } : row) }));
                }} />
                <Button type="button" size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => setProfile((current) => ({ ...current, achievements: current.achievements.filter((_, i) => i !== index) }))}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Portfolio"
          description="Optional evidence of projects or work you want employers or clients to see."
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => setProfile((current) => ({
                ...current,
                portfolio: [{ id: uid(), title: "", description: "", image_url: "", year: String(new Date().getFullYear()) }, ...(current.portfolio || [])],
              }))}
            >
              <ImagePlus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          }
        >
          <div className="space-y-3">
            {(profile.portfolio || []).map((item, index) => (
              <div key={item.id || index} className="rounded-xl border border-border p-3 space-y-2">
                <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
                  <Input value={item.title || ""} placeholder="Project title" className={inputClass} onChange={(e) => {
                    const title = e.target.value;
                    setProfile((current) => ({ ...current, portfolio: current.portfolio.map((row, i) => i === index ? { ...row, title } : row) }));
                  }} />
                  <Input value={item.year || ""} placeholder="Year" className={inputClass} onChange={(e) => {
                    const year = e.target.value;
                    setProfile((current) => ({ ...current, portfolio: current.portfolio.map((row, i) => i === index ? { ...row, year } : row) }));
                  }} />
                </div>
                <Input value={item.image_url || ""} placeholder="Image URL" className={inputClass} onChange={(e) => {
                  const image_url = e.target.value;
                  setProfile((current) => ({ ...current, portfolio: current.portfolio.map((row, i) => i === index ? { ...row, image_url } : row) }));
                }} />
                <Textarea rows={2} value={item.description || ""} placeholder="Project description" className={inputClass} onChange={(e) => {
                  const description = e.target.value;
                  setProfile((current) => ({ ...current, portfolio: current.portfolio.map((row, i) => i === index ? { ...row, description } : row) }));
                }} />
                <Button type="button" size="sm" variant="ghost" className="rounded-xl text-destructive" onClick={() => setProfile((current) => ({ ...current, portfolio: current.portfolio.filter((_, i) => i !== index) }))}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Professional links" description="Add only links you want associated with your public career profile.">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["website", "Website"],
              ["linkedin", "LinkedIn"],
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["youtube", "YouTube"],
              ["x", "X / Twitter"],
            ].map(([key, label]) => (
              <FormField key={key} label={label} value={profile.social?.[key] || ""} onChange={(e) => patchSocial(key, e.target.value)} placeholder="https://" />
            ))}
          </div>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/career/readiness"><ShieldCheck className="mr-1.5 h-4 w-4" /> Career readiness</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/career/resume"><Briefcase className="mr-1.5 h-4 w-4" /> Resume Builder</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/reputation"><Star className="mr-1.5 h-4 w-4" /> Reviews</Link>
            </Button>
          </div>
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
