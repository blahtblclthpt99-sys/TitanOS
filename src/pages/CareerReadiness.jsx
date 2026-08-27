import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, CircleAlert, Sparkles, Target } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { getMyProfessionalProfile } from "@/lib/professionalProfileApi";
import { assessCareerReadiness, buildInterviewPrepPrompt } from "@/lib/careerReadiness";

export default function CareerReadiness() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authChecked || !user?.id) return;
    let alive = true;
    getMyProfessionalProfile(user)
      .then((value) => { if (alive) setProfile(value); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authChecked, user?.id]);

  const assessment = useMemo(() => profile ? assessCareerReadiness(profile, jobDescription) : null, [profile, jobDescription]);

  if (!authChecked || isLoadingAuth || loading || !profile || !assessment) {
    return <PageLoader variant="list" label="Loading career readiness" />;
  }

  const launchInterviewPrep = () => {
    const prompt = buildInterviewPrepPrompt(profile, jobDescription, assessment);
    navigate(`/assistant?mode=interview&q=${encodeURIComponent(prompt)}`);
  };

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader eyebrow="Career" title="Career readiness" subtitle="Compare your own profile with a job description before you apply. This score is private coaching, not an employer decision." />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Readiness</p><p className="mt-1 text-3xl font-bold">{assessment.score}%</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Profile completeness</p><p className="mt-1 text-3xl font-bold">{assessment.completeness.score}%</p></div>
        <div className="titan-surface p-4"><p className="text-xs text-muted-foreground">Skills on profile</p><p className="mt-1 text-3xl font-bold">{(profile.skills || []).length}</p></div>
      </section>

      <section className="titan-surface p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">Target job description</h2>
          <p className="mt-1 text-xs text-muted-foreground">Paste the real listing. Titan analyzes it locally for preparation and does not treat the result as hiring eligibility.</p>
        </div>
        <Textarea rows={10} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description here…" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={launchInterviewPrep} disabled={!jobDescription.trim()}><Sparkles className="mr-2 h-4 w-4" />Prepare for interview</Button>
          <Button asChild variant="outline"><Link to="/profile">Improve career profile</Link></Button>
          <Button asChild variant="outline"><Link to="/hire/matches">Back to matches</Link></Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="titan-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4 text-success" />Profile checklist</h2>
          <div className="mt-4 space-y-2">
            {assessment.completeness.checks.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span>{item.label}</span><span className={item.complete ? "text-success" : "text-muted-foreground"}>{item.complete ? "Ready" : "Needs attention"}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="titan-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Target className="h-4 w-4 text-primary" />Job alignment</h2>
          {!jobDescription.trim() ? <p className="mt-3 text-sm text-muted-foreground">Paste a job description to see matched terms and preparation gaps.</p> : (
            <div className="mt-4 space-y-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Already reflected in your profile</p><p className="mt-1 text-sm">{assessment.matchedTerms.join(", ") || "No clear overlaps yet"}</p></div>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terms to review</p><p className="mt-1 text-sm">{assessment.missingTerms.join(", ") || "No obvious gaps identified"}</p></div>
              {assessment.missingCredentials.length ? <div className="rounded-lg border border-warning/30 bg-warning/5 p-3"><p className="flex items-center gap-2 text-sm font-semibold text-warning"><CircleAlert className="h-4 w-4" />Credentials mentioned but not on your profile</p><p className="mt-1 text-xs text-muted-foreground">{assessment.missingCredentials.join(", ")}. Do not claim these unless you actually hold them.</p></div> : null}
            </div>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{assessment.disclaimer}</p>
    </PageShell>
  );
}
