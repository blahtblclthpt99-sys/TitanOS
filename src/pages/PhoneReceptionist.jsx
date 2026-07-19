import React, { useEffect, useState } from "react";
import { Phone, Send } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import {
  answerFromScript,
  getOrCreatePhoneScript,
  updatePhoneScript,
} from "@/lib/phoneScriptApi";

export default function PhoneReceptionist() {
  const { user } = useAuth();
  const [script, setScript] = useState(null);
  const [utterance, setUtterance] = useState("");
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    getOrCreatePhoneScript(user).then((row) => {
      setScript(row);
      setLog([{ role: "bot", text: row.greeting }]);
    });
  }, [user?.id]);

  const save = async () => {
    if (!script) return;
    const saved = await updatePhoneScript(user.id, script.id, {
      greeting: script.greeting,
      transfer_number: script.transfer_number,
      faq_json: script.faq_json,
    });
    setScript(saved);
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
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="glass rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Phone className="w-5 h-5" /> Script setup
          </div>
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
            <p className="text-sm font-medium text-foreground">FAQ answers</p>
            {faqs.map((item, index) => (
              <div key={index} className="rounded-xl bg-muted/50 p-3 space-y-2">
                <Input
                  value={item.q}
                  onChange={(e) => {
                    const next = [...faqs];
                    next[index] = { ...next[index], q: e.target.value };
                    setScript({ ...script, faq_json: next });
                  }}
                  className="bg-muted border-border text-foreground"
                />
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
          </div>
          <Button onClick={save}>Save script</Button>
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
