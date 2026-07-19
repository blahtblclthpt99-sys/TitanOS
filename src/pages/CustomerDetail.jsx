import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { useEntityRecord } from "@/hooks/useEntityRecord";
import { useEntityData } from "@/hooks/useEntityData";
import { motion } from "framer-motion";
import {
  Phone, Mail, MapPin, Tag, Edit2, Check, X, Briefcase, FileText,
  Receipt, MessageSquare, Plus, Image as ImageIcon, CalendarDays, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/shared/StatusBadge";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import FormField from "@/components/shared/FormField";
import { formatMonthDayYear } from "@/lib/date-utils";
import { buildBusinessTimeline } from "@/lib/businessTimeline";
import BusinessTimeline from "@/components/timeline/BusinessTimeline";

const COMMUNICATION_TYPES = ["call", "email", "text"];

function customerMatches(record, id, fullName) {
  return record.customer_id === id
    || record.customer_name?.trim().toLowerCase() === fullName.toLowerCase();
}

function RecordList({ title, icon: Icon, records, empty, renderRecord, to }) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-titan-cyan" /> {title}
        </h2>
        <span className="text-xs text-muted-foreground">{records.length}</span>
      </div>
      {records.length ? (
        <div className="space-y-2">
          {records.slice(0, 5).map(renderRecord)}
          {records.length > 5 && <p className="text-xs text-muted-foreground">Showing the latest 5 records</p>}
        </div>
      ) : <p className="text-sm text-muted-foreground">{empty}</p>}
      {to && <Link to={to} className="inline-block mt-4 text-xs text-titan-cyan hover:text-foreground">View all →</Link>}
    </section>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: customer, loading, error, reload } = useEntityRecord("Customer", id);
  const [deleting, setDeleting] = useState(false);
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
      <div className="p-8 text-muted-foreground text-center" role="status">
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
  const timeline = buildBusinessTimeline({
    jobs,
    estimates,
    invoices,
    communications,
    files: customerFiles,
    customerId: id,
    customerName: fullName,
  });

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

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${fullName}? Jobs and invoices stay, but this contact will be removed.`)) return;
    setDeleting(true);
    try {
      await api.entities.Customer.delete(id);
      toast({ title: "Contact deleted" });
      navigate("/customers", { replace: true });
    } catch (err) {
      toast({ title: "Couldn't delete contact", description: err.message || "Try again.", variant: "destructive" });
    } finally {
      setDeleting(false);
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
            <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={customer.status} />
              {customer.lifetime_value > 0 && (
                <span className="text-sm font-semibold text-emerald-400">${customer.lifetime_value.toLocaleString()} lifetime</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEditing(!editing)} variant="outline"
              className="border-border text-muted-foreground hover:text-foreground rounded-xl min-h-[44px] min-w-[44px] p-2"
              aria-label={editing ? "Cancel editing" : "Edit customer"}>
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button onClick={handleDelete} disabled={deleting} variant="outline"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl min-h-[44px] min-w-[44px] p-2"
              aria-label="Delete contact">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
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
              <SelectTrigger className="bg-muted border-border text-foreground rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-muted border-border">
                {["lead","active","vip","inactive"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Notes">
            <Textarea value={form.notes || ""} onChange={e => f("notes", e.target.value)}
              placeholder="Customer preferences, access notes, or business details"
              className="min-h-24 bg-muted border-border text-foreground rounded-xl focus:ring-titan-cyan/40" />
          </FormField>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}
              className="flex-1 bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11">
              <Check className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save Changes"}
            </Button>
            <Button onClick={() => { setEditing(false); setForm(customer); }} variant="outline"
              className="border-border text-muted-foreground rounded-xl h-11 px-4" aria-label="Cancel editing">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Jobs completed", value: completedJobs.length, color: "text-titan-cyan" },
              { label: "Estimates", value: estimates.length, color: "text-foreground" },
              { label: "Paid", value: `$${paidTotal.toLocaleString()}`, color: "text-emerald-400" },
              { label: "Outstanding", value: `$${outstandingTotal.toLocaleString()}`, color: "text-titan-amber" },
            ].map(stat => <div key={stat.label} className="glass rounded-2xl p-4">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p><p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>)}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-foreground">Contact info</h2>
            {customer.email && (
              <a href={`mailto:${customer.email}`} className="flex items-center gap-3 text-sm text-foreground/90 hover:text-foreground transition-colors min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a href={`tel:${customer.phone}`} className="flex items-center gap-3 text-sm text-foreground/90 hover:text-foreground transition-colors min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                {customer.phone}
              </a>
            )}
            {(customer.address || customer.city) && (
              <div className="flex items-center gap-3 text-sm text-foreground/90 min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                <span>{[customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {customer.source && (
              <div className="flex items-center gap-3 text-sm text-foreground/90 min-h-[44px]">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4 text-titan-cyan" aria-hidden="true" />
                </div>
                <span className="capitalize">Source: {customer.source.replace("_", " ")}</span>
              </div>
            )}
          </div>
          <div className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-foreground mb-3">Notes</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{customer.notes || "No customer notes yet."}</p>
          </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-3"><ImageIcon className="w-4 h-4 text-titan-cyan" /> Files & photos</h2>
            <label className="inline-flex mb-4 cursor-pointer">
              <span className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs text-foreground/90 hover:bg-muted"><Plus className="w-3.5 h-3.5 mr-1.5" />{uploadingFile ? "Uploading…" : "Upload file"}</span>
              <input type="file" className="sr-only" disabled={uploadingFile} onChange={(event) => { uploadCustomerFile(event.target.files?.[0]); event.target.value = ""; }} />
            </label>
            <div className="flex flex-wrap gap-3">
              {customer.photo_url && <img src={customer.photo_url} alt={`${fullName} profile`} className="w-24 h-24 rounded-xl object-cover border border-border" />}
              {customerFiles.map(file => (
                <a key={file.id} href={file.file_url || file.url} target="_blank" rel="noreferrer" className="w-24 min-h-24 rounded-xl border border-border bg-muted/50 p-2 text-xs text-foreground/85 hover:border-titan-cyan/40">
                  {(file.content_type || "").startsWith("image/") && <img src={file.file_url || file.url} alt="" className="w-full h-14 object-cover rounded-lg mb-2" />}
                  <span className="line-clamp-2">{file.name || "Attachment"}</span>
                </a>
              ))}
              {!customer.photo_url && !customerFiles.length && <p className="text-sm text-muted-foreground">No files or photos uploaded yet.</p>}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <RecordList title="Jobs" icon={Briefcase} records={jobs} empty="No jobs for this customer yet." to="/jobs"
              renderRecord={job => <div key={job.id} className="rounded-xl bg-muted/50 p-3 flex justify-between gap-3"><div><p className="text-sm text-foreground">{job.title}</p><p className="text-xs text-muted-foreground">{formatMonthDayYear(job.scheduled_date || job.created_date)}</p></div><StatusBadge status={job.status} /></div>} />
            <RecordList title="Estimates" icon={FileText} records={estimates} empty="No estimates yet." to="/estimates"
              renderRecord={estimate => <div key={estimate.id} className="rounded-xl bg-muted/50 p-3 flex justify-between gap-3"><div><p className="text-sm text-foreground">{estimate.estimate_number || "Draft estimate"}</p><p className="text-xs text-muted-foreground">${Number(estimate.total || 0).toLocaleString()}</p></div><StatusBadge status={estimate.status} /></div>} />
            <RecordList title="Invoices & payments" icon={Receipt} records={invoices} empty="No invoices yet." to="/invoices"
              renderRecord={invoice => <div key={invoice.id} className="rounded-xl bg-muted/50 p-3 flex justify-between gap-3"><div><p className="text-sm text-foreground">{invoice.invoice_number || "Draft invoice"}</p><p className="text-xs text-muted-foreground">${Number(invoice.balance_due ?? invoice.total ?? 0).toLocaleString()} due</p></div><StatusBadge status={invoice.status} /></div>} />
          </div>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-titan-cyan" /> Business Timeline
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Source of truth for this customer — estimates, jobs, check-ins, payments, messages, and files.
            </p>
            <BusinessTimeline events={timeline} empty="No appointments or transactions recorded." max={25} />
          </section>

          <section className="glass rounded-2xl p-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4"><MessageSquare className="w-4 h-4 text-titan-cyan" /> Communication history</h2>
            <div className="grid sm:grid-cols-[140px_1fr_auto] gap-2 mb-4">
              <Select value={communicationForm.type} onValueChange={type => setCommunicationForm(prev => ({ ...prev, type }))}><SelectTrigger className="bg-muted border-border text-foreground rounded-xl"><SelectValue /></SelectTrigger><SelectContent className="bg-muted border-border">{COMMUNICATION_TYPES.map(type => <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>)}</SelectContent></Select>
              <Textarea value={communicationForm.body} onChange={event => setCommunicationForm(prev => ({ ...prev, body: event.target.value }))} placeholder="Log a call, email, or text…" className="min-h-11 bg-muted border-border text-foreground rounded-xl" />
              <Button onClick={addCommunication} className="bg-titan-cyan text-black hover:bg-titan-cyan/90 rounded-xl"><Plus className="w-4 h-4 mr-1" /> Add</Button>
            </div>
            {communications.length ? <div className="space-y-2">{communications.map(entry => <div key={entry.id} className="rounded-xl bg-muted/50 p-3"><div className="flex justify-between gap-3 text-xs text-muted-foreground mb-1"><span className="capitalize">{entry.type}</span><span>{formatMonthDayYear(entry.date || entry.created_at || entry.created_date)}</span></div><p className="text-sm text-foreground/90 whitespace-pre-wrap">{entry.body}</p></div>)}</div> : <p className="text-sm text-muted-foreground">{communicationFallback ? "No communications logged locally for this customer." : "No communications logged for this customer."}</p>}
          </section>
        </motion.div>
      )}
    </div>
  );
}
