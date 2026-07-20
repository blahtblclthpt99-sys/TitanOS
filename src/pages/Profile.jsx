import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
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
  BADGE_CATALOG,
  SKILL_SUGGESTIONS,
  getMyProfessionalProfile,
  getProfileReviews,
  publicProfilePath,
  saveProfessionalProfile,
} from "@/lib/professionalProfileApi";

const inputClass = "bg-muted border-border text-foreground rounded-md";

function Section({ title, children, action }) {
  return (
    <section className="titan-surface p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Profile() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [profile, setProfile] = useState(null);
  const [reviewsMeta, setReviewsMeta] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [skillDraft, setSkillDraft] = useState("");

  useEffect(() => {
    if (!authChecked || !user?.id) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const [p, rev] = await Promise.all([
          getMyProfessionalProfile(user),
          getProfileReviews(user.id),
        ]);
        if (!alive) return;
        setProfile(p);
        setReviewsMeta({ average: rev.average, count: rev.count });
      } catch {
        if (alive) {
          setLoadError(true);
          toast({ variant: "destructive", title: "Couldn't load profile" });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authChecked, user?.id]);

  const patch = (partial) => setProfile((p) => ({ ...p, ...partial }));
  const patchSocial = (key, value) =>
    setProfile((p) => ({ ...p, social: { ...p.social, [key]: value } }));

  const addSkill = (skill) => {
    const s = String(skill || skillDraft).trim();
    if (!s) return;
    setProfile((p) => ({
      ...p,
      skills: [...new Set([...(p.skills || []), s])].slice(0, 24),
    }));
    setSkillDraft("");
  };

  const save = async () => {
    if (!user || !profile || saving) return;
    setSaving(true);
    try {
      const saved = await saveProfessionalProfile(user, profile);
      setProfile(saved);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
      toast({ title: "Professional profile saved" });
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't save profile" });
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || isLoadingAuth || loading) {
    return <PageLoader variant="list" label="Loading profile" />;
  }
  if (loadError || !profile) {
    return (
      <ErrorState
        title="Couldn't load profile"
        onRetry={() => window.location.reload()}
      />
    );
  }

  const publicPath = publicProfilePath(profile.slug);

  return (
    <div className="relative page-pad max-w-3xl mx-auto pb-32 space-y-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-20 w-80 h-80 rounded-full bg-titan-cyan/8 blur-[100px]" />
      </div>

      <div className="relative space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <PageHeader
            title="Professional profile"
            subtitle="Bio, portfolio, skills, verification, and public reviews"
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link to={publicPath} target="_blank" rel="noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" /> View public
              </Link>
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save profile"}
            </Button>
          </div>
        </div>

        <Section title="Basics">
          <div className="grid sm:grid-cols-2 gap-3">
            <FormField label="Display name" value={profile.display_name || ""} onChange={(e) => patch({ display_name: e.target.value })} />
            <FormField label="Public URL slug" value={profile.slug || ""} onChange={(e) => patch({ slug: e.target.value })} />
            <FormField label="Headline" value={profile.headline || ""} onChange={(e) => patch({ headline: e.target.value })} className="sm:col-span-2" />
            <FormField label="City" value={profile.city || ""} onChange={(e) => patch({ city: e.target.value })} />
            <FormField label="State" value={profile.state || ""} onChange={(e) => patch({ state: e.target.value })} />
          </div>
          <label className="block text-sm text-muted-foreground">
            Bio
            <Textarea
              rows={4}
              value={profile.bio || ""}
              onChange={(e) => patch({ bio: e.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profile.public)}
                onChange={(e) => patch({ public: e.target.checked })}
                className="accent-cyan-400"
              />
              Public profile
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profile.verified)}
                onChange={(e) =>
                  patch({
                    verified: e.target.checked,
                    badges: e.target.checked
                      ? [...new Set([...(profile.badges || []), "verified"])]
                      : (profile.badges || []).filter((b) => b !== "verified"),
                  })
                }
                className="accent-cyan-400"
              />
              <BadgeCheck className="w-4 h-4 text-titan-cyan" /> Show verified badge
            </label>
            <span className="text-xs text-muted-foreground">
              {reviewsMeta.count
                ? `${reviewsMeta.average.toFixed(1)}★ · ${reviewsMeta.count} reviews`
                : "No reviews yet"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Public link: <span className="text-titan-cyan">{publicPath}</span>
          </p>
        </Section>

        <Section title="Social links">
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              ["website", "Website"],
              ["linkedin", "LinkedIn"],
              ["instagram", "Instagram"],
              ["facebook", "Facebook"],
              ["youtube", "YouTube"],
              ["x", "X / Twitter"],
            ].map(([key, label]) => (
              <FormField
                key={key}
                label={label}
                value={profile.social?.[key] || ""}
                onChange={(e) => patchSocial(key, e.target.value)}
                placeholder="https://"
              />
            ))}
          </div>
        </Section>

        <Section title="Skills">
          <div className="flex flex-wrap gap-2">
            {(profile.skills || []).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-titan-cyan/10 text-titan-cyan px-3 py-1 text-xs font-semibold"
              >
                {skill}
                <button
                  type="button"
                  aria-label={`Remove ${skill}`}
                  onClick={() =>
                    setProfile((p) => ({ ...p, skills: p.skills.filter((s) => s !== skill) }))
                  }
                >
                  <X className="w-3 h-3" />
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
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => addSkill()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILL_SUGGESTIONS.filter((s) => !(profile.skills || []).includes(s)).slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSkill(s)}
                className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:bg-muted"
              >
                + {s}
              </button>
            ))}
          </div>
        </Section>

        <Section
          title="Portfolio"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  portfolio: [
                    {
                      id: uid(),
                      title: "New project",
                      description: "",
                      image_url: "",
                      year: String(new Date().getFullYear()),
                    },
                    ...(p.portfolio || []),
                  ],
                }))
              }
            >
              <ImagePlus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          }
        >
          {(profile.portfolio || []).length === 0 && (
            <p className="text-sm text-muted-foreground">Add photos and project write-ups.</p>
          )}
          <div className="space-y-3">
            {(profile.portfolio || []).map((item, idx) => (
              <div key={item.id || idx} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <Input
                    value={item.title || ""}
                    onChange={(e) => {
                      const title = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        portfolio: p.portfolio.map((row, i) => (i === idx ? { ...row, title } : row)),
                      }));
                    }}
                    className={inputClass}
                    placeholder="Project title"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="rounded-md shrink-0"
                    aria-label="Remove portfolio item"
                    onClick={() =>
                      setProfile((p) => ({
                        ...p,
                        portfolio: p.portfolio.filter((_, i) => i !== idx),
                      }))
                    }
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
                <Input
                  value={item.image_url || ""}
                  onChange={(e) => {
                    const image_url = e.target.value;
                    setProfile((p) => ({
                      ...p,
                      portfolio: p.portfolio.map((row, i) => (i === idx ? { ...row, image_url } : row)),
                    }));
                  }}
                  className={inputClass}
                  placeholder="Image URL"
                />
                <Textarea
                  rows={2}
                  value={item.description || ""}
                  onChange={(e) => {
                    const description = e.target.value;
                    setProfile((p) => ({
                      ...p,
                      portfolio: p.portfolio.map((row, i) => (i === idx ? { ...row, description } : row)),
                    }));
                  }}
                  className={inputClass}
                  placeholder="Description"
                />
                <Input
                  value={item.year || ""}
                  onChange={(e) => {
                    const year = e.target.value;
                    setProfile((p) => ({
                      ...p,
                      portfolio: p.portfolio.map((row, i) => (i === idx ? { ...row, year } : row)),
                    }));
                  }}
                  className={`${inputClass} max-w-[120px]`}
                  placeholder="Year"
                />
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Work history"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  work_history: [
                    {
                      id: uid(),
                      role: "Role",
                      company: "Company",
                      start: "",
                      end: "Present",
                      summary: "",
                    },
                    ...(p.work_history || []),
                  ],
                }))
              }
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          }
        >
          <div className="space-y-3">
            {(profile.work_history || []).map((job, idx) => (
              <div key={job.id || idx} className="rounded-xl border border-border p-3 space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <Input
                    value={job.role || ""}
                    placeholder="Role"
                    className={inputClass}
                    onChange={(e) => {
                      const role = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        work_history: p.work_history.map((row, i) => (i === idx ? { ...row, role } : row)),
                      }));
                    }}
                  />
                  <Input
                    value={job.company || ""}
                    placeholder="Company"
                    className={inputClass}
                    onChange={(e) => {
                      const company = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        work_history: p.work_history.map((row, i) => (i === idx ? { ...row, company } : row)),
                      }));
                    }}
                  />
                  <Input
                    value={job.start || ""}
                    placeholder="Start"
                    className={inputClass}
                    onChange={(e) => {
                      const start = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        work_history: p.work_history.map((row, i) => (i === idx ? { ...row, start } : row)),
                      }));
                    }}
                  />
                  <Input
                    value={job.end || ""}
                    placeholder="End"
                    className={inputClass}
                    onChange={(e) => {
                      const end = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        work_history: p.work_history.map((row, i) => (i === idx ? { ...row, end } : row)),
                      }));
                    }}
                  />
                </div>
                <Textarea
                  rows={2}
                  value={job.summary || ""}
                  placeholder="Summary"
                  className={inputClass}
                  onChange={(e) => {
                    const summary = e.target.value;
                    setProfile((p) => ({
                      ...p,
                      work_history: p.work_history.map((row, i) => (i === idx ? { ...row, summary } : row)),
                    }));
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-destructive"
                  onClick={() =>
                    setProfile((p) => ({
                      ...p,
                      work_history: p.work_history.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Achievements"
          action={
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() =>
                setProfile((p) => ({
                  ...p,
                  achievements: [
                    {
                      id: uid(),
                      title: "Achievement",
                      year: String(new Date().getFullYear()),
                      description: "",
                    },
                    ...(p.achievements || []),
                  ],
                }))
              }
            >
              <Award className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          }
        >
          <div className="space-y-3">
            {(profile.achievements || []).map((item, idx) => (
              <div key={item.id || idx} className="rounded-xl border border-border p-3 space-y-2">
                <div className="grid sm:grid-cols-[1fr_100px] gap-2">
                  <Input
                    value={item.title || ""}
                    className={inputClass}
                    placeholder="Title"
                    onChange={(e) => {
                      const title = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        achievements: p.achievements.map((row, i) => (i === idx ? { ...row, title } : row)),
                      }));
                    }}
                  />
                  <Input
                    value={item.year || ""}
                    className={inputClass}
                    placeholder="Year"
                    onChange={(e) => {
                      const year = e.target.value;
                      setProfile((p) => ({
                        ...p,
                        achievements: p.achievements.map((row, i) => (i === idx ? { ...row, year } : row)),
                      }));
                    }}
                  />
                </div>
                <Textarea
                  rows={2}
                  value={item.description || ""}
                  className={inputClass}
                  placeholder="Description"
                  onChange={(e) => {
                    const description = e.target.value;
                    setProfile((p) => ({
                      ...p,
                      achievements: p.achievements.map((row, i) =>
                        i === idx ? { ...row, description } : row
                      ),
                    }));
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-xl text-destructive"
                  onClick={() =>
                    setProfile((p) => ({
                      ...p,
                      achievements: p.achievements.filter((_, i) => i !== idx),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Badges">
          <div className="grid sm:grid-cols-2 gap-2">
            {BADGE_CATALOG.map((badge) => {
              const on = (profile.badges || []).includes(badge.id);
              return (
                <button
                  key={badge.id}
                  type="button"
                  onClick={() =>
                    setProfile((p) => ({
                      ...p,
                      badges: on
                        ? p.badges.filter((b) => b !== badge.id)
                        : [...(p.badges || []), badge.id],
                    }))
                  }
                  className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                    on
                      ? "border-titan-cyan bg-titan-cyan/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-semibold text-foreground">{badge.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                </button>
              );
            })}
          </div>
        </Section>

        <div className="flex justify-end gap-2 pt-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/reputation">
              <Star className="w-4 h-4 mr-1.5" /> Reviews
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link to="/credentials">
              <Briefcase className="w-4 h-4 mr-1.5" /> Credentials
            </Link>
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-titan-cyan text-black hover:bg-titan-cyan/90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
