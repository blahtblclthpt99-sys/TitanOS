import React, { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import NativeSelect from "@/components/shared/NativeSelect";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import { createPaymentLink, listPaymentAccounts, listPayments, markPaymentStatus, upsertPaymentAccount } from "@/lib/paymentsApi";

const PROVIDERS = ["stripe", "square", "paypal"];
const EMPTY_FORM = { amount: "", customer_name: "", invoice_id: "", provider: "stripe" };
const statusClass = { succeeded: "bg-emerald-400/15 text-emerald-300", failed: "bg-red-400/15 text-red-300", pending: "bg-titan-amber/15 text-titan-amber" };

export default function Payments() {
  const { user, authChecked } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [accountRows, paymentRows] = await Promise.all([listPaymentAccounts(user.id), listPayments(user.id)]);
      setAccounts(accountRows);
      setPayments(paymentRows.sort((a, b) => new Date(b.created_at || b.created_date) - new Date(a.created_at || a.created_date)));
    } catch { toast({ variant: "destructive", title: "Couldn't load payments" }); } finally { setLoading(false); }
  };

  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id]);
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("success") === "1" ? "Payment completed" : new URLSearchParams(window.location.search).get("canceled") === "1" ? "Payment canceled" : "";
    if (result) toast({ title: result });
  }, []);

  const toggleProvider = async (provider) => {
    if (saving) return;
    setSaving(true);
    try {
      const existing = accounts.find((account) => account.provider === provider);
      const account = await upsertPaymentAccount(user, { provider, account_label: provider[0].toUpperCase() + provider.slice(1), is_connected: !existing?.is_connected });
      setAccounts((current) => [...current.filter((item) => item.provider !== provider), account]);
      toast({ title: account.is_connected ? `${provider} connected` : `${provider} disconnected` });
    } catch { toast({ variant: "destructive", title: "Couldn't update payment account" }); } finally { setSaving(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving || !Number(form.amount) || !form.customer_name.trim()) return;
    setSaving(true);
    try {
      const payment = await createPaymentLink(user, { ...form, amount: Number(form.amount), customer_name: form.customer_name.trim() });
      setPayments((current) => [payment, ...current]);
      setForm(EMPTY_FORM);
      toast({ title: "Payment link created", description: payment.checkout_url ? "Opening checkout…" : "It is saved as pending." });
      if (payment.checkout_url) window.open(payment.checkout_url, "_blank", "noopener,noreferrer");
    } catch (error) { toast({ variant: "destructive", title: "Couldn't create payment link", description: error.message }); } finally { setSaving(false); }
  };

  const updateStatus = async (payment, status) => {
    if (saving) return;
    setSaving(true);
    try {
      await markPaymentStatus(payment.id, status);
      setPayments((current) => current.map((item) => item.id === payment.id ? { ...item, status } : item));
    } catch { toast({ variant: "destructive", title: "Couldn't update payment" }); } finally { setSaving(false); }
  };

  return <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
    <PageHeader title="Payments" subtitle="Connect providers and collect customer payments" />
    {betaBadgeLabel() && <div className="glass rounded-2xl p-4 mb-6 border border-titan-cyan/20 text-sm text-titan-cyan font-semibold">{betaBadgeLabel()} · Payment tools have no TitanOS fees during beta.</div>}
    <section className="grid md:grid-cols-3 gap-4 mb-7">
      {PROVIDERS.map((provider) => {
        const connected = accounts.find((item) => item.provider === provider)?.is_connected;
        return <article key={provider} className="glass rounded-2xl p-5 border border-white/8">
          <div className="flex items-center justify-between"><CreditCard className="w-5 h-5 text-titan-cyan" /><span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-white/45"}`}>{connected ? "Connected" : "Not connected"}</span></div>
          <h2 className="text-lg font-semibold text-white capitalize mt-4">{provider}</h2>
          <p className="text-xs text-white/40 mt-1 min-h-8">{provider === "stripe" ? "Live checkout requires STRIPE_SECRET_KEY on your server." : "Mark connected locally while provider setup is in beta."}</p>
          <Button onClick={() => toggleProvider(provider)} disabled={saving} variant="outline" className="mt-4 w-full border-white/10 text-white">{connected ? "Disconnect" : "Connect"}</Button>
        </article>;
      })}
    </section>
    <div className="grid lg:grid-cols-5 gap-6">
      <form onSubmit={submit} className="glass rounded-2xl p-6 border border-white/8 lg:col-span-2 space-y-4">
        <h2 className="font-semibold text-white">Create payment link</h2>
        <Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Amount ($)" className="bg-titan-surface2 border-white/10 text-white" />
        <Input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" className="bg-titan-surface2 border-white/10 text-white" />
        <Input value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} placeholder="Invoice ID (optional)" className="bg-titan-surface2 border-white/10 text-white" />
        <NativeSelect value={form.provider} onValueChange={(provider) => setForm({ ...form, provider })} placeholder="Provider" options={PROVIDERS.map((value) => ({ value, label: value }))} />
        <Button disabled={saving} type="submit" className="w-full bg-titan-cyan text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create payment link"}</Button>
      </form>
      <section className="glass rounded-2xl p-6 border border-white/8 lg:col-span-3">
        <h2 className="font-semibold text-white mb-4">Payment history</h2>
        {loading ? <p className="text-sm text-white/40">Loading payments…</p> : payments.length ? <div className="space-y-3">{payments.map((payment) => <div key={payment.id} className="rounded-xl bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"><div><p className="font-medium text-white">{payment.customer_name || "Customer"} · ${Number(payment.amount || 0).toFixed(2)}</p><p className="text-xs text-white/40 mt-1 capitalize">{payment.provider} {payment.invoice_id ? `· ${payment.invoice_id}` : ""}</p></div><div className="flex items-center gap-2"><span className={`text-xs capitalize px-2 py-1 rounded-full ${statusClass[payment.status] || statusClass.pending}`}>{payment.status || "pending"}</span>{payment.checkout_url && <a href={payment.checkout_url} target="_blank" rel="noreferrer" className="text-titan-cyan"><ExternalLink className="w-4 h-4" /></a>}{payment.status === "pending" && <><button onClick={() => updateStatus(payment, "succeeded")} aria-label="Mark succeeded" disabled={saving}><CheckCircle2 className="w-4 h-4 text-emerald-400" /></button><button onClick={() => updateStatus(payment, "failed")} aria-label="Mark failed" disabled={saving}><XCircle className="w-4 h-4 text-red-400" /></button></>}</div></div>)}</div> : <p className="text-sm text-white/40">No payment links yet.</p>}
      </section>
    </div>
  </div>;
}
