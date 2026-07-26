import React, { useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import DeleteButton from "@/components/shared/DeleteButton";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { createCredential, daysUntilExpiry, deleteCredential, listCredentials } from "@/lib/credentialsApi";

export default function Credentials() {
  const { user } = useAuth();
  const { data: items = [], setData: setItems, loading, error, reload } = useSafeAsync(
    () => listCredentials(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (saving || !title) return;
    setSaving(true);
    try {
      const row = await createCredential(user, { title, expires_on: expires || null });
      setItems((current) => [...current, row]);
      setTitle("");
      setExpires("");
      toast({ title: "Credential added" });
    } catch (error) {
      toast({ variant: "destructive", title: "Couldn't add credential", description: error?.message || "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading credentials" />;
  if (error) return <ErrorState title="Couldn't load credentials" onRetry={reload} />;

  return (
    <div className="page-pad max-w-5xl mx-auto">
      <PageHeader title="Credentials" subtitle="Keep licenses, certifications, and insurance current" />
      <form onSubmit={add} className="titan-surface p-4 flex flex-wrap gap-2 mb-5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="License or certificate" className="flex-1 bg-muted border-border text-foreground" />
        <Input value={expires} onChange={(e) => setExpires(e.target.value)} type="date" className="bg-muted border-border text-foreground" />
        <Button disabled={saving}>{saving ? "Adding…" : "Add"}</Button>
      </form>
      {!items.length && (
        <EmptyState
          icon={ShieldCheck}
          title="No credentials yet"
          description="Track licenses, certifications, and insurance expirations here."
        />
      )}
      <div className="space-y-3">
        {items.map((item) => {
          const days = daysUntilExpiry(item);
          const bad = days !== null && days < 30;
          return (
            <article className="titan-surface p-4 flex gap-3 items-start" key={item.id}>
              {bad ? <AlertTriangle className="text-titan-amber" /> : <ShieldCheck className="text-titan-cyan" />}
              <div className="flex-1">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className={`text-sm ${days < 0 ? "text-red-300" : bad ? "text-titan-amber" : "text-foreground/45"}`}>
                  {days === null
                    ? "No expiry recorded"
                    : days < 0
                      ? `Expired ${Math.abs(days)} days ago`
                      : `${days} days until expiry`}
                </p>
              </div>
              <DeleteButton
                label={item.title}
                onDelete={async () => {
                  try {
                    await deleteCredential(user.id, item.id);
                    setItems((prev) => prev.filter((row) => row.id !== item.id));
                    toast({ title: "Credential removed" });
                  } catch {
                    toast({ variant: "destructive", title: "Couldn't remove credential" });
                  }
                }}
              />
            </article>
          );
        })}
      </div>
    </div>
  );
}
