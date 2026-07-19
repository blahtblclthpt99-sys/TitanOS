import React, { useEffect, useState } from "react";
import { Copy, Loader2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { contractPublicUrl, createContract, listContracts, signContract } from "@/lib/contractsApi";

const BLANK = { title: "", customer_name: "", body: "" };
const inputClass = "bg-titan-surface2 border-border text-foreground rounded-xl";

export default function Contracts() {
  const { user, authChecked } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => { if (!user?.id) return; setLoading(true); try { setContracts(await listContracts(user.id)); } finally { setLoading(false); } };
  useEffect(() => { if (authChecked && user?.id) load().catch(() => toast({ variant: "destructive", title: "Couldn't load contracts" })); }, [authChecked, user?.id]);
  const create = async (event) => { event.preventDefault(); if (saving) return; setSaving(true); try { const row = await createContract(user, form); setContracts((items) => [row, ...items]); setForm(BLANK); toast({ title: "Contract created" }); } catch { toast({ variant: "destructive", title: "Couldn't create contract" }); } finally { setSaving(false); } };
  const copy = async (contract) => { try { await navigator.clipboard.writeText(contractPublicUrl(contract.share_token)); toast({ title: "Signing link copied" }); } catch { toast({ variant: "destructive", title: "Couldn't copy link" }); } };
  const sign = async (contract) => {
    const signature = window.prompt("Enter your signature name");
    if (!signature?.trim() || saving) return;
    setSaving(true);
    try { const saved = await signContract(contract, { role: "owner", signature: signature.trim() }); setContracts((items) => items.map((item) => item.id === saved.id ? saved : item)); toast({ title: "Contract signed" }); }
    catch { toast({ variant: "destructive", title: "Couldn't sign contract" }); }
    finally { setSaving(false); }
  };
  if (!authChecked || loading) return <PageLoader variant="list" label="Loading contracts" />;
  return <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28"><PageHeader title="Contracts" subtitle="Create, share, and sign service agreements." />
    <form onSubmit={create} className="glass rounded-3xl p-5 md:p-7 border border-border space-y-4"><h2 className="font-semibold text-foreground">New contract</h2><div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-muted-foreground">Title<Input required value={form.title} onChange={(e) => setForm((x) => ({ ...x, title: e.target.value }))} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Customer name<Input required value={form.customer_name} onChange={(e) => setForm((x) => ({ ...x, customer_name: e.target.value }))} className={`mt-1 ${inputClass}`} /></label></div><label className="block text-sm text-muted-foreground">Contract body (optional)<Textarea value={form.body} onChange={(e) => setForm((x) => ({ ...x, body: e.target.value }))} rows={5} className={`mt-1 ${inputClass}`} /></label><Button disabled={saving} type="submit" className="bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create contract"}</Button></form>
    <section className="mt-6 space-y-3"><h2 className="font-semibold text-foreground">Your contracts</h2>{contracts.length ? contracts.map((contract) => <article key={contract.id} className="glass rounded-2xl p-5 border border-border flex flex-col sm:flex-row gap-4 sm:items-center"><div className="flex-1"><h3 className="font-semibold text-foreground">{contract.title}</h3><p className="text-sm text-foreground/45 mt-1">{contract.customer_name || "Customer not named"}</p><span className={`inline-block mt-2 px-2 py-1 rounded-md text-xs capitalize ${contract.status === "signed" ? "bg-emerald-400/15 text-emerald-300" : contract.status === "sent" ? "bg-titan-cyan/10 text-titan-cyan" : "bg-muted text-muted-foreground"}`}>{contract.status || "draft"}</span></div><div className="flex gap-2"><Button onClick={() => copy(contract)} variant="outline" className="border-border text-foreground"><Copy className="w-4 h-4 mr-1" />Copy link</Button>{!contract.owner_signature && <Button onClick={() => sign(contract)} disabled={saving} className="bg-titan-cyan text-black"><PenLine className="w-4 h-4 mr-1" />Sign</Button>}</div></article>) : <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">No contracts yet.</p>}</section>
  </div>;
}
