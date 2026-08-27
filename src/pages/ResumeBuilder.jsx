import React, { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/AuthContext";
import { getMyProfessionalProfile } from "@/lib/professionalProfileApi";
import { buildApplicationPackage } from "@/lib/resumeBuilder";

const TABS = [
  ["tailoredResume", "Tailored resume"],
  ["masterResume", "Master resume"],
  ["coverLetter", "Cover letter"],
  ["interviewBrief", "Interview brief"],
];

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ResumeBuilder() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [role, setRole] = useState(params.get("role") || "");
  const [company, setCompany] = useState(params.get("company") || "");
  const [jobDescription, setJobDescription] = useState(params.get("description") || "");
  const [active, setActive] = useState("tailoredResume");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        const result = await getMyProfessionalProfile(user);
        if (alive) setProfile(result);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const application = useMemo(
    () => buildApplicationPackage(profile || {}, jobDescription, { role, company }),
    [profile, jobDescription, role, company]
  );

  if (loading) return <PageLoader variant="list" label="Building career documents" />;
  if (error || !profile) return <ErrorState title="Couldn't load your career profile" onRetry={() => window.location.reload()} />;

  const text = application[active] || "";
  const safeRole = (role || "application").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader eyebrow="Career" title="Resume & application package" subtitle="Create ATS-friendly materials from facts already in your TitanOS career profile. Titan never invents experience, credentials or accomplishments." />

      <section className="titan-surface p-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-semibold">Target role</span><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Delivery Driver" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold">Company</span><Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company name" /></label>
        </div>
        <label className="space-y-1.5 block"><span className="text-xs font-semibold">Job description</span><Textarea rows={10} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the full job description here. TitanOS will only emphasize evidence that already exists in your profile." /></label>
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          {application.matchedEvidence.length ? `${application.matchedEvidence.length} profile terms align with this description.` : "Add a job description to identify profile evidence that already matches the role."} No unsupported claims are added.
        </div>
      </section>

      <section className="titan-surface overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          {TABS.map(([key, label]) => <Button key={key} type="button" size="sm" variant={active === key ? "default" : "outline"} onClick={() => setActive(key)}>{label}</Button>)}
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => downloadText(`${safeRole}-${active}.txt`, text)}><Download className="mr-2 h-4 w-4" />Download text</Button>
            <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / Save PDF</Button>
            <Button type="button" variant="outline" onClick={() => downloadText(`${safeRole}-application-package.txt`, [application.tailoredResume, application.coverLetter, application.interviewBrief].join("\n\n==============================\n\n"))}><FileText className="mr-2 h-4 w-4" />Download full package</Button>
            <Button asChild variant="outline"><a href={`/assistant?mode=interview&prompt=${encodeURIComponent(`Help me prepare for ${role || "this job"}${company ? ` at ${company}` : ""}. Use only facts from my actual career profile. Job description: ${jobDescription.slice(0, 5000)}`)}`}><Sparkles className="mr-2 h-4 w-4" />TitanAI prep</a></Button>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-background p-5 text-sm leading-6 text-foreground font-sans">{text || "Your document will appear here."}</pre>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">{application.policy}</p>
    </PageShell>
  );
}
