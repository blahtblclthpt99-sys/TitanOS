import React from "react";
import { useNavigate } from "react-router";
import { BriefcaseBusiness, Building2, CheckCircle2, Hammer, Layers3 } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import {
  WORKSPACES,
  activeWorkspace,
  enabledWorkspaces,
} from "@/lib/accountExperience";

const OPTIONS = [
  {
    id: WORKSPACES.JOB_SEEKER,
    title: "Find a Job",
    label: "Job Seeker",
    description: "Find employers looking for someone with your skills and qualifications.",
    bullets: ["Nearby employment", "Qualification matching", "Employer discovery", "TitanAUTO"],
    icon: BriefcaseBusiness,
    destination: "/hire/matches",
  },
  {
    id: WORKSPACES.SELF_EMPLOYED,
    title: "Find Independent Work",
    label: "Independent Work",
    description: "Find customers and businesses needing services, projects, routes, contracts, or subcontracting help.",
    bullets: ["Service opportunities", "Service profile", "Quotes and invoices", "Lightweight Business OS"],
    icon: Hammer,
    destination: "/independent",
  },
  {
    id: WORKSPACES.BUSINESS,
    title: "Run a Business",
    label: "Business",
    description: "Manage a company, customers, workers, jobs, money, recruiting, fleet, and operations.",
    bullets: ["Full Business OS", "Employee and contractor hiring", "Teams and fleet", "TitanAUTO"],
    icon: Building2,
    destination: "/",
  },
];

export default function AccountType() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const initialEnabled = React.useMemo(() => enabledWorkspaces(user), [user]);
  const initialActive = React.useMemo(() => activeWorkspace(user), [user]);
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [active, setActive] = React.useState(initialActive);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setEnabled(initialEnabled);
    setActive(initialActive);
  }, [initialEnabled, initialActive]);

  const toggle = (id) => {
    setEnabled((current) => {
      const exists = current.includes(id);
      if (exists && current.length === 1) {
        toast({ title: "Keep at least one workspace enabled" });
        return current;
      }
      const next = exists ? current.filter((item) => item !== id) : [...current, id];
      if (!next.includes(active)) setActive(next[0]);
      return next;
    });
  };

  const save = async () => {
    if (saving || !enabled.length || !enabled.includes(active)) return;
    setSaving(true);
    try {
      await api.functions.invoke("setWorkspaces", {
        enabled_workspaces: enabled,
        active_workspace: active,
      });
      await checkUserAuth();
      const option = OPTIONS.find((item) => item.id === active);
      toast({
        title: `${option?.label || "Titan"} workspace active`,
        description: enabled.length > 1 ? `${enabled.length} workspaces are enabled and remain separate.` : "You can enable more workspaces anytime.",
      });
      navigate(option?.destination || "/", { replace: true });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't update Titan workspaces", description: error?.message || "Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="TitanOS Workspaces"
        title="What are you looking to do?"
        subtitle="Enable one or more ways of working. Titan keeps each interface separate, and workspace selection never changes your paid subscription by itself."
      />

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex gap-3">
          <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">More than one is supported</p>
            <p className="mt-1 text-sm text-muted-foreground">For example, you can look for a full-time job while also taking independent weekend projects. Only the active workspace appears in navigation.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isEnabled = enabled.includes(option.id);
          const isActive = active === option.id;
          return (
            <section key={option.id} className={`titan-surface p-5 ${isActive ? "border-primary/60" : isEnabled ? "border-primary/30" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {isEnabled ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Enabled</span> : null}
                  {isActive ? <span className="rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-success">Active</span> : null}
                </div>
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">{option.label}</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">{option.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
              <ul className="mt-4 space-y-2">
                {option.bullets.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid gap-2">
                <Button type="button" variant={isEnabled ? "outline" : "default"} onClick={() => toggle(option.id)}>
                  {isEnabled ? "Disable workspace" : "Enable workspace"}
                </Button>
                {isEnabled ? (
                  <Button type="button" variant={isActive ? "secondary" : "ghost"} disabled={isActive} onClick={() => setActive(option.id)}>
                    {isActive ? "Active workspace" : `Make ${option.label} active`}
                  </Button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-20 z-10 rounded-xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur md:bottom-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">{enabled.length} workspace{enabled.length === 1 ? "" : "s"} enabled</p>
            <p className="text-xs text-muted-foreground">The active workspace determines the current navigation and home screen.</p>
          </div>
          <Button type="button" disabled={saving || !enabled.includes(active)} onClick={save} className="min-w-40">
            {saving ? "Saving…" : "Save workspaces"}
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
