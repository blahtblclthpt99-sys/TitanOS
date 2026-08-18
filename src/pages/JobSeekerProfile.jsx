import React from "react";
import { BriefcaseBusiness, MapPin, ShieldCheck, UserSearch } from "lucide-react";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { getMyDriverProfile, saveMyDriverProfile } from "@/lib/driverProfilesApi";
import { getMyJobMatchPreferences, saveMyJobMatchPreferences } from "@/lib/jobMatchProfileApi";

const split = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const join = (value) => Array.isArray(value) ? value.join(", ") : "";

export default function JobSeekerProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    city: "",
    state: "",
    bio: "",
    skills: "",
    certifications: "",
    yearsExperience: 0,
    interests: "",
    schedule: "",
    radius: 50,
    desiredPay: 0,
    payType: "hourly",
    searchLat: null,
    searchLng: null,
    externalConsent: false,
    discoverable: false,
    available: true,
  });

  const load = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [profile, prefs] = await Promise.all([
        getMyDriverProfile(user.id),
        getMyJobMatchPreferences(user.id).catch(() => null),
      ]);
      setForm({
        name: profile?.name || user.full_name || "",
        city: profile?.city?.split(",")[0]?.trim() || user.city || "",
        state: profile?.city?.split(",")[1]?.trim() || user.state || "",
        bio: profile?.bio || "",
        skills: join(profile?.skills || prefs?.skills),
        certifications: join(profile?.certifications || prefs?.certifications),
        yearsExperience: Number(profile?.yearsExperience || prefs?.years_experience || 0),
        interests: join(prefs?.job_interests),
        schedule: join(prefs?.preferred_schedule),
        radius: Number(prefs?.work_radius_miles || 50),
        desiredPay: Number(prefs?.desired_pay_min || 0),
        payType: prefs?.desired_pay_type || "hourly",
        searchLat: prefs?.search_lat ?? profile?.lat ?? null,
        searchLng: prefs?.search_lng ?? profile?.lng ?? null,
        externalConsent: Boolean(prefs?.external_job_search_consent),
        discoverable: Boolean(profile?.published),
        available: profile?.availability !== "offline",
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't load job profile", description: error?.message || "Try again." });
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => { void load(); }, [load]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ variant: "destructive", title: "Location is not available on this device" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({ ...current, searchLat: position.coords.latitude, searchLng: position.coords.longitude }));
        toast({ title: "Location ready", description: "Titan will use this privately for radius matching." });
      },
      () => toast({ variant: "destructive", title: "Location permission was not granted" }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  const save = async (event) => {
    event.preventDefault();
    if (!user?.id || saving) return;
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Add your name" });
      return;
    }
    if (!split(form.skills).length && !split(form.interests).length) {
      toast({ variant: "destructive", title: "Add at least one skill or job interest" });
      return;
    }

    setSaving(true);
    try {
      await saveMyDriverProfile(user.id, {
        name: form.name.trim(),
        city: [form.city.trim(), form.state.trim()].filter(Boolean).join(", "),
        bio: form.bio.trim(),
        lat: form.searchLat,
        lng: form.searchLng,
        skills: split(form.skills),
        certifications: split(form.certifications),
        yearsExperience: Number(form.yearsExperience) || 0,
        availability: form.available ? "available" : "offline",
        published: Boolean(form.discoverable),
      });

      await saveMyJobMatchPreferences(user.id, {
        job_interests: split(form.interests),
        work_radius_miles: Number(form.radius) || 50,
        desired_pay_min: Number(form.desiredPay) || 0,
        desired_pay_type: form.payType,
        preferred_schedule: split(form.schedule),
        external_job_search_consent: Boolean(form.externalConsent),
        search_lat: form.searchLat,
        search_lng: form.searchLng,
      });

      toast({
        title: "Job profile saved",
        description: form.discoverable
          ? "Titan can now match you to jobs and show your published qualifications to nearby businesses with matching needs."
          : "Titan will use the profile for your private job matching. Businesses cannot discover it until you opt in.",
      });
      await load();
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save job profile", description: error?.message || "Try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading job profile" />;

  return (
    <PageShell maxWidth="lg" className="space-y-6">
      <PageHeader
        eyebrow="Job Seeker"
        title="Your Job Profile"
        subtitle="The more complete this is, the less random the job search becomes. Titan uses it to rank nearby openings and, only when you opt in, let matching businesses discover you."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="titan-surface p-4">
          <BriefcaseBusiness className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">Jobs come to you</p>
          <p className="mt-1 text-xs text-muted-foreground">Skills, qualifications, distance, pay, and schedule narrow the feed.</p>
        </div>
        <div className="titan-surface p-4">
          <UserSearch className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">Businesses can find you</p>
          <p className="mt-1 text-xs text-muted-foreground">Published profiles can appear in a business's ranked candidate list for a matching job.</p>
        </div>
        <div className="titan-surface p-4">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <p className="mt-3 font-semibold text-foreground">You control visibility</p>
          <p className="mt-1 text-xs text-muted-foreground">Pay preferences and precise search location remain private. Business discovery is opt-in.</p>
        </div>
      </section>

      <form onSubmit={save} className="titan-surface space-y-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Name</span>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Years of experience</span>
            <Input type="number" min="0" max="70" value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">City</span>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Oklahoma City" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">State</span>
            <Input value={form.state} onChange={(e) => set("state", e.target.value)} placeholder="OK" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground">Skills</span>
            <Input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="delivery, box truck, forklift, customer service" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground">Licenses & qualifications</span>
            <Input value={form.certifications} onChange={(e) => set("certifications", e.target.value)} placeholder="CDL A, DOT medical card, forklift certification" />
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground">Jobs you want</span>
            <Input value={form.interests} onChange={(e) => set("interests", e.target.value)} placeholder="courier, warehouse, maintenance, field service" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Preferred schedule</span>
            <Input value={form.schedule} onChange={(e) => set("schedule", e.target.value)} placeholder="weekday, day shift, weekend" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Search radius (miles)</span>
            <Input type="number" min="1" max="500" value={form.radius} onChange={(e) => set("radius", e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Desired minimum pay</span>
            <Input type="number" min="0" step="0.01" value={form.desiredPay} onChange={(e) => set("desiredPay", e.target.value)} />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">Pay type</span>
            <select value={form.payType} onChange={(e) => set("payType", e.target.value)} className="min-h-[44px] w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="flat">Flat/project</option>
              <option value="any">Any</option>
            </select>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-foreground">Professional summary</span>
            <Textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Briefly describe the work you do well, industries you've worked in, and what you're looking for next." />
          </label>
        </div>

        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">Private radius matching</p>
              <p className="mt-1 text-xs text-muted-foreground">Use device location to rank jobs by distance. Exact coordinates are not shown in your published profile.</p>
            </div>
            <Button type="button" variant="outline" onClick={useCurrentLocation} className="gap-2">
              <MapPin className="h-4 w-4" aria-hidden="true" />Use my location
            </Button>
          </div>
          {form.searchLat != null && form.searchLng != null ? <p className="mt-2 text-xs font-semibold text-primary">Location is ready for distance matching.</p> : null}
        </div>

        <div className="space-y-3 rounded-xl border border-border p-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.discoverable} onChange={(e) => set("discoverable", e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Let matching businesses find me</span>
              <span className="block text-xs text-muted-foreground">Publishes your professional qualifications, general location, experience, and availability so businesses can rank you for jobs. Private pay/search preferences stay private.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.available} onChange={(e) => set("available", e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-foreground">I'm available for opportunities</span>
              <span className="block text-xs text-muted-foreground">Signals availability in business candidate matching.</span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={form.externalConsent} onChange={(e) => set("externalConsent", e.target.checked)} />
            <span>
              <span className="block text-sm font-semibold text-foreground">Include approved outside job sources</span>
              <span className="block text-xs text-muted-foreground">Allows Titan to supplement Titan jobs with approved external listings when the integration is available.</span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save job profile"}</Button>
          <Button type="button" variant="outline" onClick={() => { window.location.href = "/hire/matches"; }}>View available jobs</Button>
        </div>
      </form>
    </PageShell>
  );
}
