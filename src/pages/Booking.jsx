import React, { useEffect, useState } from "react";
import { Copy, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { betaBadgeLabel } from "@/lib/plan";
import { api } from "@/api/apiClient";
import {
  bookingPublicUrl, getOrCreateBookingPage, listAvailability, listBookingRequests,
  saveAvailability, updateBookingPage, WEEKDAYS,
} from "@/lib/bookingApi";

const inputClass = "bg-titan-surface2 border-border text-foreground rounded-xl";
const defaultSlots = () => WEEKDAYS.map((_, weekday) => ({ weekday, is_open: weekday > 0 && weekday < 6, start_time: "09:00", end_time: "17:00" }));

export default function Booking() {
  const { user, authChecked } = useAuth();
  const [page, setPage] = useState(null);
  const [form, setForm] = useState(null);
  const [slots, setSlots] = useState(defaultSlots);
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    const bookingPage = await getOrCreateBookingPage(user);
    const [availability, incoming] = await Promise.all([listAvailability(user.id), listBookingRequests(user.id)]);
    setPage(bookingPage);
    setForm({ ...bookingPage, servicesText: (bookingPage.services || []).join(", ") });
    setSlots(defaultSlots().map((slot) => ({ ...slot, ...(availability.find((item) => Number(item.weekday) === slot.weekday) || {}) })));
    setRequests(incoming.sort((a, b) => new Date(b.created_date || b.created_at) - new Date(a.created_date || a.created_at)));
  };

  useEffect(() => { if (authChecked && user?.id) load().catch(() => toast({ variant: "destructive", title: "Couldn't load booking page" })); }, [authChecked, user?.id]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const savePage = async (event) => {
    event.preventDefault();
    if (saving || !page) return;
    setSaving(true);
    try {
      const saved = await updateBookingPage(page.id, {
        ...form,
        owner_id: user.id,
        services: form.servicesText.split(",").map((value) => value.trim()).filter(Boolean),
      });
      setPage(saved);
      setForm({ ...saved, servicesText: (saved.services || []).join(", ") });
      toast({ title: "Booking page saved" });
    } catch { toast({ variant: "destructive", title: "Couldn't save booking page" }); }
    finally { setSaving(false); }
  };

  const saveSlots = async () => {
    if (savingAvailability) return;
    setSavingAvailability(true);
    try { setSlots(await saveAvailability(user, slots)); toast({ title: "Availability saved" }); }
    catch { toast({ variant: "destructive", title: "Couldn't save availability" }); }
    finally { setSavingAvailability(false); }
  };

  const updateRequest = async (request, status) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.entities.BookingRequest.update(request.id, { status });
      setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item));
      toast({ title: `Request ${status}` });
    } catch { toast({ variant: "destructive", title: "Couldn't update request" }); }
    finally { setSaving(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(bookingPublicUrl(page.slug)); toast({ title: "Booking link copied" }); }
    catch { toast({ variant: "destructive", title: "Couldn't copy link" }); }
  };

  if (!authChecked || !form) return <PageLoader variant="list" label="Loading booking page" />;
  return <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
    <PageHeader title="Booking" subtitle="Publish a shareable page for customers to request service." />
    {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">{betaBadgeLabel()}</div>}
    <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-5">
      <form onSubmit={savePage} className="glass rounded-3xl p-5 md:p-7 border border-border space-y-4">
        <div className="flex items-center justify-between gap-4"><h2 className="font-semibold text-foreground">Public booking page</h2><label className="flex items-center gap-2 text-sm text-foreground/65"><input type="checkbox" checked={!!form.is_published} onChange={(e) => update("is_published", e.target.checked)} className="accent-cyan-400" /> Published</label></div>
        <div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-muted-foreground">Title<Input value={form.title || ""} onChange={(e) => update("title", e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Services (comma separated)<Input value={form.servicesText} onChange={(e) => update("servicesText", e.target.value)} className={`mt-1 ${inputClass}`} /></label></div>
        <label className="block text-sm text-muted-foreground">Bio<Textarea value={form.bio || ""} onChange={(e) => update("bio", e.target.value)} className={`mt-1 ${inputClass}`} rows={3} /></label>
        <div className="grid sm:grid-cols-3 gap-4">{["city", "state", "phone"].map((key) => <label key={key} className="text-sm text-muted-foreground capitalize">{key}<Input value={form[key] || ""} onChange={(e) => update(key, e.target.value)} className={`mt-1 ${inputClass}`} /></label>)}</div>
        <label className="flex items-center gap-2 text-sm text-foreground/65"><input type="checkbox" checked={!!form.accepts_same_day} onChange={(e) => update("accepts_same_day", e.target.checked)} className="accent-cyan-400" /> Accept same-day requests</label>
        {user?.verified_worker && <p className="flex items-center gap-1.5 text-xs text-titan-cyan"><ShieldCheck className="w-4 h-4" /> Verified provider badge shown publicly</p>}
        <Button disabled={saving} type="submit" className="w-full bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save booking page"}</Button>
      </form>
      <aside className="glass rounded-3xl p-5 border border-border h-fit"><p className="text-xs text-muted-foreground uppercase tracking-wider">Shareable link</p><p className="text-sm text-foreground mt-2 break-all">{bookingPublicUrl(page.slug)}</p><Button onClick={copyLink} variant="outline" className="mt-4 w-full border-border text-foreground"><Copy className="w-4 h-4 mr-2" />Copy link</Button></aside>
    </div>
    <section className="glass rounded-3xl p-5 md:p-7 border border-border mt-5"><div className="flex justify-between gap-4 items-center"><h2 className="font-semibold text-foreground">Availability</h2><Button onClick={saveSlots} disabled={savingAvailability} className="bg-titan-cyan text-black">{savingAvailability ? "Saving…" : "Save availability"}</Button></div><div className="mt-4 space-y-2">{slots.map((slot, index) => <div key={slot.weekday} className="flex flex-wrap gap-3 items-center rounded-xl bg-white/[.03] p-3"><label className="w-24 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={slot.is_open} onChange={(e) => setSlots((items) => items.map((item, i) => i === index ? { ...item, is_open: e.target.checked } : item))} className="accent-cyan-400" />{WEEKDAYS[slot.weekday]}</label><Input type="time" disabled={!slot.is_open} value={slot.start_time} onChange={(e) => setSlots((items) => items.map((item, i) => i === index ? { ...item, start_time: e.target.value } : item))} className={`${inputClass} w-32`} /><span className="text-muted-foreground">to</span><Input type="time" disabled={!slot.is_open} value={slot.end_time} onChange={(e) => setSlots((items) => items.map((item, i) => i === index ? { ...item, end_time: e.target.value } : item))} className={`${inputClass} w-32`} /></div>)}</div></section>
    <section className="mt-5"><h2 className="font-semibold text-foreground mb-3">Incoming requests</h2><div className="space-y-3">{requests.length ? requests.map((request) => <article key={request.id} className="glass rounded-2xl p-4 border border-border flex flex-col sm:flex-row sm:items-center gap-3"><div className="flex-1"><p className="font-medium text-foreground">{request.customer_name} <span className="text-xs text-titan-cyan">· {request.service}</span></p><p className="text-xs text-foreground/45 mt-1">{request.preferred_date || "Flexible"} {request.preferred_time} · {request.customer_phone || request.customer_email || "No contact"}</p>{request.notes && <p className="text-sm text-muted-foreground mt-2">{request.notes}</p>}</div><div className="flex gap-2 items-center"><span className="text-xs capitalize text-foreground/45">{request.status}</span>{request.status === "new" && <><Button onClick={() => updateRequest(request, "accepted")} disabled={saving} className="h-8 bg-emerald-500/20 text-emerald-300">Accept</Button><Button onClick={() => updateRequest(request, "declined")} disabled={saving} variant="outline" className="h-8 border-border text-foreground">Decline</Button></>}</div></article>) : <p className="glass rounded-2xl p-6 text-sm text-muted-foreground">No booking requests yet.</p>}</div></section>
  </div>;
}
