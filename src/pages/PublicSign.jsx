import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getContractByToken, signContract } from "@/lib/contractsApi";

export default function PublicSign() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [signature, setSignature] = useState("");
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  useEffect(() => { getContractByToken(token).then((row) => { setContract(row); setStatus(row ? "ready" : "missing"); }).catch(() => setStatus("missing")); }, [token]);
  const sign = async (event) => { event.preventDefault(); if (saving || !signature.trim()) return; setSaving(true); try { await signContract(contract, { role: "customer", signature: signature.trim() }); setStatus("success"); } catch { setStatus("error"); } finally { setSaving(false); } };
  if (status === "loading") return <main className="min-h-screen bg-background grid place-items-center text-foreground"><Loader2 className="w-6 h-6 animate-spin" /></main>;
  if (status === "missing") return <main className="min-h-screen bg-background grid place-items-center p-6"><div className="glass rounded-3xl p-8 text-center text-foreground"><h1 className="text-xl font-semibold">Contract unavailable</h1><p className="text-foreground/45 mt-2">This signing link is invalid or has expired.</p></div></main>;
  if (status === "success") return <main className="min-h-screen bg-background grid place-items-center p-6"><div className="glass rounded-3xl p-8 text-center text-foreground"><h1 className="text-2xl font-bold">Signed successfully</h1><p className="text-muted-foreground mt-2">Thank you for signing this agreement.</p></div></main>;
  return <main className="min-h-screen bg-background text-foreground p-4 md:p-8"><div className="max-w-3xl mx-auto glass rounded-3xl p-6 md:p-8 border border-border"><p className="text-xs text-titan-cyan uppercase tracking-widest">TitanOS agreement</p><h1 className="text-2xl font-bold mt-2">{contract.title}</h1>{contract.customer_name && <p className="text-muted-foreground mt-1">Prepared for {contract.customer_name}</p>}<div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-foreground/90 border-y border-border py-6">{contract.body}</div><form onSubmit={sign} className="mt-6"><label className="text-sm text-muted-foreground">Your full name (signature)<Input required value={signature} onChange={(e) => setSignature(e.target.value)} className="mt-1 bg-white/[.06] border-border text-foreground rounded-xl" /></label>{status === "error" && <p className="text-sm text-red-300 mt-3">Unable to sign. Please try again.</p>}<Button disabled={saving} type="submit" className="mt-4 w-full bg-titan-cyan text-black">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign agreement"}</Button></form></div></main>;
}
