import React, { memo } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck,
  Bookmark,
  Briefcase,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  Shield,
  Star,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  availabilityClass,
  availabilityDotClass,
  availabilityLabel,
  formatDriverRate,
  formatVehicleSummary,
} from "@/lib/driverDirectoryApi";
import OptimizedImage from "@/components/shared/OptimizedImage";
import ReportBlockMenu from "@/components/shared/ReportBlockMenu";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import TitanScoreBadge from "@/components/shared/TitanScoreBadge";
import { computeDriverTitanScore, isTitanVerified } from "@/lib/titanScore";
import { cn } from "@/lib/utils";

function TrustPills({ driver, titanVerified }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {driver.verified && (
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          <BadgeCheck className="h-3 w-3" aria-hidden="true" /> ID verified
        </span>
      )}
      {driver.insured && (
        <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
          <Shield className="h-3 w-3" aria-hidden="true" /> Insured
        </span>
      )}
      {driver.backgroundChecked && (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-semibold text-foreground">
          Background check
        </span>
      )}
      {titanVerified && !driver.verified ? (
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
          Titan Verified
        </span>
      ) : null}
    </div>
  );
}

export default memo(function DriverCard({
  driver,
  onMessage,
  onHire,
  favorite = false,
  saved = false,
  onToggleFavorite,
  onToggleSaved,
}) {
  if (!driver) return null;

  const profilePath = `/driver/${driver.id}`;
  const titanScore = computeDriverTitanScore(driver);
  const titanVerified = isTitanVerified({ driver });
  const vehicleLine = formatVehicleSummary(driver);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        "shadow-soft titan-surface-interactive transition-[box-shadow,transform,border-color] duration-base",
        "hover:shadow-lift hover:border-primary/20"
      )}
    >
      <div className="relative flex gap-3 p-4 pb-3">
        <Link
          to={profilePath}
          className="relative flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <OptimizedImage
            src={driver.photo}
            alt=""
            width={72}
            height={72}
            className="h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-2 ring-border"
          />
          <span
            className={cn(
              "absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full ring-2 ring-card",
              availabilityDotClass(driver.availability)
            )}
            title={availabilityLabel(driver.availability)}
            aria-hidden="true"
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
                <Link to={profilePath} className="hover:underline focus-visible:underline">
                  {driver.name}
                </Link>
              </h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {driver.city}
                  {driver.distanceMi != null ? ` · ${Number(driver.distanceMi).toFixed(1)} mi` : ""}
                </span>
              </p>
            </div>

            <div className="flex flex-shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite?.(driver);
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-ring",
                  favorite
                    ? "text-destructive bg-destructive/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={favorite}
              >
                <Heart className={cn("h-4 w-4", favorite && "fill-current")} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleSaved?.(driver);
                }}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-ring",
                  saved
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-label={saved ? "Remove from saved" : "Save driver"}
                aria-pressed={saved}
              >
                <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
              </button>
              <ReportBlockMenu targetId={driver.id} targetName={driver.name} link={profilePath} />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                availabilityClass(driver.availability)
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full", availabilityDotClass(driver.availability))}
                aria-hidden="true"
              />
              {availabilityLabel(driver.availability)}
            </span>
            {titanVerified ? <TitanVerifiedBadge size="sm" /> : null}
            <TitanScoreBadge
              score={titanScore.score}
              grade={titanScore.grade}
              href={profilePath}
              size="sm"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
              {Number(driver.rating).toFixed(1)}
              <span className="font-normal text-muted-foreground">({driver.reviewCount})</span>
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />~{driver.responseTimeMin} min
            </span>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
              {driver.completedJobs} jobs
            </span>
          </div>
        </div>
      </div>

      <div className="mx-4 flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
            <Truck className="h-3.5 w-3.5 flex-shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{vehicleLine}</span>
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {driver.vehicleType} · {driver.licenseClass}
          </p>
        </div>
        <p className="flex-shrink-0 text-lg font-bold tabular-nums tracking-tight text-foreground">
          {formatDriverRate(driver)}
        </p>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        <TrustPills driver={driver} titanVerified={titanVerified} />

        {driver.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {driver.skills.slice(0, 4).map((s) => (
              <span
                key={s}
                className="rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] font-medium text-foreground"
              >
                {s}
              </span>
            ))}
            {driver.skills.length > 4 ? (
              <span className="rounded-md px-2 py-1 text-[11px] text-muted-foreground">
                +{driver.skills.length - 4}
              </span>
            ) : null}
          </div>
        )}

        {driver.bio ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{driver.bio}</p>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-border p-3 sm:flex-row">
        <Button type="button" variant="secondary" className="min-h-[44px] flex-1" asChild>
          <Link to={profilePath}>View profile</Link>
        </Button>
        <div className="flex gap-2 sm:flex-1">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={() => onMessage?.(driver)}
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span className="sm:inline">Message</span>
          </Button>
          <Button type="button" className="min-h-[44px] flex-1" onClick={() => onHire?.(driver)}>
            Request
          </Button>
        </div>
      </div>
    </article>
  );
});
