import React, { useCallback, useEffect, useState } from "react";
import { Building2, Check, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FormField from "@/components/shared/FormField";
import EmptyState from "@/components/shared/EmptyState";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import {
  createCompany,
  deleteCompany,
  inviteCompanyMember,
  listMyCompanies,
  setActiveCompany,
} from "@/lib/companiesApi";
import DeleteButton from "@/components/shared/DeleteButton";

const empty = { name: "", city: "", state: "", phone: "", email: "" };

export default function Companies() {
  const { user, authChecked, checkUserAuth } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState(empty);
  const [invite, setInvite] = useState({ companyId: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setLoadError(false);
    try {
      setCompanies(await listMyCompanies(user.id));
    } catch {
      setLoadError(true);
      toast({ variant: "destructive", title: "Couldn't load companies" });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authChecked && user?.id) load();
  }, [authChecked, user?.id, load]);

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
    } catch {
      toast({ variant: "destructive", title: "Couldn't create company" });
    } finally {
      setSaving(false);
    }
  };

  const activate = async (companyId) => {
    if (saving) return;
    setSaving(true);
    try {
      await setActiveCompany(user.id, companyId, (updates) => api.auth.updateMe(updates));
      await checkUserAuth();
      toast({ title: "Active company updated" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't change active company" });
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async (event) => {
    event.preventDefault();
    if (saving || !invite.companyId || !invite.email.trim()) return;
    setSaving(true);
    try {
      await inviteCompanyMember(invite.companyId, user.id, invite.email.trim());
      setInvite({ companyId: "", email: "" });
      toast({ title: "Member invited" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't invite member" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading companies" />;
  if (loadError) return <ErrorState title="Couldn't load companies" onRetry={load} />;

  return (
    <div className="page-pad mx-auto max-w-6xl pb-24">
      <PageHeader title="Companies" subtitle="Manage your business profiles and team access" />
      {betaBadgeLabel() && (
        <div className="titan-surface mb-6 border-primary/20 bg-primary/5 p-4">
          <p className="font-semibold text-primary">{betaBadgeLabel()}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-company access is included throughout the beta.
          </p>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          {companies.length ? (
            companies.map((company) => {
              const active = company.id === user?.active_company_id;
              return (
                <article
                  key={company.id}
                  className={`titan-surface p-5 ${active ? "border-primary/35" : ""}`}
                >
                  <div className="flex justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                        <h2 className="truncate font-semibold text-foreground">{company.name}</h2>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[company.city, company.state].filter(Boolean).join(", ") || "Location not set"} ·{" "}
                        {company.member_role || "owner"}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      {active && (
                        <span className="h-fit rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">
                          Active
                        </span>
                      )}
                      <DeleteButton
                        label={company.name}
                        onDelete={async () => {
                          await deleteCompany(user.id, company.id);
                          setCompanies((current) => current.filter((c) => c.id !== company.id));
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => activate(company.id)}
                    disabled={saving || active}
                    variant="outline"
                    className="mt-4"
                  >
                    {active ? (
                      <>
                        <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                        Active company
                      </>
                    ) : (
                      "Set active"
                    )}
                  </Button>
                </article>
              );
            })
          ) : (
            <EmptyState
              title="No companies yet"
              description="Create a profile for each business you run."
            />
          )}
        </section>

        <aside className="space-y-6 lg:col-span-2">
          <form onSubmit={create} className="titan-surface space-y-3 p-5">
            <h2 className="font-semibold text-foreground">Create company</h2>
            <FormField
              label="Company name"
              required
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Company name"
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" value={form.city} onChange={(e) => field("city", e.target.value)} />
              <FormField label="State" value={form.state} onChange={(e) => field("state", e.target.value)} />
            </div>
            <FormField
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => field("phone", e.target.value)}
            />
            <FormField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => field("email", e.target.value)}
            />
            <Button disabled={saving} type="submit" className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Create company"}
            </Button>
          </form>

          <form onSubmit={sendInvite} className="titan-surface space-y-3 p-5">
            <h2 className="font-semibold text-foreground">Invite member</h2>
            <FormField label="Company">
              <select
                required
                value={invite.companyId}
                onChange={(e) => setInvite({ ...invite, companyId: e.target.value })}
                className="h-10 w-full rounded-md border border-border bg-muted px-3 text-sm text-foreground"
                aria-label="Choose company"
              >
                <option value="">Choose company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Member email"
              required
              type="email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              placeholder="member@example.com"
            />
            <Button disabled={saving} type="submit" variant="outline" className="w-full">
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Invite member
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
}
