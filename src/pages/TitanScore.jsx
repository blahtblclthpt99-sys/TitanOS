import React, { useMemo } from "react";
import { Award, BadgeCheck, ChevronRight, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/shared/PageHeader";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import { useEntityData } from "@/hooks/useEntityData";
import { useAuth } from "@/lib/AuthContext";
import {
  TITAN_SCORE_FACTORS,
  computeTitanScore,
  isTitanVerified,
  verificationLevelFromTrust,
} from "@/lib/titanScore";
import { getLocalTrustState } from "@/lib/trustSafetyApi";
import { isOwnerAccount } from "@/lib/ownerAccount";

export default function TitanScore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const owner = isOwnerAccount(user);
  const { data: [invoices, jobs, customers, estimates, reviews] } = useEntityData([
    { entity: "Invoice", method: "list", args: ["-created_date", 200] },
    { entity: "Job", method: "list", args: ["-created_date", 200] },
    { entity: "Customer", method: "list", args: ["-created_date", 200] },
    { entity: "Estimate", method: "list", args: ["-created_date", 200] },
    { entity: "JobReview", method: "list", args: ["-created_date", 100] },
  ]);

  const trustState = useMemo(() => (user?.id ? getLocalTrustState(user.id) : null), [user?.id]);
  const verificationLevel = verificationLevelFromTrust(trustState);
  const titanVerified = isTitanVerified({
    verifiedWorker: Boolean(user?.verified_worker) || owner,
    trustState,
  });

  const result = computeTitanScore({
    invoices,
    jobs,
    customers,
    estimates,
    reviews,
    verificationLevel,
    yearsExperience: user?.years_experience != null ? Number(user.years_experience) : null,
  });

  return (
    <div className="page-pad mx-auto max-w-5xl pb-28">
      <PageHeader
        title="Titan Score"
        subtitle="Activity score from your jobs, invoices, customers, estimates, and reviews"
      />

      <FeatureHonestyBanner tone="info">
        This score is calculated from your TitanOS records — not a third-party credit or background check.
        {owner
          ? " Founder accounts use the same real activity score as everyone else."
          : " “Verified” level stays limited until Trust & Safety identity providers go live."}
      </FeatureHonestyBanner>

      <div className="titan-surface mb-5 flex flex-col items-center gap-6 border border-primary/20 p-6 sm:flex-row md:p-8">
        <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border-4 border-primary bg-primary/10 shadow-lift">
          <p className="text-4xl font-bold text-foreground">{result.score}</p>
          <p className="text-sm font-semibold text-primary">{result.grade}</p>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <Award className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-xl font-bold text-foreground">Titan Trust Score</h2>
            {titanVerified ? <TitanVerifiedBadge size="sm" /> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {owner
              ? "Platform founder — score reflects your real jobs, invoices, and reviews."
              : "Six factors from your account activity. Improve it by completing jobs, collecting reviews, and keeping invoices current."}
          </p>
          <p className="mt-3 text-sm text-foreground">
            {`${result.stats.completedJobs} jobs done · ${result.stats.reviewAvg}★ avg${
              result.stats.reviewCount ? ` (${result.stats.reviewCount})` : ""
            } · ${Math.round(verificationLevel * 100)}% profile completeness`}
          </p>
          {!titanVerified && (
            <Link
              to="/settings"
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
              Complete your profile in Settings
            </Link>
          )}
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TITAN_SCORE_FACTORS.map((f) => {
          const pts = result.factors[f.id] ?? 0;
          const pct = Math.round((pts / f.max) * 100);
          return (
            <div key={f.id} className="titan-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </p>
                <p className="text-lg font-bold tabular-nums text-foreground">
                  {pts}
                  <span className="text-xs font-medium text-muted-foreground">/{f.max}</span>
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <section className="titan-surface mb-5 space-y-3 p-5">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <BadgeCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          Titan Verified
        </h3>
        <p className="text-sm text-muted-foreground">
          {titanVerified
            ? "Your identity and trust checks are complete. The Titan Verified badge appears on your profile, booking page, and listings."
            : "Verify your ID plus email/phone or insurance in Trust & Safety to unlock the Titan Verified badge across TitanOS."}
        </p>
        <button
          type="button"
          onClick={() => navigate("/trust-safety")}
          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md bg-muted/60 px-4 py-3 text-left text-sm text-foreground hover:bg-muted"
        >
          <span>{titanVerified ? "Manage verification" : "Open Trust & Safety"}</span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </button>
      </section>

      <section className="titan-surface p-5">
        <h3 className="mb-3 font-semibold text-foreground">How to improve</h3>
        <div className="space-y-2">
          {result.tips.map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => {
                const t = tip.toLowerCase();
                let path = "/profile";
                if (t.includes("verif") || t.includes("trust")) path = "/trust-safety";
                else if (t.includes("invoice") || t.includes("overdue")) path = "/invoices";
                else if (t.includes("job") || t.includes("finish") || t.includes("completed work")) path = "/jobs";
                else if (t.includes("review")) path = "/reputation";
                else if (t.includes("message") || t.includes("reply") || t.includes("response")) path = "/messages";
                navigate(path);
              }}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md bg-muted/60 px-4 py-3 text-left text-sm text-foreground hover:bg-muted"
            >
              <span>{tip}</span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
