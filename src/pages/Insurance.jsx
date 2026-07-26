import React, { useState, useRef } from "react";
import { Shield, Upload, FileText, Trash2, Eye, Copy, Check } from "lucide-react";
import { api } from "@/api/apiClient";
import { betaBadgeLabel } from "@/lib/plan";
import { useAuth } from "@/lib/AuthContext";
import PageShell from "@/components/shared/PageShell";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import EmptyState from "@/components/shared/EmptyState";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { toastDone, toastFail, PRESSABLE } from "@/lib/interaction";
import { ICON_SIZE, SURFACE, CARD_PAD } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { createInsuranceDoc, deleteInsuranceDoc, listInsuranceDocs } from "@/lib/insuranceApi";

export default function Insurance() {
  const { user } = useAuth();
  const { data: docs = [], setData: setDocs, loading, error, reload } = useSafeAsync(
    () => listInsuranceDocs(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [copied, setCopied] = useState(null);
  const fileInputRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const doc = await createInsuranceDoc(user, {
        name: file.name,
        url: file_url,
        size_label: `${(file.size / 1024).toFixed(1)} KB`,
        doc_type: "liability",
      });
      setDocs((rows) => [doc, ...rows]);
      toastDone("Document uploaded", file.name);
    } catch {
      toastFail("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id, name) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await deleteInsuranceDoc(user.id, id);
      setDocs((rows) => rows.filter((d) => d.id !== id));
      toastDone("Document deleted", name);
    } catch {
      toastFail("Couldn't delete document");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyLink = async (doc) => {
    try {
      await navigator.clipboard.writeText(doc.url);
      setCopied(doc.id);
      toastDone("Link copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toastFail("Couldn't copy link");
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading insurance" />;
  if (error) return <ErrorState title="Couldn't load insurance docs" onRetry={reload} />;

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="Liability Insurance"
        subtitle="Upload and share your certificate of insurance with clients"
        breadcrumbs={[
          { label: "More", to: "/more" },
          { label: "Insurance" },
        ]}
      />
      {betaBadgeLabel() ? (
        <div className={cn(SURFACE, "mb-5 px-4 py-2 text-caption font-semibold text-primary")}>
          {betaBadgeLabel()}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={cn(
          PRESSABLE,
          SURFACE,
          "mb-6 flex h-36 w-full flex-col items-center justify-center gap-3 border-2 border-dashed hover:border-primary/40 hover:bg-primary/5"
        )}
      >
        {uploading ? (
          <>
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className={cn(ICON_SIZE.lg, "text-muted-foreground")} aria-hidden="true" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Tap to upload insurance document</p>
              <p className="mt-1 text-caption">PDF, JPG, or PNG — synced to your account</p>
            </div>
          </>
        )}
      </button>

      {docs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No insurance documents yet"
          description="Upload a certificate of insurance so you can share proof of coverage with clients."
          actionLabel="Upload document"
          onAction={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="stack-2">
          {docs.map((doc) => (
            <article key={doc.id} className={cn(SURFACE, CARD_PAD, "flex items-center gap-3")}>
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-muted">
                <FileText className={cn(ICON_SIZE.md, "text-primary")} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                <p className="text-caption">{doc.size_label || doc.doc_type}</p>
              </div>
              <div className="flex gap-1">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(PRESSABLE, "rounded-md p-2 text-muted-foreground hover:bg-muted")}
                  aria-label={`View ${doc.name}`}
                >
                  <Eye className={ICON_SIZE.sm} />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyLink(doc)}
                  className={cn(PRESSABLE, "rounded-md p-2 text-muted-foreground hover:bg-muted")}
                  aria-label={`Copy link for ${doc.name}`}
                >
                  {copied === doc.id ? (
                    <Check className={cn(ICON_SIZE.sm, "text-success")} />
                  ) : (
                    <Copy className={ICON_SIZE.sm} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id, doc.name)}
                  disabled={Boolean(deletingId)}
                  className={cn(PRESSABLE, "rounded-md p-2 text-destructive hover:bg-muted")}
                  aria-label={deletingId === doc.id ? `Deleting ${doc.name}` : `Delete ${doc.name}`}
                >
                  <Trash2 className={ICON_SIZE.sm} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
