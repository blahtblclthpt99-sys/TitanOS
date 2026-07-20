import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import { getBookingPageBySlug, listAvailability, submitBookingRequest, WEEKDAYS } from "@/lib/bookingApi";

const initialForm = { customer_name: "", customer_email: "", customer_phone: "", service: "", preferred_date: "", preferred_time: "", notes: "", is_same_day: false };
const inputClass = "bg-white/[.06] border-border text-foreground rounded-xl";

export default function PublicBooking() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const bookingPage = await getBookingPageBySlug(slug);
      if (!bookingPage) return setStatus("missing");
      setPage(bookingPage);
      setForm((current) => ({ ...current, service: bookingPage.services?.[0] || "" }));
      setAvailability(await listAvailability(bookingPage.owner_id));
      setStatus("ready");
    })().catch(() => setStatus("missing"));
  }, [slug]);

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try { await submitBookingRequest(page, form); setStatus("success"); }
    catch { setStatus("error"); }
    finally { setSubmitting(false); }
  };
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  if (status === "loading") return <div className="min-h-screen bg-background grid place-items-center text-muted-foreground"><Loader2 className="animate-spin w-6 h-6" /></div>;
  if (status === "missing") return <main className="min-h-screen bg-background grid place-items-center p-6 text-center"><div className="glass rounded-3xl p-8 text-foreground"><h1 className="text-xl font-semibold">Booking page unavailable</h1><p className="text-foreground/45 mt-2">This page may be unpublished or no longer available.</p></div></main>;
  if (status === "success") return <main className="min-h-screen bg-background grid place-items-center p-6 text-center"><div className="glass rounded-3xl p-8 max-w-md"><h1 className="text-2xl font-bold text-foreground">Request sent</h1><p className="text-muted-foreground mt-3">Thanks — {page.title} will get back to you shortly.</p></div></main>;

  const openDays = availability.filter((slot) => slot.is_open !== false);
  return <main className="min-h-screen bg-background text-foreground p-4 md:p-8"><div className="max-w-3xl mx-auto"><header className="glass rounded-3xl p-6 md:p-8 border border-border"><h1 className="text-3xl font-bold">{page.title}</h1>{page.verified_badge && <div className="mt-3"><TitanVerifiedBadge size="sm" /></div>}<p className="text-muted-foreground mt-4 whitespace-pre-line">{page.bio}</p><div className="mt-5 flex flex-wrap gap-2">{(page.services || []).map((service) => <span key={service} className="rounded-full bg-titan-cyan/10 text-titan-cyan px-3 py-1 text-sm">{service}</span>)}</div><p className="text-sm text-foreground/45 mt-5">{[page.city, page.state].filter(Boolean).join(", ") || page.service_area || "Service area available on request"}</p></header>
    <section className="glass rounded-3xl p-6 border border-border mt-5"><h2 className="font-semibold">Availability</h2><p className="text-sm text-muted-foreground mt-2">{openDays.length ? openDays.map((slot) => `${WEEKDAYS[Number(slot.weekday)]} ${slot.start_time}–${slot.end_time}`).join(" · ") : "Contact the provider for available times."}</p></section>
    <form onSubmit={submit} className="glass rounded-3xl p-6 md:p-8 border border-border mt-5 space-y-4"><h2 className="text-xl font-semibold">Request a booking</h2>{status === "error" && <p className="text-sm text-red-300">Your request couldn't be sent. Please try again.</p>}<div className="grid sm:grid-cols-2 gap-4"><label className="text-sm text-muted-foreground">Name<Input required value={form.customer_name} onChange={(e) => change("customer_name", e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Email<Input type="email" value={form.customer_email} onChange={(e) => change("customer_email", e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Phone<Input value={form.customer_phone} onChange={(e) => change("customer_phone", e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Service<select value={form.service} onChange={(e) => change("service", e.target.value)} className={`mt-1 w-full h-10 px-3 ${inputClass}`}>{(page.services || ["General"]).map((service) => <option key={service}>{service}</option>)}</select></label><label className="text-sm text-muted-foreground">Preferred date<Input required type="date" value={form.preferred_date} onChange={(e) => change("preferred_date", e.target.value)} className={`mt-1 ${inputClass}`} /></label><label className="text-sm text-muted-foreground">Preferred time<Input required type="time" value={form.preferred_time} onChange={(e) => change("preferred_time", e.target.value)} className={`mt-1 ${inputClass}`} /></label></div><label className="block text-sm text-muted-foreground">Notes<Textarea value={form.notes} onChange={(e) => change("notes", e.target.value)} rows={4} className={`mt-1 ${inputClass}`} /></label>{page.accepts_same_day && <label className="flex gap-2 items-center text-sm text-foreground/85"><input type="checkbox" checked={form.is_same_day} onChange={(e) => change("is_same_day", e.target.checked)} className="accent-cyan-400" />This is a same-day request</label>}<Button disabled={submitting} type="submit" className="w-full bg-titan-cyan text-black">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send booking request"}</Button></form>
  </div></main>;
}
