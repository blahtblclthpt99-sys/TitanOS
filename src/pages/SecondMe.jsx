import React from "react";
import { Link } from "react-router";
import { Brain, Bot, Workflow, ShieldCheck } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";

const AREAS = [
  {
    title: "Memory & Context",
    description: "The long-term layer TitanOS uses to understand authorized preferences, work patterns, goals, and relevant context.",
    icon: Brain,
  },
  {
    title: "TitanAI",
    description: "Ask questions, analyze TitanOS information, create content, and perform approved actions.",
    icon: Bot,
    path: "/assistant",
    action: "Open TitanAI",
  },
  {
    title: "Autopilot",
    description: "Manage approved recurring actions, reminders, monitoring, and automation history.",
    icon: Workflow,
    path: "/autopilot",
    action: "Open Autopilot",
  },
];

export default function SecondMe() {
  return (
    <PageShell maxWidth="xl">
      <PageHeader
        eyebrow="Intelligence"
        title="Second Me"
        subtitle="Your long-term TitanOS context layer — separate from active TitanAI conversations and Autopilot automation."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {AREAS.map((area) => {
          const Icon = area.icon;
          const content = (
            <>
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="font-semibold text-foreground">{area.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{area.description}</p>
              {area.action ? <p className="mt-4 text-sm font-semibold text-primary">{area.action}</p> : null}
            </>
          );
          return area.path ? (
            <Link key={area.title} to={area.path} className="rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40 hover:bg-muted/30 focus-ring">
              {content}
            </Link>
          ) : (
            <div key={area.title} className="rounded-xl border border-border bg-card p-5 shadow-soft">{content}</div>
          );
        })}
      </div>

      <div className="mt-5 flex gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p>Second Me does not grant broader permissions. Memory retrieval and generated actions remain subject to the same account, tenant, authorization, confirmation, and safety boundaries as the rest of TitanOS.</p>
      </div>
    </PageShell>
  );
}
