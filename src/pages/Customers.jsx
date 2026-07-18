import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Users, Search, Phone, Mail } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import PullToRefreshIndicator from "@/components/shared/PullToRefreshIndicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import NativeSelect from "@/components/shared/NativeSelect";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import StatusBadge from "@/components/shared/StatusBadge";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import VirtualList, { shouldVirtualize } from "@/components/shared/VirtualList";
import { useEntityData } from "@/hooks/useEntityData";

const BLANK_FORM = {
  first_name: "", last_name: "", email: "", phone: "",
  address: "", city: "", state: "", zip: "",
  status: "lead", source: "other",
};

export default function Customers({ isActive = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: [customers], loading, error, reload } = useEntityData([
    { entity: "Customer", method: "list", args: ["-created_date", 100] },
  ], { enabled: isActive });

  const [search, setSearch]        = useState("");
  const [statusFilter, setStatus]  = useState("all");
  const [form, setForm]            = useState(BLANK_FORM);
  const [saving, setSaving]        = useState(false);
  const [formError, setFormError]     = useState("");
  const [localCustomers, setLocal] = useState(null);

  const showForm  = new URLSearchParams(location.search).get("new") === "1";
  const openForm  = () => navigate("?new=1");
  const closeForm = () => { setFormError(""); navigate("/customers", { replace: true }); };

  const displayCustomers = localCustomers ?? customers;

  useEffect(() => { setLocal(null); }, [customers]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) { setFormError("First and last name are required."); return; }
    if (form.email && displayCustomers.some(c => c.email?.toLowerCase() === form.email.toLowerCase())) {
      setFormError("A customer with this email already exists."); return;
    }
    setFormError("");
    setSaving(true);
    const tempId = `temp_${Date.now()}`;
    setLocal(prev => [{ ...form, id: tempId }, ...(prev ?? customers)]);
    setForm(BLANK_FORM);
    closeForm();
    try {
      await api.entities.Customer.create(form);
      reload();
    } catch (err) {
      setLocal(null);
      setFormError(err.message || "Could not save customer. Try again.");
      navigate("?new=1");
    } finally { setSaving(false); }
  };

  const { containerRef, pullProgress, isRefreshing, pullDist } = usePullToRefresh(
    useCallback(async () => { await reload(); }, [reload])
  );

  const filtered = displayCustomers
    .filter(c => statusFilter === "all" || c.status === statusFilter)
    .filter(c => `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  if (!isActive && !customers.length) return null;
  if (loading && !customers.length) return <PageLoader variant="list" label="Loading customers" />;
  if (error) return <ErrorState title="Couldn't load customers" onRetry={reload} />;

  const renderCustomerRow = (c) => (
    <div
      onClick={() => navigate(`/customers/${c.id}`)}
      className="glass rounded-2xl p-4 glass-hover cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-titan-cyan/20 to-titan-indigo/20 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-titan-cyan">{c.first_name?.[0]}{c.last_name?.[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold text-white truncate">{c.first_name} {c.last_name}</p>
            <StatusBadge status={c.status} />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {c.phone && <span className="flex items-center gap-1 text-xs text-white/35"><Phone className="w-3 h-3" />{c.phone}</span>}
            {c.email && <span className="flex items-center gap-1 text-xs text-white/35"><Mail className="w-3 h-3" />{c.email}</span>}
          </div>
        </div>
        {c.lifetime_value > 0 && (
          <p className="text-sm font-semibold text-emerald-400 flex-shrink-0">${c.lifetime_value.toLocaleString()}</p>
        )}
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="p-4 md:p-8 max-w-7xl mx-auto overflow-y-auto" style={{ overscrollBehavior: "contain" }}>
      <PullToRefreshIndicator pullProgress={pullProgress} isRefreshing={isRefreshing} pullDist={pullDist} />
      <PageHeader title="Customers" subtitle={`${customers.length} total`} onAdd={openForm} addLabel="Add Customer" />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-11 bg-[#1A1A1C] border-white/5 text-white rounded-xl h-11 placeholder:text-white/20" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", "lead", "active", "vip", "inactive"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all capitalize ${
                statusFilter === s ? "bg-titan-cyan/10 text-titan-cyan border border-titan-cyan/20" : "bg-[#1A1A1C] text-white/40 border border-white/5 hover:text-white/70"
              }`}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !search && statusFilter === "all" ? (
        <EmptyState icon={Users} title="No customers yet" description="Add your first customer to start tracking relationships." onAction={openForm} actionLabel="Add Customer" />
      ) : filtered.length === 0 ? (
        <p className="text-center text-white/30 py-16 text-sm">No customers match your filter.</p>
      ) : shouldVirtualize(filtered.length) ? (
        <VirtualList
          items={filtered}
          renderItem={renderCustomerRow}
          scrollRef={containerRef}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              {renderCustomerRow(c)}
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name" value={form.first_name} onChange={e => f("first_name", e.target.value)} />
              <FormField label="Last Name"  value={form.last_name}  onChange={e => f("last_name",  e.target.value)} />
            </div>
            <FormField label="Email" type="email" value={form.email} onChange={e => f("email", e.target.value)} />
            <FormField label="Phone" type="tel"   value={form.phone} onChange={e => f("phone", e.target.value)} />
            <FormField label="Address" value={form.address} onChange={e => f("address", e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="City"  value={form.city}  onChange={e => f("city",  e.target.value)} />
              <FormField label="State" value={form.state} onChange={e => f("state", e.target.value)} />
              <FormField label="ZIP"   value={form.zip}   onChange={e => f("zip",   e.target.value)} />
            </div>
            <FormField label="Status">
              <NativeSelect
                value={form.status}
                onValueChange={v => f("status", v)}
                placeholder="Status"
                options={["lead","active","vip","inactive"].map(s => ({ value: s, label: s }))}
                className="mt-1"
              />
            </FormField>
            {formError && <p className="text-xs text-red-400 bg-red-400/10 rounded-xl px-3 py-2" role="alert">{formError}</p>}
            <Button onClick={handleSave} disabled={saving} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50">
              {saving ? "Saving…" : "Save Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}