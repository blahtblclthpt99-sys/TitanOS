import React, { useEffect, useState } from "react";
import { Phone, Plus, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import {
  answerFromScript,
  createPhoneScript,
  deletePhoneScript,
  getOrCreatePhoneScript,
  listPhoneScripts,
  updatePhoneScript,
} from "@/lib/phoneScriptApi";

export default function PhoneReceptionist() {
  const { user } = useAuth();
  const [scripts, setScripts] = useState([]);
  const [script, setScript] = useState(null);
  const [utterance, setUtterance] = useState("");
  const [log, setLog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    if (!script) return;
    if (scripts.length <= 1) {
      toast({ title: "Keep at least one script", variant: "destructive" });
      return;
    }
    if (!window.confirm(`Delete “${script.name || "this script"}”? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const id = script.id;
      await deletePhoneScript(user.id, id);
      const next = scripts.filter((r) => r.id !== id);
      setScripts(next);
      selectScript(next[0]);
      toast({ title: "Script deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete script", description: err.message, variant: "destructive" });
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

  if (!script) return <div className="p-8 text-muted-foreground">Loading receptionist…</div>;

  const faqs = Array.isArray(script.faq_json) ? script.faq_json : [];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="AI Phone Receptionist" subtitle="Scripts, FAQs, and a call simulator (telephony connect later)" />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {scripts.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => selectScript(row)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              row.id === script.id
                ? "bg-titan-cyan/15 text-titan-cyan border-titan-cyan/30"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {row.name || "Untitled script"}
          </button>
        ))}
        <Button type="button" variant="outline" onClick={addScript} className="border-border text-foreground h-9">
          <Plus className="w-4 h-4 mr-1" /> New script
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <Phone className="w-5 h-5" /> Script setup
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={removeScript}
              disabled={deleting || scripts.length <= 1}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 h-9"
            >
              <Trash2 className="w-4 h-4 mr-1" /> Delete script
            </Button>
          </div>
          <label className="block text-sm text-muted-foreground">
            Script name
            <Input
              value={script.name || ""}
              onChange={(e) => setScript({ ...script, name: e.target.value })}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Greeting
            <Textarea
              value={script.greeting}
              onChange={(e) => setScript({ ...script, greeting: e.target.value })}
              rows={3}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </label>
          <label className="block text-sm text-muted-foreground">
            Transfer number
            <Input
              value={script.transfer_number || ""}
              onChange={(e) => setScript({ ...script, transfer_number: e.target.value })}
              className="mt-1 bg-muted border-border text-foreground"
            />
          </label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">FAQ answers</p>
              <Button type="button" variant="ghost" onClick={addFaq} className="h-8 text-titan-cyan">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add FAQ
              </Button>
            </div>
            {faqs.map((item, index) => (
              <div key={index} className="rounded-xl bg-muted/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Input
                    value={item.q}
                    onChange={(e) => {
                      const next = [...faqs];
                      next[index] = { ...next[index], q: e.target.value };
                      setScript({ ...script, faq_json: next });
                    }}
                    className="bg-muted border-border text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => removeFaq(index)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                    aria-label={`Delete FAQ ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Textarea
                  value={item.a}
                  onChange={(e) => {
                    const next = [...faqs];
                    next[index] = { ...next[index], a: e.target.value };
                    setScript({ ...script, faq_json: next });
                  }}
                  rows={2}
                  className="bg-muted border-border text-foreground"
                />
              </div>
            ))}
            {!faqs.length && (
              <p className="text-xs text-muted-foreground">No FAQ entries. Add one or save defaults from a new script.</p>
            )}
          </div>
          <Button onClick={save} disabled={saving} className="bg-titan-cyan text-black">
            {saving ? "Saving…" : "Save script"}
          </Button>
        </section>

        <section className="glass rounded-2xl p-5 flex flex-col min-h-[420px]">
          <h2 className="font-semibold text-foreground mb-3">Call simulator</h2>
          <div className="flex-1 space-y-2 overflow-y-auto mb-3 max-h-80">
            {log.map((msg, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm max-w-[90%] ${
                  msg.role === "bot"
                    ? "bg-primary/10 text-foreground"
                    : "bg-muted text-foreground ml-auto"
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
              className="bg-muted border-border text-foreground"
            />
            <Button type="submit"><Send className="w-4 h-4" /></Button>
          </form>
        </section>
      </div>
    </div>
  );
}
