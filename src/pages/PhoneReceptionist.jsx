import React, { useEffect, useState } from "react";
import { Phone, Plus, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import {
  answerFromScript,
  createPhoneScript,
  deletePhoneScript,
  getOrCreatePhoneScript,
  listPhoneScripts,
  updatePhoneScript,
} from "@/lib/phoneScriptApi";

export default function PhoneReceptionist() {
  const { user, authChecked } = useAuth();
  const [scripts, setScripts] = useState([]);
  const [script, setScript] = useState(null);
  const [utterance, setUtterance] = useState("");
  const [log, setLog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (preferId) => {
    if (!user?.id) return;
    let rows = await listPhoneScripts(user.id);
    if (!rows.length) {
      const created = await getOrCreatePhoneScript(user);
      rows = [created];
    }
    setScripts(rows);
    const selected =
      rows.find((r) => r.id === preferId) ||
      rows.find((r) => r.id === script?.id) ||
      rows[0];
    setScript(selected);
    setLog([{ role: "bot", text: selected.greeting }]);
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    load()
      .catch(() => toast({ variant: "destructive", title: "Couldn't load phone scripts" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, user?.id]);

  const selectScript = (row) => {
    setScript(row);
    setLog([{ role: "bot", text: row.greeting }]);
  };

  const save = async () => {
    if (!script) return;
    setSaving(true);
    try {
      const saved = await updatePhoneScript(user.id, script.id, {
        name: script.name,
        greeting: script.greeting,
        transfer_number: script.transfer_number,
        faq_json: script.faq_json,
      });
      setScript(saved);
      setScripts((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      toast({ title: "Script saved" });
    } catch (err) {
      toast({ title: "Couldn't save script", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addScript = async () => {
    const created = await createPhoneScript(user, { name: `Script ${scripts.length + 1}` });
    setScripts((prev) => [created, ...prev]);
    selectScript(created);
    toast({ title: "Script created" });
  };

  const removeScript = async () => {
    if (!script || scripts.length <= 1) {
      toast({ title: "Keep at least one script", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete “${script.name || "this script"}”?`)) return;
    setDeleting(true);
    try {
      await deletePhoneScript(user.id, script.id);
      const next = scripts.filter((r) => r.id !== script.id);
      setScripts(next);
      selectScript(next[0]);
      toast({ title: "Script deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const removeFaq = (index) => {
    const faqs = Array.isArray(script.faq_json) ? [...script.faq_json] : [];
    faqs.splice(index, 1);
    setScript({ ...script, faq_json: faqs });
  };

  const addFaq = () => {
    const faqs = Array.isArray(script.faq_json) ? [...script.faq_json] : [];
    faqs.push({ q: "New question", a: "Answer…" });
    setScript({ ...script, faq_json: faqs });
  };

  const ask = (e) => {
    e.preventDefault();
    if (!utterance.trim() || !script) return;
    const reply = answerFromScript(script, utterance);
    setLog((prev) => [...prev, { role: "caller", text: utterance }, { role: "bot", text: reply }]);
    setUtterance("");
  };

  if (!authChecked || (loading && !script)) return <PageLoader variant="list" label="Loading scripts" />;
  if (!user?.id) {
    return (
      <PageShell maxWidth="lg">
        <PageHeader
          eyebrow="Labs · Preview"
          title="Phone scripts"
          subtitle="Write a greeting and FAQ, then practice replies — not a live phone line."
        />
        <EmptyState
          title="Sign in to manage phone scripts"
          description="Creating and editing scripts requires an account."
          actionLabel="Sign in"
          onAction={() => { window.location.href = "/login"; }}
        />
      </PageShell>
    );
  }
  if (!script) return <PageLoader variant="list" label="Loading scripts" />;

  const faqs = Array.isArray(script.faq_json) ? script.faq_json : [];

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Labs · Preview"
        title="Phone scripts"
        subtitle="Write a greeting and FAQ, then practice replies — not a live phone line."
      />
      <FeatureHonestyBanner>
        Script editor and practice simulator only. No Twilio, carrier, transfer, or voicemail. Scripts may
        save on this device if cloud sync is unavailable.
      </FeatureHonestyBanner>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {scripts.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => selectScript(row)}
            className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
              row.id === script.id
                ? "border-primary/30 bg-primary/15 text-primary"
                : "border-border bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {row.name || "Untitled script"}
          </button>
        ))}
        <Button type="button" variant="outline" onClick={addScript} className="h-9">
          <Plus className="mr-1 h-4 w-4" aria-hidden="true" /> New script
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="titan-surface space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Phone className="h-5 w-5" aria-hidden="true" /> Script editor
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting || scripts.length <= 1}
              onClick={removeScript}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          <Input
            value={script.name || ""}
            onChange={(e) => setScript({ ...script, name: e.target.value })}
            placeholder="Script name"
          />
          <Textarea
            value={script.greeting || ""}
            onChange={(e) => setScript({ ...script, greeting: e.target.value })}
            placeholder="Greeting"
            rows={3}
          />
          <Input
            value={script.transfer_number || ""}
            onChange={(e) => setScript({ ...script, transfer_number: e.target.value })}
            placeholder="Transfer number (display only)"
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">FAQ matches</p>
              <Button type="button" variant="outline" size="sm" onClick={addFaq}>
                Add FAQ
              </Button>
            </div>
            {faqs.map((item, index) => (
              <div key={index} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFaq(index)}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
                <Input
                  value={item.q}
                  onChange={(e) => {
                    const next = [...faqs];
                    next[index] = { ...next[index], q: e.target.value };
                    setScript({ ...script, faq_json: next });
                  }}
                  placeholder="Question keywords"
                />
                <Textarea
                  value={item.a}
                  onChange={(e) => {
                    const next = [...faqs];
                    next[index] = { ...next[index], a: e.target.value };
                    setScript({ ...script, faq_json: next });
                  }}
                  rows={2}
                  placeholder="Answer"
                />
              </div>
            ))}
            {!faqs.length && (
              <p className="text-xs text-muted-foreground">
                No FAQ entries. Add one or save defaults from a new script.
              </p>
            )}
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save script"}
          </Button>
        </section>

        <section className="titan-surface flex min-h-[420px] flex-col p-5">
          <h2 className="mb-3 font-semibold text-foreground">Practice simulator</h2>
          <div className="mb-3 max-h-80 flex-1 space-y-2 overflow-y-auto">
            {log.map((msg, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
                  msg.role === "bot"
                    ? "bg-primary/10 text-foreground"
                    : "ml-auto bg-muted text-foreground"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <form onSubmit={ask} className="flex gap-2">
            <Input
              value={utterance}
              onChange={(e) => setUtterance(e.target.value)}
              placeholder="Caller says…"
            />
            <Button type="submit" size="icon" aria-label="Send practice message">
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
