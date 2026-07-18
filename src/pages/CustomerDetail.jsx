import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useEntityRecord } from "@/hooks/useEntityRecord";
import { motion } from "framer-motion";
import { Phone, Mail, MapPin, Tag, Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/shared/StatusBadge";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FormField from "@/components/shared/FormField";

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, loading, error, reload } = useEntityRecord("Customer", id);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) setForm(customer);
  }, [customer]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.entities.Customer.update(id, form);
      setForm(updated);
      setEditing(false);
      reload();
    } finally { setSaving(false); }
  };

  if (loading) return <PageLoader variant="detail" label="Loading customer" />;
  if (error) {
    return (
      <ErrorState
        title="Couldn't load customer"
        message="This customer may not exist or you may not have access."
        onRetry={reload}
      />
    );
  }
  if (!customer) {
    return (
      <div className="p-8 text-white/40 text-center" role="status">
        Customer not found.
      </div>
    );
  }

  const fullName = `${customer.first_name} ${customer.last_name}`;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-titan-cyan/20 to-titan-indigo/20 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-titan-cyan">{customer.first_name?.[0]}{customer.last_name?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={customer.status} />
              {customer.lifetime_value > 0 && (
                <span className="text-sm font-semibold text-emerald-400">${customer.lifetime_value.toLocaleString()} lifetime</span>
              )}
            </div>
          </div>
          <Button onClick={() => setEditing(!editing)} variant="outline"
            className="border-white/10 text-white/60 hover:text-white rounded-xl min-h-[44px] min-w-[44px] p-2"
            aria-label={editing ? "Cancel editing" : "Edit customer"}>
            <Edit2 className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>

      {editing ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-2xl p-5 space-y-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" value={form.first_name} onChange={e => f("first_name", e.target.value)} />
            <FormField label="Last Name"  value={form.last_name}  onChange={e => f("last_name",  e.target.value)} />
          </div>
          <FormField label="Email" type="email" value={form.email || ""} onChange={e => f("email", e.target.value)} />
          <FormField label="Phone" type="tel"   value={form.phone || ""} onChange={e => f("phone", e.target.value)} />
          <FormField label="Address" value={form.address || ""} onChange={e => f("address", e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <FormField label="City"  value={form.city  || ""} onChange={e => f("city",  e.target.value)} />
            <FormField label="State" value={form.state || ""} onChange={e => f("state", e.target.value)} />
            <FormField label="ZIP"   value={form.zip   || ""} onChange={e => f("zip",   e.target.value)} />
          </div>
          <FormField label="Status">
            <Select value={form.status} onValueChange={v => f("status", v)}>
              <SelectTrigger className="bg-[#242427] border-white/5 text-white rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#242427] border-white/10">
                {["lead","active","vip","inactive"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}
              className="flex-1 bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11">
              <Check className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button onClick={() => { setEditing(false); setForm(customer); }} variant="outline"
              className="border-white/10 text-white/60 rounded-xl h-11 px-4" aria-label="Cancel editing">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="glass rounded-2xl p-5 space-y-3">
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-3 text-sm text-white/70 hover:text-white transition-colors min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                {customer.phone}
              </a>
            )}
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-3 text-sm text-white/70 min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                <span>{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {customer.source && (
              <div className="flex items-center gap-3 text-sm text-white/70 min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                <span className="capitalize">Source: {customer.source.replace("_", " ")}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
