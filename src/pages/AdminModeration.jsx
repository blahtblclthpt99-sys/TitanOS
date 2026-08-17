import React, { useEffect, useState } from "react";
import { Archive, Check, Loader2, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { api } from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { listTrustReports, resolveTrustReport } from "@/lib/ugcSafetyApi";
import { isUserAdmin } from "@/lib/isAdmin";

export default function AdminModeration() {
  const { user, authChecked, isLoadingAuth } = useAuth();
  const [reports, setReports] = useState([]);
  const [listings, setListings] = useState([]);
  const [trustReports, setTrustReports] = useState([]);
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [openReports, activeListings, trust] = await Promise.all([
        api.entities.MarketplaceReport.filter({ status: "open" }).catch(() => []),
        api.entities.MarketplaceListing.filter({ status: "active", moderated: false }).catch(() => []),
        listTrustReports({ status: "open" }),
      ]);
      setReports(openReports);
      setListings(activeListings);
      setTrustReports(trust);
    } catch (err) {
      setReports([]);
      setListings([]);
      setTrustReports([]);
      toast({ variant: "destructive", title: err?.message || "Couldn't load moderation queue" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authChecked && isUserAdmin(user)) load();
  }, [authChecked, user]);

  const dismissMarketplace = async (report) => {
    if (actingId) return;
    setActingId(report.id);
    try {
      await api.entities.MarketplaceReport.update(report.id, { status: "dismissed" });
      setReports((current) => current.filter((item) => item.id !== report.id));
      toast({ title: "Report dismissed" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't dismiss report" });
    } finally {
      setActingId(null);
    }
  };

  const moderate = async (listing, status, report) => {
    const key = report?.id || listing.id;
    if (actingId) return;
    setActingId(key);
    const moderationNotes = notes[listing.id]?.trim() || `Admin action: listing ${status}.`;
    try {
      await api.entities.MarketplaceListing.update(listing.id, {
        status,
        moderated: true,
        moderation_notes: moderationNotes,
      });
      if (report) await api.entities.MarketplaceReport.update(report.id, { status: "actioned" });
      setReports((current) => current.filter((item) => item.id !== report?.id));
      setListings((current) => current.filter((item) => item.id !== listing.id));
      toast({ title: status === "removed" ? "Listing removed" : "Listing archived" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't update listing" });
    } finally {
      setActingId(null);
    }
  };

  const resolveTrust = async (report, status) => {
    if (actingId) return;
    setActingId(report.id);
    try {
      await resolveTrustReport(report.id, status);
      setTrustReports((current) => current.filter((item) => item.id !== report.id));
      toast({ title: status === "resolved" ? "User report resolved" : "User report dismissed" });
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't update user report" });
    } finally {
      setActingId(null);
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Checking access" />;
  if (!isUserAdmin(user)) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <PageHeader title="Moderation" subtitle="Marketplace safety tools" />
        <EmptyState title="Access denied" description="You need admin access to moderate the marketplace." className="py-10" />
      </div>
    );
  }

  return (
    <div className="relative p-4 md:p-8 max-w-5xl mx-auto pb-32">
      <div className="relative">
        <PageHeader title="Moderation" subtitle="Server-backed user reports and marketplace review" />
        {loading ? (
          <PageLoader variant="list" label="Loading moderation queue" />
        ) : (
          <div className="space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <UserRound className="w-5 h-5 text-titan-cyan" />
                <h2 className="font-semibold text-foreground">User reports ({trustReports.length})</h2>
              </div>
              {trustReports.length ? (
                <div className="space-y-3">
                  {trustReports.map((report) => (
                    <article key={report.id} className="titan-surface border border-border p-5">
                      <p className="text-sm font-semibold text-foreground">
                        {report.target_name || "User"}
                        <span className="ml-2 text-xs font-mono text-muted-foreground">{report.target_id}</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Reporter: {report.reporter_name || report.reporter_id}
                      </p>
                      <p className="text-sm mt-2"><span className="text-muted-foreground">Reason:</span> {report.reason}</p>
                      {report.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{report.body}</p>}
                      {report.link && <p className="text-xs font-mono text-muted-foreground mt-2 break-all">Context: {report.link}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{new Date(report.created_at).toLocaleString()}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button disabled={!!actingId} onClick={() => resolveTrust(report, "resolved")}>Resolve</Button>
                        <Button disabled={!!actingId} variant="outline" onClick={() => resolveTrust(report, "dismissed")}>Dismiss</Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No open user reports" description="New account and direct-message reports will appear here." className="py-10" />
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-titan-amber" />
                <h2 className="font-semibold text-foreground">Marketplace reports ({reports.length})</h2>
              </div>
              {reports.length ? (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <article key={report.id} className="titan-surface border border-border p-5">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Listing: <span className="font-mono text-titan-cyan">{report.listing_id}</span></p>
                          <p className="text-sm text-foreground/85 mt-2"><span className="text-muted-foreground">Reason:</span> {report.reason}</p>
                          {report.details && <p className="text-sm text-muted-foreground mt-1">{report.details}</p>}
                        </div>
                        <Button onClick={() => dismissMarketplace(report)} disabled={!!actingId} variant="outline" className="h-9">
                          <Check className="w-4 h-4 mr-2" />
                          {actingId === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Dismiss"}
                        </Button>
                      </div>
                      <Textarea
                        value={notes[report.listing_id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [report.listing_id]: event.target.value }))}
                        placeholder="Moderation notes (optional)"
                        className="mt-4 bg-titan-surface2 border-border text-foreground rounded-xl min-h-[72px]"
                      />
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button onClick={() => moderate({ id: report.listing_id }, "removed", report)} disabled={!!actingId} className="bg-red-500/85 hover:bg-red-500 text-foreground">
                          <Trash2 className="w-4 h-4 mr-2" /> Remove listing
                        </Button>
                        <Button onClick={() => moderate({ id: report.listing_id }, "archived", report)} disabled={!!actingId} variant="outline">
                          <Archive className="w-4 h-4 mr-2" /> Archive listing
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="No open marketplace reports" description="Marketplace listing reports will appear here." className="py-10" />
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-5 h-5 text-titan-cyan" />
                <h2 className="font-semibold text-foreground">Unmoderated active listings ({listings.length})</h2>
              </div>
              {listings.length ? (
                <div className="grid md:grid-cols-2 gap-3">
                  {listings.map((listing) => (
                    <article key={listing.id} className="titan-surface border border-border p-5">
                      <p className="font-semibold text-foreground truncate">{listing.title || "Untitled listing"}</p>
                      <p className="text-xs font-mono text-titan-cyan mt-1">{listing.id}</p>
                      <p className="text-sm text-foreground/45 mt-3 line-clamp-2">{listing.description}</p>
                      <Textarea
                        value={notes[listing.id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [listing.id]: event.target.value }))}
                        placeholder="Moderation notes (optional)"
                        className="mt-4 bg-titan-surface2 border-border text-foreground rounded-xl min-h-[72px]"
                      />
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button onClick={() => moderate(listing, "removed")} disabled={!!actingId} className="bg-red-500/85 hover:bg-red-500 text-foreground">
                          <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </Button>
                        <Button onClick={() => moderate(listing, "archived")} disabled={!!actingId} variant="outline">
                          <Archive className="w-4 h-4 mr-2" /> Archive
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing to moderate" description="No active listings need moderation right now." className="py-10" />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
