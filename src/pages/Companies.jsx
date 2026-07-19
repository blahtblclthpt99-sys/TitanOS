import React, { useEffect, useState } from "react";
import { Building2, Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import { createCompany, inviteCompanyMember, listMyCompanies, setActiveCompany } from "@/lib/companiesApi";

const empty = { name: "", city: "", state: "", phone: "", email: "" };

export default function Companies() {
  const { user, authChecked, checkUserAuth } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(empty);
  const [invite, setInvite] = useState({ companyId: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try { setCompanies(await listMyCompanies(user.id)); } catch { toast({ variant: "destructive", title: "Couldn't load companies" }); } finally { setLoading(false); }
  };
  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id]);
  const field = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const create = async (event) => {
    event.preventDefault();
    if (saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const company = await createCompany(user, form);
      setCompanies((current) => [company, ...current]);
      setForm(empty);
      toast({ title: "Company created" });
    } catch { toast({ variant: "destructive", title: "Couldn't create company" }); } finally { setSaving(false); }
  };
  const activate = async (companyId) => {
    if (saving) return;
    setSaving(true);
    try {
      await setActiveCompany(user.id, companyId, (updates) => api.auth.updateMe(updates));
      await checkUserAuth();
      toast({ title: "Active company updated" });
    } catch { toast({ variant: "destructive", title: "Couldn't change active company" }); } finally { setSaving(false); }
  };
  const sendInvite = async (event) => {
    event.preventDefault();
    if (saving || !invite.companyId || !invite.email.trim()) return;
    setSaving(true);
    try { await inviteCompanyMember(invite.companyId, user.id, invite.email.trim()); setInvite({ companyId: "", email: "" }); toast({ title: "Member invited" }); }
    catch { toast({ variant: "destructive", title: "Couldn't invite member" }); } finally { setSaving(false); }
  };

  return <div className="p-4 md:p-8 max-w-6xl mx-auto pb-24">
    <PageHeader title="Companies" subtitle="Manage your business profiles and team access" />
    {betaBadgeLabel() && <div className="glass rounded-2xl mb-6 p-4 border border-titan-cyan/20"><p className="font-semibold text-titan-cyan">{betaBadgeLabel()}</p><p className="text-xs text-foreground/45 mt-1">Multi-company access is included throughout the beta.</p></div>}
    <div className="grid lg:grid-cols-5 gap-6">
      <section className="lg:col-span-3 space-y-4">
        {loading ? <p className="text-foreground/45">Loading companies…</p> : companies.length ? companies.map((company) => {
          const active = company.id === user?.active_company_id;
          return <article key={company.id} className={`glass rounded-2xl p-5 border ${active ? "border-titan-cyan/35" : "border-border"}`}><div className="flex justify-between gap-4"><div><div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-titan-cyan" /><h2 className="font-semibold text-foreground">{company.name}</h2></div><p className="text-xs text-muted-foreground mt-2">{[company.city, company.state].filter(Boolean).join(", ") || "Location not set"} · {company.member_role || "owner"}</p></div>{active && <span className="h-fit text-xs px-2 py-1 rounded-full bg-titan-cyan/15 text-titan-cyan">Active</span>}</div><Button onClick={() => activate(company.id)} disabled={saving || active} variant="outline" className="mt-4 border-border text-foreground">{active ? <><Check className="w-4 h-4 mr-2" />Active company</> : "Set active"}</Button></article>;
        }) : <div className="glass rounded-2xl p-10 text-center border border-border"><Building2 className="w-8 h-8 text-titan-cyan mx-auto mb-3" /><p className="text-foreground font-semibold">No companies yet</p><p className="text-sm text-muted-foreground mt-1">Create a profile for each business you run.</p></div>}
        <p className="text-xs text-muted-foreground">Current active_company_id: <span className="text-muted-foreground">{user?.active_company_id || "none"}</span></p>
      </section>
      <aside className="lg:col-span-2 space-y-6">
        <form onSubmit={create} className="glass rounded-2xl p-5 border border-border space-y-3"><h2 className="font-semibold text-foreground">Create company</h2><Input required value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Company name" className="bg-titan-surface2 border-border text-foreground" /><div className="grid grid-cols-2 gap-3"><Input value={form.city} onChange={(e) => field("city", e.target.value)} placeholder="City" className="bg-titan-surface2 border-border text-foreground" /><Input value={form.state} onChange={(e) => field("state", e.target.value)} placeholder="State" className="bg-titan-surface2 border-border text-foreground" /></div><Input value={form.phone} onChange={(e) => field("phone", e.target.value)} placeholder="Phone" className="bg-titan-surface2 border-border text-foreground" /><Input type="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="Email" className="bg-titan-surface2 border-border text-foreground" /><Button disabled={saving} type="submit" className="w-full bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create company"}</Button></form>
        <form onSubmit={sendInvite} className="glass rounded-2xl p-5 border border-border space-y-3"><h2 className="font-semibold text-foreground">Invite member</h2><select required value={invite.companyId} onChange={(e) => setInvite({ ...invite, companyId: e.target.value })} className="w-full h-10 rounded-xl bg-titan-surface2 border border-border px-3 text-sm text-foreground"><option value="">Choose company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select><Input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="member@example.com" className="bg-titan-surface2 border-border text-foreground" /><Button disabled={saving} type="submit" variant="outline" className="w-full border-border text-foreground"><Send className="w-4 h-4 mr-2" />Invite member</Button></form>
      </aside>
    </div>
  </div>;
}
