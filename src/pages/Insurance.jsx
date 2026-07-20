import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Shield, Upload, FileText, Trash2, Eye, Copy, Check } from "lucide-react";
import { api } from "@/api/apiClient";
import { toast } from "@/components/ui/use-toast";
import { betaBadgeLabel } from "@/lib/plan";
import { useAuth } from "@/lib/AuthContext";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useSafeAsync } from "@/hooks/useSafeAsync";
import { createInsuranceDoc, deleteInsuranceDoc, listInsuranceDocs } from "@/lib/insuranceApi";

export default function Insurance() {
  const { user } = useAuth();
  const { data: docs = [], setData: setDocs, loading, error, reload } = useSafeAsync(
    () => listInsuranceDocs(user.id),
    [user?.id],
    { enabled: Boolean(user?.id), initial: [] }
  );
  const [uploading, setUploading] = useState(false);
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
      toast({ title: "Document uploaded", description: file.name });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id) => {
    await deleteInsuranceDoc(user.id, id);
    setDocs((rows) => rows.filter((d) => d.id !== id));
  };

  const handleCopyLink = (doc) => {
    navigator.clipboard.writeText(doc.url);
    setCopied(doc.id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <PageLoader variant="list" label="Loading insurance" />;
  if (error) return <ErrorState title="Couldn't load insurance docs" onRetry={reload} />;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-titan-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Liability Insurance</h1>
            <p className="text-sm text-muted-foreground">Upload and share your certificate of insurance with clients</p>
          </div>
        </div>
      </motion.div>
      {betaBadgeLabel() && (
        <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">
          {betaBadgeLabel()}
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 hover:border-titan-cyan/40 hover:bg-titan-cyan/5 transition-all disabled:opacity-50 mb-6"
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-titan-cyan border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Upload className="w-7 h-7 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Tap to upload insurance document</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, or PNG — synced to your account</p>
              </div>
            </>
          )}
        </button>
      </motion.div>

      {docs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-center py-16">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No insurance documents uploaded yet</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-none">
                <FileText className="w-5 h-5 text-titan-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.size_label || doc.doc_type}</p>
              </div>
              <div className="flex gap-1">
                <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label={`View ${doc.name}`}><Eye className="w-4 h-4" /></a>
                <button type="button" onClick={() => handleCopyLink(doc)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label={`Copy link for ${doc.name}`}>
                  {copied === doc.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => handleDelete(doc.id)} className="p-2 rounded-lg hover:bg-muted text-red-400" aria-label={`Delete ${doc.name}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
