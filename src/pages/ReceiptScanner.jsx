import React, { useRef, useState } from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import NativeSelect from "@/components/shared/NativeSelect";
import { api } from "@/api/apiClient";
import { EXPENSE_CATEGORIES } from "@/lib/platformConstants";
import { extractTextFromReceipt, fileToDataUrl, parseReceiptText } from "@/lib/receiptOcr";

const empty = { vendor: "", amount: "", date: new Date().toISOString().slice(0, 10), category: "other", raw_text: "" };

export default function ReceiptScanner() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [receipt, setReceipt] = useState(empty);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectFile = async (event) => {
    const next = event.target.files?.[0];
    if (!next) return;
    setFile(next);
    try { setPreview(await fileToDataUrl(next)); } catch { setPreview(""); }
  };
  const parse = async () => {
    if (parsing || (!file && !pastedText.trim())) return;
    setParsing(true);
    try {
      const raw = await extractTextFromReceipt({ file, pastedText });
      setReceipt(parseReceiptText(raw || pastedText));
      toast({ title: "Receipt parsed", description: raw ? "Review the detected fields before saving." : "Add details below; image OCR is optional." });
    } catch { toast({ variant: "destructive", title: "Couldn't parse receipt" }); } finally { setParsing(false); }
  };
  const save = async () => {
    if (saving || !receipt.vendor.trim() || !Number(receipt.amount)) return;
    setSaving(true);
    try {
      let receipt_url = "";
      if (file) ({ file_url: receipt_url } = await api.integrations.Core.UploadFile({ file }));
      const expense = await api.entities.Expense.create({ description: receipt.vendor.trim(), vendor: receipt.vendor.trim(), amount: Number(receipt.amount), date: receipt.date, category: receipt.category, receipt_url, is_tax_deductible: true, business_use_percent: 100 });
      await api.entities.ReceiptScan.create({ expense_id: expense.id, receipt_url, raw_text: receipt.raw_text || pastedText, vendor: receipt.vendor.trim(), amount: Number(receipt.amount), date: receipt.date, category: receipt.category });
      toast({ title: "Tax-deductible expense saved" });
      setFile(null); setPreview(""); setPastedText(""); setReceipt(empty);
    } catch (error) { toast({ variant: "destructive", title: "Couldn't save receipt", description: error.message }); } finally { setSaving(false); }
  };
  const change = (key, value) => setReceipt((current) => ({ ...current, [key]: value }));

  return <div className="p-4 md:p-8 max-w-3xl mx-auto pb-24">
    <PageHeader title="Receipt Scanner" subtitle="Turn receipts into tax-deductible expenses" />
    <div className="glass rounded-2xl p-6 border border-border space-y-5">
      <input ref={inputRef} type="file" accept="image/*" onChange={selectFile} className="hidden" />
      {preview ? <img src={preview} alt="Receipt preview" className="w-full max-h-72 object-contain rounded-xl bg-black/20" /> : <button onClick={() => inputRef.current?.click()} className="w-full h-36 rounded-xl border border-dashed border-border hover:border-titan-cyan/50 flex flex-col items-center justify-center gap-2"><Camera className="w-7 h-7 text-titan-cyan" /><span className="text-sm text-muted-foreground">Upload receipt image</span></button>}
      {preview && <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} className="border-border text-foreground">Choose another image</Button>}
      <Textarea value={pastedText} onChange={(event) => setPastedText(event.target.value)} rows={4} placeholder="Optional: paste OCR text from the receipt" className="bg-titan-surface2 border-border text-foreground" />
      <Button type="button" onClick={parse} disabled={parsing || (!file && !pastedText.trim())} className="w-full bg-titan-cyan text-black font-semibold">{parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ScanLine className="w-4 h-4 mr-2" />Parse receipt</>}</Button>
    </div>
    <div className="glass rounded-2xl p-6 mt-6 border border-border space-y-4">
      <h2 className="font-semibold text-foreground">Review expense</h2>
      <Input value={receipt.vendor} onChange={(event) => change("vendor", event.target.value)} placeholder="Vendor" className="bg-titan-surface2 border-border text-foreground" />
      <div className="grid sm:grid-cols-2 gap-4"><Input type="number" step="0.01" min="0" value={receipt.amount} onChange={(event) => change("amount", event.target.value)} placeholder="Amount ($)" className="bg-titan-surface2 border-border text-foreground" /><Input type="date" value={receipt.date} onChange={(event) => change("date", event.target.value)} className="bg-titan-surface2 border-border text-foreground" /></div>
      <NativeSelect value={receipt.category} onValueChange={(category) => change("category", category)} placeholder="Category" options={EXPENSE_CATEGORIES.map((item) => ({ value: item.id, label: item.label }))} />
      <Button onClick={save} disabled={saving || !receipt.vendor || !Number(receipt.amount)} className="w-full bg-titan-cyan text-black font-semibold">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save deductible expense"}</Button>
    </div>
  </div>;
}
