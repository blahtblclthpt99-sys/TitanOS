import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import SiteFooter from "@/components/marketing/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrationHref } from "@/lib/marketingAttribution";
import { trackEvent } from "@/lib/productAnalytics";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function FreeTools() {
  const [revenue, setRevenue] = useState("5000");
  const [labor, setLabor] = useState("1800");
  const [materials, setMaterials] = useState("900");
  const [miles, setMiles] = useState("450");
  const [mileCost, setMileCost] = useState("0.70");

  useEffect(() => {
    document.title = "Free Field Service Profit Calculator | TitanOS";
  }, []);

  const result = useMemo(() => {
    const gross = Math.max(0, Number(revenue) || 0);
    const costs = Math.max(0, Number(labor) || 0) + Math.max(0, Number(materials) || 0) + Math.max(0, Number(miles) || 0) * Math.max(0, Number(mileCost) || 0);
    const profit = gross - costs;
    return { gross, costs, profit, margin: gross ? (profit / gross) * 100 : 0 };
  }, [revenue, labor, materials, miles, mileCost]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border px-4 py-2"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><TitanBrandLogo to="/" layout="svg" markClassName="h-9 w-9" /><Link to="/" className="inline-flex min-h-11 items-center rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-ring">Back to TitanOS</Link></div></header>
      <main className="mx-auto max-w-5xl px-4 py-12">
        <p className="landing-eyebrow">Free field tool</p>
        <h1 className="landing-display mt-2 max-w-3xl text-3xl sm:text-5xl">Know what the week actually earned.</h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">Estimate profit after labor, materials, and vehicle costs. Nothing is uploaded or saved.</p>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="titan-surface grid gap-5 p-6 sm:grid-cols-2" aria-label="Profit inputs">
            {[["Weekly revenue", revenue, setRevenue], ["Labor cost", labor, setLabor], ["Materials and fees", materials, setMaterials], ["Work miles", miles, setMiles], ["Estimated cost per mile", mileCost, setMileCost]].map(([label, value, setter]) => <div key={label}><Label>{label}</Label><Input className="mt-2" type="number" min="0" step="0.01" value={value} onChange={(event) => setter(event.target.value)} /></div>)}
          </section>
          <aside className="titan-surface bg-primary/5 p-6" aria-live="polite">
            <p className="text-sm font-semibold text-primary">Estimated weekly result</p>
            <div className="mt-5 text-4xl font-bold tabular-nums">{money.format(result.profit)}</div>
            <p className="mt-1 text-sm text-muted-foreground">{result.margin.toFixed(1)}% margin after {money.format(result.costs)} estimated costs</p>
            <div className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">TitanOS can track these signals across real jobs, shifts, mileage, expenses, invoices, and payments.</div>
            <Button asChild className="mt-6 min-h-12 w-full"><Link to={registrationHref({ source_page: "free_profit_calculator" })} onClick={() => trackEvent("cta_clicked", { location: "free_tool", action: "register" })}>Track it free during beta</Link></Button>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
