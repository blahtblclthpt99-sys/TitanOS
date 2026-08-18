import React from "react";
import { useNavigate } from "react-router";
import { BriefcaseBusiness, Building2, CheckCircle2 } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";

const OPTIONS = [
  {
    id: "job_seeker",
    title: "Job Seeker",
    description: "See nearby jobs immediately and let Titan narrow opportunities as your skills, qualifications, location, pay, and availability profile improves.",
    bullets: ["Nearby job feed", "Skill and qualification matching", "Optional business discovery", "TitanAUTO"],
    icon: BriefcaseBusiness,
    destination: "/hire/matches",
  },
  {
    id: "business",
    title: "Business",
    description: "Run the company with TitanOS Business: jobs, customers, scheduling, estimates, invoices, payments, employees, fleet, inventory, records, and recruiting.",
    bullets: ["Business operating system", "Post and manage jobs", "Find matching workers", "TitanAUTO"],
    icon: Building2,
    destination: "/",
  },
];

export default function AccountType() {
  const navigate = useNavigate();
  const { user, checkUserAuth } = useAuth();
  const [saving, setSaving] = React.useState("");

  const choose = async (option) => {
    if (saving) return;
    setSaving(option.id);
    try {
      await api.functions.invoke("setAccountType", { account_type: option.id });
      await checkUserAuth();
      toast({ title: `${option.title} experience selected` });
      navigate(option.destination, { replace: true });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't update account type", description: error?.message || "Try again." });
    } finally {
      setSaving("");
    }
  };

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader
        eyebrow="TitanOS"
        title="How will you use Titan?"
        subtitle="Choose the experience you need. This controls the workspace, not your paid subscription, and you can change it later."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = user?.account_type === option.id;
          return (
            <section key={option.id} className={`titan-surface p-5 ${selected ? "border-primary/50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                {selected ? <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">Current</span> : null}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-foreground">{option.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{option.description}</p>
              <ul className="mt-4 space-y-2">
                {option.bullets.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-foreground/90">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-5 w-full" disabled={Boolean(saving)} onClick={() => choose(option)}>
                {saving === option.id ? "Saving…" : `Use Titan as ${option.title}`}
              </Button>
            </section>
          );
        })}
      </div>
    </PageShell>
  );
}
