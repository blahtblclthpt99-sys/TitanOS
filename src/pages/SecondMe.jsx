import React from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Brain,
  Briefcase,
  CheckCircle2,
  History,
  LockKeyhole,
  MemoryStick,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const QUICK_PROMPTS = [
  "What am I forgetting?",
  "What should I do next?",
  "What jobs do I have today?",
  "Who owes me money?",
  "Remember this: ",
  "From now on, ",
];

const FLOW = [
  ["Understand", "Uses only authorized Titan context and durable memories relevant to the request."],
  ["Propose", "Explains what it recommends before changing business data or memory."],
  ["Confirm", "Write actions require confirmation instead of silently executing."],
  ["Act", "Executes the approved action with an auditable result and rollback when supported."],
];

export default function SecondMe() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = React.useState("");

  const openConversation = (value = prompt) => {
    const text = String(value || "").trim();
    if (!text) return;
    navigate(`/assistant?q=${encodeURIComponent(text)}`);
  };

  return (
    <PageShell maxWidth="xl" className="space-y-6">
      <PageHeader
        eyebrow="Invisible Interface"
        title="2nd Self"
        subtitle="One place to ask, remember, understand what matters, and take approved actions across Titan."
      />

      <section className="titan-surface overflow-hidden p-5 md:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground">Tell Titan what you need</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              You do not need to hunt through menus. Ask in plain language; 2nd Self will answer from available context or propose the right next action.
            </p>
          </div>
        </div>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            openConversation();
          }}
        >
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={4}
            placeholder="Example: What am I forgetting today? Or: Remember this: I prefer morning appointments."
            className="min-h-[112px] resize-y bg-muted/30 text-base"
            aria-label="Ask 2nd Self"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Nothing is written or sent without the required authorization and confirmation.</p>
            <Button type="submit" disabled={!prompt.trim()} className="gap-2">
              Continue with 2nd Self <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="2nd Self quick prompts">
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                if (item.endsWith(": ") || item.endsWith(", ")) {
                  setPrompt(item);
                  return;
                }
                openConversation(item);
              }}
              className="rounded-full border border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-ring"
            >
              {item.trim()}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="titan-surface p-5">
          <div className="flex items-center gap-3">
            <MemoryStick className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Memory</p>
              <h2 className="font-semibold text-foreground">Remember what should persist</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            2nd Self can save preferences, decisions, projects, people, routines, business context, and “From now on” rules. Sensitive credentials and payment secrets are rejected from durable memory.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setPrompt("Remember this: ")} className="rounded-lg border border-border p-3 text-left hover:border-primary/40 focus-ring">
              <Brain className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">Remember this</p>
              <p className="mt-1 text-xs text-muted-foreground">Save a fact or preference after confirmation.</p>
            </button>
            <button type="button" onClick={() => setPrompt("From now on, ")} className="rounded-lg border border-border p-3 text-left hover:border-primary/40 focus-ring">
              <History className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold">From now on</p>
              <p className="mt-1 text-xs text-muted-foreground">Create a persistent workflow rule.</p>
            </button>
          </div>
        </div>

        <div className="titan-surface p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Action safety</p>
              <h2 className="font-semibold text-foreground">Understand → Propose → Confirm → Act</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {FLOW.map(([label, description], index) => (
              <div key={label} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="titan-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Across Titan</p>
            <h2 className="mt-1 font-semibold text-foreground">Move directly to the work when you want control</h2>
          </div>
          <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => navigate("/")} className="rounded-xl border border-border p-4 text-left hover:border-primary/40 focus-ring">
            <Briefcase className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">Titan Business</p>
            <p className="mt-1 text-xs text-muted-foreground">Jobs, customers, estimates, invoices, and payments.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
          <button type="button" onClick={() => navigate("/hire/matches")} className="rounded-xl border border-border p-4 text-left hover:border-primary/40 focus-ring">
            <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">Find Work</p>
            <p className="mt-1 text-xs text-muted-foreground">Refresh job matches and manage your opportunity pipeline.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
          <button type="button" onClick={() => navigate("/autopilot")} className="rounded-xl border border-border p-4 text-left hover:border-primary/40 focus-ring">
            <Workflow className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">Titan Auto + Leads</p>
            <p className="mt-1 text-xs text-muted-foreground">Build the pipeline and automate approved repetitive work.</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">Open <ArrowRight className="h-3.5 w-3.5" /></span>
          </button>
        </div>
      </section>
    </PageShell>
  );
}
