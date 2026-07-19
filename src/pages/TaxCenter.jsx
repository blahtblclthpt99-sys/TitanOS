import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText, DollarSign, TrendingDown, AlertCircle, Lightbulb, Calculator, Car,
  Home, Phone, Utensils, Briefcase, Shield, ScanLine
} from "lucide-react";
import NativeSelect from "@/components/shared/NativeSelect";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useEntityData } from "@/hooks/useEntityData";
import MileTracker from "@/components/tax/MileTracker";
import BusinessExpenses from "@/components/tax/BusinessExpenses";
import { getDateMonth, getDateYear } from "@/lib/date-utils";

// IRS standard mileage rate 2024
const MILEAGE_RATE = 0.67;

// SE tax rate (15.3%) and income tax bracket estimates
const SE_TAX_RATE = 0.153;
const SE_DEDUCTIBLE_RATE = 0.5; // can deduct half of SE tax

const TAX_BRACKETS_SINGLE = [
  { min: 0,      max: 11600,  rate: 0.10 },
  { min: 11600,  max: 47150,  rate: 0.12 },
  { min: 47150,  max: 100525, rate: 0.22 },
  { min: 100525, max: 191950, rate: 0.24 },
  { min: 191950, max: 243725, rate: 0.32 },
  { min: 243725, max: 609350, rate: 0.35 },
  { min: 609350, max: Infinity, rate: 0.37 },
];

function estimateIncomeTax(taxableIncome) {
  let tax = 0;
  for (const bracket of TAX_BRACKETS_SINGLE) {
    if (taxableIncome <= bracket.min) break;
    const taxed = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxed * bracket.rate;
  }
  return tax;
}

const CATEGORY_ICONS = {
  fuel: Car, vehicle: Car, home_office: Home, phone_internet: Phone,
  meals: Utensils, equipment: Briefcase, supplies: Briefcase,
  insurance: Shield, professional_services: Briefcase,
};

const WRITEOFF_TIPS = [
  { icon: Car,      title: "Vehicle & Mileage",    tip: "Track every business mile at $0.67/mile (2024 IRS rate). Keep a mileage log — it's one of the biggest 1099 deductions." },
  { icon: Home,     title: "Home Office",           tip: "If you use part of your home exclusively for work, deduct $5/sq ft (up to 300 sq ft) or the actual expense ratio." },
  { icon: Phone,    title: "Phone & Internet",      tip: "Deduct the business-use percentage of your monthly bill. 80% business use = 80% deductible." },
  { icon: Utensils, title: "Business Meals",        tip: "50% of meals with clients or while traveling for work are deductible. Keep receipts and note the business purpose." },
  { icon: Shield,   title: "Health Insurance",      tip: "Self-employed individuals can deduct 100% of health insurance premiums paid for yourself and family." },
  { icon: Briefcase,title: "Retirement Accounts",  tip: "Contribute to a SEP-IRA (up to 25% of net earnings) or Solo 401(k) to reduce taxable income significantly." },
];

const QUARTERS = [
  { label: "Q1 (Jan–Mar)", months: [0,1,2],   due: "Apr 15" },
  { label: "Q2 (Apr–May)", months: [3,4],      due: "Jun 15" },
  { label: "Q3 (Jun–Aug)", months: [5,6,7],    due: "Sep 15" },
  { label: "Q4 (Sep–Dec)", months: [8,9,10,11],due: "Jan 15" },
];

export default function TaxCenter({ isActive = true }) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [taxYear, setTaxYear] = useState(String(currentYear));
  const [expandedTip, setExpandedTip] = useState(null);

  const { data: [invoices, expenses], loading, error, reload } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 500] },
    { entity: "Expense", method: "list", args: ["-date", 500] },
  ], { enabled: isActive });

  const yr = parseInt(taxYear);

  // ── Revenue for the tax year ─────────────────────────────────────────
  const grossIncome = useMemo(() =>
    invoices
      .filter(inv => inv.status === "paid" && getDateYear(inv.created_date) === yr)
      .reduce((s, inv) => s + (inv.total || 0), 0),
  [invoices, yr]);

  // ── Expenses for the tax year ────────────────────────────────────────
  const yearExpenses = useMemo(() =>
    expenses.filter(exp => getDateYear(exp.date) === yr),
  [expenses, yr]);

  // Deductible expenses (marked or all business expenses)
  const deductibleExpenses = yearExpenses.filter(e => e.is_tax_deductible !== false);
  const totalDeductions = deductibleExpenses.reduce((s, e) => {
    const pct = (e.business_use_percent || 100) / 100;
    return s + (e.amount || 0) * pct;
  }, 0);

  // Mileage deduction
  const totalMiles = yearExpenses.reduce((s, e) => s + (e.mileage_miles || 0), 0);
  const mileageDeduction = totalMiles * MILEAGE_RATE;

  const allDeductions = totalDeductions + mileageDeduction;
  const netProfit = Math.max(0, grossIncome - allDeductions);

  // SE tax: 15.3% of 92.35% of net
  const seTax = netProfit * 0.9235 * SE_TAX_RATE;
  const seDeduction = seTax * SE_DEDUCTIBLE_RATE;
  const taxableIncome = Math.max(0, netProfit - seDeduction);
  const incomeTax = estimateIncomeTax(taxableIncome);
  const totalTaxEstimate = seTax + incomeTax;

  // ── Quarterly breakdown ──────────────────────────────────────────────
  const quarterlyIncome = QUARTERS.map(q => {
    const income = invoices
      .filter(inv => inv.status === "paid" && getDateYear(inv.created_date) === yr && q.months.includes(getDateMonth(inv.created_date)))
      .reduce((s, inv) => s + (inv.total || 0), 0);
    return { ...q, income, estimated_tax: income * 0.25 };
  });

  // ── Deductions by category ───────────────────────────────────────────
  const byCategory = useMemo(() => {
    const map = {};
    deductibleExpenses.forEach(e => {
      const cat = e.category || "other";
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      const pct = (e.business_use_percent || 100) / 100;
      map[cat].count++;
      map[cat].total += (e.amount || 0) * pct;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [deductibleExpenses]);

  // ── Non-deductible expenses (opportunity to tag) ─────────────────────
  const untaggedCount = yearExpenses.filter(e => e.is_tax_deductible === false).length;

  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  if (!isActive && !invoices.length) return null;
  if (loading && !invoices.length) return <PageLoader variant="list" label="Loading tax center" />;
  if (error) return <ErrorState title="Couldn't load tax data" onRetry={reload} />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">1099 Tax Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Self-employment tax prep &amp; write-offs</p>
        </div>
        <NativeSelect
          value={taxYear}
          onValueChange={setTaxYear}
          placeholder="Year"
          options={years.map(y => ({ value: y, label: y }))}
          className="w-28 bg-[#1A1A1C] border-border"
        />
      </div>

      <button
        type="button"
        onClick={() => navigate("/receipts")}
        className="mt-4 w-full glass rounded-2xl p-4 border border-border flex items-center gap-3 text-left glass-hover"
      >
        <div className="w-10 h-10 rounded-xl bg-titan-cyan/10 flex items-center justify-center">
          <ScanLine className="w-5 h-5 text-titan-cyan" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Scan receipt for write-off</p>
          <p className="text-xs text-muted-foreground">OCR → deductible business expense</p>
        </div>
      </button>

      {/* ── Tax Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 mb-8">
        {[
          { label: "Gross Income",     value: grossIncome,      color: "text-emerald-400", bg: "bg-emerald-400/10",  icon: DollarSign },
          { label: "Total Write-offs", value: allDeductions,    color: "text-titan-cyan",  bg: "bg-titan-cyan/10",   icon: TrendingDown },
          { label: "Net Taxable",      value: taxableIncome,    color: "text-titan-amber", bg: "bg-titan-amber/10",  icon: FileText },
          { label: "Est. Tax Owed",    value: totalTaxEstimate, color: "text-red-400",     bg: "bg-red-400/10",      icon: Calculator },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="glass rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.bg}`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-xl md:text-2xl font-bold text-foreground tabular-nums">${Math.round(card.value).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      <BusinessExpenses taxYear={yr} onChanged={reload} />

      <div className="grid md:grid-cols-2 gap-6 mb-6">

        {/* ── Tax Breakdown ── */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-titan-cyan" /> Tax Breakdown
          </h3>
          <div className="space-y-3 text-sm">
            {[
              { label: "Gross Income",              value: grossIncome,        color: "text-foreground" },
              { label: `Write-offs & Deductions`,   value: -allDeductions,     color: "text-titan-cyan" },
              { label: "Net Profit",                value: netProfit,          color: "text-foreground", border: true },
              { label: "½ SE Tax Deduction",        value: -seDeduction,       color: "text-titan-cyan" },
              { label: "Taxable Income",            value: taxableIncome,      color: "text-foreground", border: true },
              { label: "Self-Employment Tax (15.3%)",value: seTax,             color: "text-red-400" },
              { label: "Federal Income Tax (est.)", value: incomeTax,          color: "text-red-400" },
              { label: "Total Estimated Tax",       value: totalTaxEstimate,   color: "text-red-400", bold: true, border: true },
            ].map(row => (
              <div key={row.label} className={`flex justify-between items-center py-1 ${row.border ? "border-t border-border pt-3 mt-1" : ""}`}>
                <span className={`text-muted-foreground ${row.bold ? "font-semibold text-foreground/80" : ""}`}>{row.label}</span>
                <span className={`font-semibold tabular-nums ${row.color}`}>
                  {row.value < 0 ? "-" : ""}${Math.abs(Math.round(row.value)).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4">* Estimate only. Consult a tax professional.</p>
        </div>

        {/* ── Deductions by Category ── */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-titan-cyan" /> Write-offs by Category
          </h3>
          {mileageDeduction > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-titan-cyan/10 border border-titan-cyan/20 mb-3 mt-3">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-titan-cyan" />
                <div>
                  <p className="text-sm font-medium text-foreground">Mileage Deduction</p>
                  <p className="text-xs text-muted-foreground">{totalMiles.toLocaleString()} miles × $0.67</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-titan-cyan">${Math.round(mileageDeduction).toLocaleString()}</p>
            </div>
          )}
          {byCategory.length === 0 && mileageDeduction === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-sm text-muted-foreground">No deductible expenses for {taxYear}</p>
              <p className="text-xs text-muted-foreground mt-1">Mark expenses as tax-deductible in Finances</p>
            </div>
          ) : (
            <div className="space-y-2 mt-3">
              {byCategory.map(([cat, { count, total }]) => {
                const Icon = CATEGORY_ICONS[cat] || Briefcase;
                const pct = allDeductions > 0 ? (total / allDeductions) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-muted-foreground capitalize">{cat.replace(/_/g, " ")} ({count})</span>
                        <span className="text-xs font-semibold text-foreground">${Math.round(total).toLocaleString()}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-titan-cyan/60 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {untaggedCount > 0 && (
            <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-titan-amber/10 border border-titan-amber/20">
              <AlertCircle className="w-4 h-4 text-titan-amber mt-0.5 flex-shrink-0" />
              <p className="text-xs text-titan-amber/90">
                <strong>{untaggedCount} expense{untaggedCount !== 1 ? "s" : ""}</strong> not marked as tax-deductible. Review in Finances to maximize write-offs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Quarterly Estimated Taxes ── */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-titan-cyan" /> Quarterly Estimated Tax Schedule
        </h3>
        <p className="text-xs text-muted-foreground mb-4">As a 1099 worker, pay estimated taxes each quarter to avoid penalties.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quarterlyIncome.map((q, i) => {
            const now = new Date();
            const currentQuarterIndex = QUARTERS.findIndex((_, qi) =>
              QUARTERS[qi].months.includes(getDateMonth(now)) && getDateYear(now) === yr
            );
            const isPast = i < currentQuarterIndex;
            return (
              <div key={q.label} className={`rounded-xl p-4 border ${isPast ? "bg-white/[0.02] border-border" : "bg-titan-cyan/5 border-titan-cyan/20"}`}>
                <p className="text-xs text-muted-foreground mb-1">{q.label}</p>
                <p className="text-sm font-semibold text-foreground tabular-nums">${Math.round(q.estimated_tax).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Income: ${Math.round(q.income).toLocaleString()}</p>
                <p className={`text-xs mt-2 font-medium ${isPast ? "text-muted-foreground" : "text-titan-amber"}`}>Due {q.due}</p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">* Estimated at ~25% of quarterly income. Actual amount depends on deductions and filing status.</p>
      </div>

      {/* ── Mile Tracker ── */}
      <MileTracker taxYear={yr} />

      {/* ── Tax Advantages ── */}
      <div className="glass rounded-2xl p-6 mt-6">
        <h3 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-titan-amber" /> 1099 Tax Advantages
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Your personalized deductions based on {taxYear} data.</p>

        {/* Personalized insight rows */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-titan-amber/10 flex items-center justify-center"><Home className="w-4 h-4 text-titan-amber" /></div>
              <div>
                <p className="text-sm font-medium text-foreground">Home Office</p>
                <p className="text-xs text-muted-foreground">$5/sq ft · up to 300 sq ft = <span className="text-titan-cyan font-semibold">$1,500</span> max deduction</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-titan-amber/10 flex items-center justify-center"><Phone className="w-4 h-4 text-titan-amber" /></div>
              <div>
                <p className="text-sm font-medium text-foreground">Phone & Internet</p>
                <p className="text-xs text-muted-foreground">Log business-use % — 80% use on a <span className="text-foreground">$150/mo</span> plan = <span className="text-titan-cyan font-semibold">${Math.round(150 * 0.8 * 12).toLocaleString()}/yr</span></p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-titan-amber/10 flex items-center justify-center"><Utensils className="w-4 h-4 text-titan-amber" /></div>
              <div>
                <p className="text-sm font-medium text-foreground">Business Meals</p>
                <p className="text-xs text-muted-foreground">50% deductible · add meals in Finances and tag as deductible</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-titan-amber/10 flex items-center justify-center"><Shield className="w-4 h-4 text-titan-amber" /></div>
              <div>
                <p className="text-sm font-medium text-foreground">Health Insurance</p>
                <p className="text-xs text-muted-foreground">100% of premiums deductible — self-employed health insurance is above-the-line</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-titan-amber/10 flex items-center justify-center"><Briefcase className="w-4 h-4 text-titan-amber" /></div>
              <div>
                <p className="text-sm font-medium text-foreground">SEP-IRA / Solo 401(k)</p>
                <p className="text-xs text-muted-foreground">
                  Contribute up to 25% of net earnings — on <span className="text-foreground">${Math.round(netProfit).toLocaleString()}</span> net that's up to{" "}
                  <span className="text-titan-cyan font-semibold">${Math.round(netProfit * 0.25).toLocaleString()}</span> tax-free
                </p>
              </div>
            </div>
          </div>
        </div>

        {totalDeductions === 0 && totalMiles === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-titan-amber/10 border border-titan-amber/20">
            <AlertCircle className="w-4 h-4 text-titan-amber mt-0.5 flex-shrink-0" />
            <p className="text-xs text-titan-amber/90">
              No deductions logged yet for {taxYear}. Add expenses in Finances and log trips above to see your real tax savings.
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4">* Always consult a tax professional for your specific situation.</p>
      </div>
    </div>
  );
}