import React, { useEffect, useState } from "react";
import { Copy, Megaphone, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { toast } from "@/components/ui/use-toast";
import {
  CHANNELS,
  createMarketingAsset,
  deleteMarketingAsset,
  generateMarketingCopy,
  listMarketingAssets,
  updateMarketingAsset,
} from "@/lib/marketingApi";
import DeleteButton from "@/components/shared/DeleteButton";

export default function MarketingStudio() {
  const { user, authChecked } = useAuth();
  const [channel, setChannel] = useState("facebook");
  const [service, setService] = useState("home services");
  const [city, setCity] = useState("");
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setSaved(await listMarketingAssets(user.id));
    } catch {
      toast({ variant: "destructive", title: "Couldn't load saved assets" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) { setLoading(false); return; }
    load();
  }, [authChecked, user?.id]);

  const generate = () => {
    const copy = generateMarketingCopy({
      businessName: user?.company_name || user?.full_name,
      service,
      city: city || user?.company_city || "your area",
      channel,
    });
    setDraft(copy);
  };

  const save = async () => {
    if (!draft || !user || saving) return;
    setSaving(true);
    try {
      const row = await createMarketingAsset(user, draft);
      setSaved((current) => [row, ...current]);
      toast({ title: "Saved to Marketing Studio" });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't save asset", description: error?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const markReady = async (row) => {
    try {
      const updated = await updateMarketingAsset(user.id, row.id, { status: "ready" });
      setSaved((current) => current.map((item) => (item.id === row.id ? updated : item)));
      toast({ title: "Marked ready" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update asset" });
    }
  };

  const copyBody = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy" });
    }
  };

  if (!authChecked || loading) return <PageLoader variant="list" label="Loading Marketing Studio" />;
  if (!user?.id) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24">
        <PageHeader title="AI Marketing" subtitle="One-click posts for Facebook, Instagram, Google, email & flyers" />
        <EmptyState
          title="Sign in to use Marketing Studio"
          description="Generating and saving marketing copy requires an account."
          actionLabel="Sign in"
          onAction={() => { window.location.href = "/login"; }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-28">
      <PageHeader title="AI Marketing" subtitle="One-click posts for Facebook, Instagram, Google, email & flyers" />
      <FeatureHonestyBanner>
        Copy is generated from templates on this device — not a live AI copywriter. Review before posting.
      </FeatureHonestyBanner>
      <div className="glass rounded-2xl p-5 mb-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <Button key={c} type="button" variant="outline" onClick={() => setChannel(c)} className={channel === c ? "border-titan-cyan text-titan-cyan" : "border-border text-muted-foreground"}>
              {c}
            </Button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input value={service} onChange={(e) => setService(e.target.value)} placeholder="Service (e.g. plumbing)" className="bg-muted border-border text-foreground" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="bg-muted border-border text-foreground" />
        </div>
        <Button onClick={generate} className="w-full sm:w-auto">
          <Sparkles className="w-4 h-4" /> Generate {channel} copy
        </Button>
      </div>

      {draft && (
        <div className="glass rounded-2xl p-5 mb-5 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">{draft.title}</h2>
          </div>
          <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={8} className="bg-muted border-border text-foreground mb-3" />
          <p className="text-xs text-muted-foreground mb-3">CTA: {draft.cta}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => copyBody(draft.body)}>
              <Copy className="w-4 h-4" /> Copy
            </Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save asset"}</Button>
          </div>
        </div>
      )}

      <h3 className="font-semibold text-foreground mb-3">Saved assets</h3>
      <div className="space-y-3">
        {saved.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No saved posts yet"
            description="Generate your first marketing post above."
          />
        ) : (
          saved.map((row) => (
            <article key={row.id} className="glass rounded-2xl p-4">
              <div className="flex justify-between gap-3 mb-2">
                <p className="font-medium text-foreground capitalize">{row.channel} · {row.title}</p>
                <span className="text-xs text-primary">{row.status}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{row.body}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => copyBody(row.body)}>Copy</Button>
                {row.status !== "ready" && (
                  <Button size="sm" onClick={() => markReady(row)}>Mark ready</Button>
                )}
                <DeleteButton
                  label={row.title || "this asset"}
                  onDelete={async () => {
                    try {
                      await deleteMarketingAsset(user.id, row.id);
                      setSaved((prev) => prev.filter((item) => item.id !== row.id));
                      toast({ title: "Asset deleted" });
                    } catch {
                      toast({ variant: "destructive", title: "Couldn't delete asset" });
                    }
                  }}
                />
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
