import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useEntityRecord } from "@/hooks/useEntityRecord";
import { useEntityData } from "@/hooks/useEntityData";
import { motion } from "framer-motion";
import {
  Phone, Mail, MapPin, Tag, Edit2, Check, X, Briefcase, FileText,
  Receipt, MessageSquare, Plus, Image as ImageIcon, CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/shared/StatusBadge";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FormField from "@/components/shared/FormField";
import { formatMonthDayYear } from "@/lib/date-utils";

const COMMUNICATION_TYPES = ["call", "email", "text"];

function customerMatches(record, id, fullName) {
  return record.customer_id === id
    || record.customer_name?.trim().toLowerCase() === fullName.toLowerCase();
}

function RecordList({ title, icon: Icon, records, empty, renderRecord, to }) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-titan-cyan" /> {title}
        </h2>
        <span className="text-xs text-white/35">{records.length}</span>
      </div>
      {records.length ? (
        <div className="space-y-2">
          {records.slice(0, 5).map(renderRecord)}
          {records.length > 5 && <p className="text-xs text-white/35">Showing the latest 5 records</p>}
        </div>
      ) : <p className="text-sm text-white/35">{empty}</p>}
      {to && <Link to={to} className="inline-block mt-4 text-xs text-titan-cyan hover:text-white">View all →</Link>}
    </section>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const { data: customer, loading, error, reload } = useEntityRecord("Customer", id);
  const { data: [allJobs, allEstimates, allInvoices], reload: reloadRelated } = useEntityData([
    { entity: "Job", method: "list", args: ["-scheduled_date", 500] },
    { entity: "Estimate", method: "list", args: ["-created_date", 500] },
    { entity: "Invoice", method: "list", args: ["-created_date", 500] },
  ]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [communications, setCommunications] = useState([]);
  const [communicationForm, setCommunicationForm] = useState({ type: "call", body: "" });
  const [customerFiles, setCustomerFiles] = useState([]);
  const [communicationFallback, setCommunicationFallback] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (customer) setForm(customer);
  }, [customer]);

  useEffect(() => {
    let active = true;
    const loadCustomerData = async () => {
      try {
        const rows = await api.entities.CustomerCommunication.filter({ customer_id: id });
        if (active) {
          setCommunications(rows.sort((a, b) => new Date(b.created_at || b.created_date || b.date) - new Date(a.created_at || a.created_date || a.date)));
          setCommunicationFallback(false);
        }
      } catch {
        try {
          if (active) setCommunications(JSON.parse(localStorage.getItem(`titanos_comm_${id}`)) || []);
        } catch {
          if (active) setCommunications([]);
        }
        if (active) setCommunicationFallback(true);
      }
      try {
        const rows = await api.entities.CustomerFile.filter({ customer_id: id });
        if (active) setCustomerFiles(rows);
      } catch {
        if (active) setCustomerFiles([]);
      }
    };
    loadCustomerData();
    return () => { active = false; };
  }, [id]);

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.entities.Customer.update(id, form);
      setForm(updated);
      setEditing(false);
      reload();
      reloadRelated();
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

  const fullName = `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
  const jobs = allJobs.filter(record => customerMatches(record, id, fullName));
  const estimates = allEstimates.filter(record => customerMatches(record, id, fullName));
  const invoices = allInvoices.filter(record => customerMatches(record, id, fullName));
  const completedJobs = jobs.filter(job => job.status === "completed");
  const paidTotal = invoices.filter(invoice => invoice.status === "paid").reduce((sum, invoice) => sum + Number(invoice.total || invoice.amount_paid || 0), 0);
  const outstandingTotal = invoices.reduce((sum, invoice) => {
    if (invoice.status === "paid") return sum;
    return sum + Number(invoice.balance_due ?? invoice.total ?? 0);
  }, 0);
  const timeline = [
    ...jobs.map(job => ({ id: `job-${job.id}`, date: job.scheduled_date || job.created_date, label: job.title || "Job", detail: job.status, icon: Briefcase })),
    ...estimates.map(estimate => ({ id: `estimate-${estimate.id}`, date: estimate.created_date, label: estimate.estimate_number || "Estimate", detail: estimate.status, icon: FileText })),
    ...invoices.map(invoice => ({ id: `invoice-${invoice.id}`, date: invoice.created_date, label: invoice.invoice_number || "Invoice", detail: invoice.status, icon: Receipt })),
  ].filter(item => item.date).sort((a, b) => new Date(b.date) - new Date(a.date));

  const addCommunication = async () => {
    const body = communicationForm.body.trim();
    if (!body) return;
    const entry = { id: crypto.randomUUID?.() || String(Date.now()), customer_id: id, date: new Date().toISOString(), type: communicationForm.type, body };
    try {
      const saved = await api.entities.CustomerCommunication.create(entry);
      setCommunications((current) => [saved, ...current]);
      setCommunicationFallback(false);
    } catch {
      const next = [entry, ...communications];
      setCommunications(next);
      setCommunicationFallback(true);
      localStorage.setItem(`titanos_comm_${id}`, JSON.stringify(next));
    }
    setCommunicationForm({ type: "call", body: "" });
  };

  const uploadCustomerFile = async (file) => {
    if (!file) return;
    setUploadingFile(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const saved = await api.entities.CustomerFile.create({
        customer_id: id,
        name: file.name,
        file_url,
        content_type: file.type,
        created_by_id: customer.created_by_id,
      });
      setCustomerFiles((current) => [saved, ...current]);
    } catch {
      // CustomerFile is optional on older deployments; uploads remain accessible in the session.
      const fileEntry = { id: `local-${Date.now()}`, name: file.name, file_url: URL.createObjectURL(file), content_type: file.type };
      setCustomerFiles((current) => [fileEntry, ...current]);
    } finally {
      setUploadingFile(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
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
          <FormField label="Notes">
            <Textarea value={form.notes || ""} onChange={e => f("notes", e.target.value)}
              placeholder="Customer preferences, access notes, or business details"
              className="min-h-24 bg-[#242427] border-white/5 text-white rounded-xl focus:ring-titan-cyan/40" />
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Jobs completed", value: completedJobs.length, color: "text-titan-cyan" },
              { label: "Estimates", value: estimates.length, color: "text-white" },
              { label: "Paid", value: `$${paidTotal.toLocaleString()}`, color: "text-emerald-400" },
              { label: "Outstanding", value: `$${outstandingTotal.toLocaleString()}`, color: "text-titan-amber" },
            ].map(stat => <div key={stat.label} className="glass rounded-2xl p-4">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p><p className="text-xs text-white/40 mt-1">{stat.label}</p>
            </div>)}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-white">Contact info</h2>
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
          <div className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white mb-3">Notes</h2>
            <p className="text-sm text-white/60 whitespace-pre-wrap">{customer.notes || "No customer notes yet."}</p>
          </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4 text-titan-cyan" /> Files & photos</h2>
            <label className="inline-flex mb-4 cursor-pointer">
              <span className="inline-flex items-center rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"><Plus className="w-3.5 h-3.5 mr-1.5" />{uploadingFile ? "Uploading…" : "Upload file"}</span>
              <input type="file" className="sr-only" disabled={uploadingFile} onChange={(event) => { uploadCustomerFile(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <div className="flex flex-wrap gap-3">
              {customer.photo_url && <img src={customer.photo_url} alt={`${fullName} profile`} className="w-24 h-24 rounded-xl object-cover border border-white/10" />}
              {customerFiles.map(file => (
                <a key={file.id} href={file.file_url || file.url} target="_blank" rel="noreferrer" className="w-24 min-h-24 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-xs text-white/65 hover:border-titan-cyan/40">
                  {(file.content_type || "").startsWith("image/") && <img src={file.file_url || file.url} alt="" className="w-full h-14 object-cover rounded-lg mb-2" />}
                  <span className="line-clamp-2">{file.name || "Attachment"}</span>
                </a>
              ))}
              {!customer.photo_url && !customerFiles.length && <p className="text-sm text-white/35">No files or photos uploaded yet.</p>}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <RecordList title="Jobs" icon={Briefcase} records={jobs} empty="No jobs for this customer yet." to="/jobs"
              renderRecord={job => <div key={job.id} className="rounded-xl bg-white/[0.03] p-3 flex justify-between gap-3"><div><p className="text-sm text-white">{job.title}</p><p className="text-xs text-white/35">{formatMonthDayYear(job.scheduled_date || job.created_date)}</p></div><StatusBadge status={job.status} /></div>} />
            <RecordList title="Estimates" icon={FileText} records={estimates} empty="No estimates yet." to="/estimates"
              renderRecord={estimate => <div key={estimate.id} className="rounded-xl bg-white/[0.03] p-3 flex justify-between gap-3"><div><p className="text-sm text-white">{estimate.estimate_number || "Draft estimate"}</p><p className="text-xs text-white/35">${Number(estimate.total || 0).toLocaleString()}</p></div><StatusBadge status={estimate.status} /></div>} />
            <RecordList title="Invoices & payments" icon={Receipt} records={invoices} empty="No invoices yet." to="/invoices"
              renderRecord={invoice => <div key={invoice.id} className="rounded-xl bg-white/[0.03] p-3 flex justify-between gap-3"><div><p className="text-sm text-white">{invoice.invoice_number || "Draft invoice"}</p><p className="text-xs text-white/35">${Number(invoice.balance_due ?? invoice.total ?? 0).toLocaleString()} due</p></div><StatusBadge status={invoice.status} /></div>} />
          </div>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4"><CalendarDays className="w-4 h-4 text-titan-cyan" /> Appointment & job history</h2>
            {timeline.length ? <div className="space-y-3">{timeline.slice(0, 10).map(item => { const Icon = item.icon; return <div key={item.id} className="flex gap-3"><div className="w-8 h-8 rounded-lg bg-titan-cyan/10 flex items-center justify-center"><Icon className="w-4 h-4 text-titan-cyan" /></div><div><p className="text-sm text-white">{item.label}</p><p className="text-xs text-white/40 capitalize">{formatMonthDayYear(item.date)} · {item.detail}</p></div></div>; })}</div> : <p className="text-sm text-white/35">No appointments or transactions recorded.</p>}
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4"><MessageSquare className="w-4 h-4 text-titan-cyan" /> Communication history</h2>
            <div className="grid sm:grid-cols-[140px_1fr_auto] gap-2 mb-4">
              <Select value={communicationForm.type} onValueChange={type => setCommunicationForm(prev => ({ ...prev, type }))}><SelectTrigger className="bg-[#242427] border-white/5 text-white rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-[#242427] border-white/10">{COMMUNICATION_TYPES.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select>
              <Textarea value={communicationForm.body} onChange={event => setCommunicationForm(prev => ({ ...prev, body: event.target.value }))} placeholder="Log a call, email, or text…" className="min-h-11 bg-[#242427] border-white/5 text-white rounded-xl" />
              <Button onClick={addCommunication} className="bg-titan-cyan text-black hover:bg-titan-cyan/90 rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            {communications.length ? <div className="space-y-2">{communications.map(entry => <div key={entry.id} className="rounded-xl bg-white/[0.03] p-3"><div className="flex justify-between gap-3 text-xs text-white/40 mb-1"><span className="capitalize">{entry.type}</span><span>{formatMonthDayYear(entry.date || entry.created_at || entry.created_date)}</span></div><p className="text-sm text-white/70 whitespace-pre-wrap">{entry.body}</p></div>)}</div> : <p className="text-sm text-white/35">{communicationFallback ? "No communications logged locally for this customer." : "No communications logged for this customer."}</p>}
          </section>
        </motion.div>
      )}
    </div>
  );
}
