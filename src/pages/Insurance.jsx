import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Shield, Upload, FileText, Download, Trash2, Eye, Copy, Check } from "lucide-react";
import { api } from "@/api/apiClient";
import { toast } from "@/components/ui/use-toast";
import { betaBadgeLabel } from "@/lib/plan";

export default function Insurance() {
  const [docs, setDocs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("insurance_docs") || "[]"); } catch { return []; }
  });
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(null);
  const fileInputRef = useRef(null);

  const saveDocs = (updated) => {
    setDocs(updated);
    localStorage.setItem("insurance_docs", JSON.stringify(updated));
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file });
      const doc = {
        id: Date.now().toString(),
        name: file.name,
        url: file_url,
        uploaded: new Date().toLocaleDateString(),
        size: (file.size / 1024).toFixed(1) + " KB",
      };
      saveDocs([...docs, doc]);
      toast({ title: "Document uploaded", description: file.name });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = (id) => {
    saveDocs(docs.filter((d) => d.id !== id));
  };

  const handleCopyLink = (doc) => {
    navigator.clipboard.writeText(doc.url);
    setCopied(doc.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-titan-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Liability Insurance</h1>
            <p className="text-sm text-white/40">Upload and share your certificate of insurance with clients</p>
          </div>
        </div>
      </motion.div>
      {betaBadgeLabel() && <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">{betaBadgeLabel()}</div>}

      {/* Upload Area */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-titan-cyan/40 hover:bg-titan-cyan/5 transition-all disabled:opacity-50 mb-6"
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-titan-cyan border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Upload className="w-7 h-7 text-white/30" />
              <div className="text-center">
                <p className="text-sm font-medium text-white/60">Tap to upload insurance document</p>
                <p className="text-xs text-white/30 mt-1">PDF, JPG, or PNG</p>
              </div>
            </>
          )}
        </button>
      </motion.div>

      {/* Documents List */}
      {docs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="text-center py-16">
          <Shield className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">No insurance documents uploaded yet</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {docs.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-titan-indigo/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-titan-indigo" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{doc.name}</p>
                <p className="text-xs text-white/30 mt-0.5">{doc.size} · Uploaded {doc.uploaded}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                  <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" title="View">
                    <Eye className="w-4 h-4 text-white/50" />
                  </button>
                </a>
                <button
                  onClick={() => handleCopyLink(doc)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                  title="Copy shareable link"
                >
                  {copied === doc.id
                    ? <Check className="w-4 h-4 text-titan-cyan" />
                    : <Copy className="w-4 h-4 text-white/50" />}
                </button>
                <a href={doc.url} download={doc.name}>
                  <button className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors" title="Download">
                    <Download className="w-4 h-4 text-white/50" />
                  </button>
                </a>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/10 flex items-center justify-center transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-white/30 hover:text-red-400" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Tip */}
      {docs.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="mt-6 p-4 rounded-xl bg-titan-cyan/5 border border-titan-cyan/10">
          <p className="text-xs text-titan-cyan/70 text-center">
            💡 Copy the shareable link to send your insurance certificate directly to clients
          </p>
        </motion.div>
      )}
    </div>
  );
}