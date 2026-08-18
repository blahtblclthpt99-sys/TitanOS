import React from "react";
import { Link } from "react-router";
import { CheckCircle2, Loader2, MapPin, ShieldCheck, Wrench } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getMyServiceProfile, saveMyServiceProfile } from "@/lib/serviceProfilesApi";

const split = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const join = (value) => Array.isArray(value) ? value.join(", ") : "";

export default function ServiceProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    displayName: "",
    bio: "",
    services: "",
    skills: "",
    serviceCity: "",
    serviceState: "",
    serviceRadiusMiles: 30,
    pricingMode: "quote",
    hourlyRate: 0,
    startingPrice: 0,
    availability: "available",
    availabilityTags: "",
    licenses: "",
    certifications: "",
    equipment: "",
    insured: false,
    businessName: "",
    website: "",
    businessContact: "",
    published: false,
  });

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const profile = await getMyServiceProfile(user.id);
      setForm({
        displayName: profile?.displayName || user.full_name || "",
        bio: profile?.bio || "",
        services: join(profile?.services),
        skills: join(profile?.skills),
        serviceCity: profile?.serviceCity || user.city || "",
        serviceState: profile?.serviceState || user.state || "",
        serviceRadiusMiles: Number(profile?.serviceRadiusMiles || 30),
        pricingMode: profile?.pricingMode || "quote",
        hourlyRate: Number(profile?.hourlyRate || 0),
        startingPrice: Number(profile?.startingPrice || 0),
        availability: profile?.availability || "available",
        availabilityTags: join(profile?.availabilityTags),
        licenses: join(profile?.licenses),
        certifications: join(profile?.certifications),
        equipment: join(profile?.equipment),
        insured: Boolean(profile?.insured),
        businessName: profile?.businessName || "",
        website: profile?.website || "",
        businessContact: profile?.businessContact || "",
        published: Boolean(profile?.published),
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't load Service Profile", description: error?.message || "Try again." });
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => { void load(); }, [load]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      await saveMyServiceProfile(user.id, {
        ...form,
        services: split(form.services),
        skills: split(form.skills),
        availabilityTags: split(form.availabilityTags),
        licenses: split(form.licenses),
        certifications: split(form.certifications),
        equipment: split(form.equipment),
      });
      toast({
        title: "Service Profile saved",
        description: form.published
          ? "Customers and businesses can discover the professional service information you chose to publish."
          : "Titan will use the profile privately for independent-work matching until you publish it.",
      });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save Service Profile", description: error?.message || "Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading Service Profile" />;

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader
        eyebrow="Independent Work"
        title="Service Profile"
        subtitle="Describe the services you provide, where you work, pricing preferences, credentials, and equipment. Titan never publishes your exact home address."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="titan-surface p-4"><Wrench className="h-5 w-5 text-primary" aria-hidden="true" /><p className="mt-3 font-semibold text-foreground">Services first</p><p className="mt-1 text-xs text-muted-foreground">Titan matches projects and requests against what you actually provide.</p></div>
        <div className="titan-surface p-4"><MapPin className="h-5 w-5 text-primary" aria-hidden="true" /><p className="mt-3 font-semibold text-foreground">General service area</p><p className="mt-1 text-xs text-muted-foreground">Show city/state and a radius, not a private home address.</p></div>
        <div className="titan-surface p-4"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /><p className="mt-3 font-semibold text-foreground">You control discovery</p><p className="mt-1 text-xs text-muted-foreground">Publishing is optional and independent from your private opportunity matching.</p></div>
      </section>

      <form onSubmit={save} className="titan-surface space-y-6 p-5 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Display name</span><Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} required /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Business name <span className="font-normal text-muted-foreground">optional</span></span><Input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="Sole proprietor or trade name" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Services</span><Input value={form.services} onChange={(e) => set("services", e.target.value)} placeholder="delivery, lawn care, cleaning, repairs, photography" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Skills</span><Input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="box truck, pressure washing, drywall, portrait photography" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Service city</span><Input value={form.serviceCity} onChange={(e) => set("serviceCity", e.target.value)} placeholder="Oklahoma City" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">State</span><Input value={form.serviceState} onChange={(e) => set("serviceState", e.target.value)} placeholder="OK" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Service radius (miles)</span><Input type="number" min="1" max="500" value={form.serviceRadiusMiles} onChange={(e) => set("serviceRadiusMiles", e.target.value)} /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Availability</span><select value={form.availability} onChange={(e) => set("availability", e.target.value)} className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm"><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Not taking work</option></select></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Availability details</span><Input value={form.availabilityTags} onChange={(e) => set("availabilityTags", e.target.value)} placeholder="available today, weekdays, weekends, evenings" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Pricing</span><select value={form.pricingMode} onChange={(e) => set("pricingMode", e.target.value)} className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm"><option value="quote">Quote required</option><option value="hourly">Hourly</option><option value="flat">Flat rate</option><option value="starting_at">Starting price</option></select></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Hourly rate <span className="font-normal text-muted-foreground">optional</span></span><Input type="number" min="0" step="0.01" value={form.hourlyRate} onChange={(e) => set("hourlyRate", e.target.value)} /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Starting price <span className="font-normal text-muted-foreground">optional</span></span><Input type="number" min="0" step="0.01" value={form.startingPrice} onChange={(e) => set("startingPrice", e.target.value)} /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Licenses</span><Input value={form.licenses} onChange={(e) => set("licenses", e.target.value)} placeholder="contractor license, CDL, business license" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Certifications</span><Input value={form.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder="forklift, OSHA 10, EPA 608" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Equipment</span><Input value={form.equipment} onChange={(e) => set("equipment", e.target.value)} placeholder="pickup truck, trailer, mower, pressure washer, camera kit" /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Website <span className="font-normal text-muted-foreground">optional</span></span><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." /></label>
          <label className="space-y-1.5"><span className="text-xs font-semibold text-foreground">Business contact <span className="font-normal text-muted-foreground">optional</span></span><Input value={form.businessContact} onChange={(e) => set("businessContact", e.target.value)} placeholder="business email or phone" /></label>
          <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-semibold text-foreground">Professional summary</span><Textarea rows={4} value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Explain what you do, the customers you help, and the kind of independent work you want." /></label>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.insured} onChange={(e) => set("insured", e.target.checked)} /><span><span className="block text-sm font-semibold text-foreground">I have applicable insurance</span><span className="block text-xs text-muted-foreground">This is user-reported unless Titan separately verifies documentation.</span></span></label>
          <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={form.published} onChange={(e) => set("published", e.target.checked)} /><span><span className="block text-sm font-semibold text-foreground">Let customers and businesses discover my Service Profile</span><span className="block text-xs text-muted-foreground">Publishes only the professional service information above. Exact private location is not part of this profile.</span></span></label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}{saving ? "Saving…" : "Save Service Profile"}</Button>
          <Button asChild type="button" variant="outline"><Link to="/work-opportunities">View opportunities</Link></Button>
        </div>
      </form>
    </PageShell>
  );
}
