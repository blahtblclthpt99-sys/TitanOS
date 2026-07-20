import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Bookmark,
  Briefcase,
  Clock,
  Heart,
  IdCard,
  MapPin,
  MessageSquare,
  Shield,
  Star,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import OptimizedImage from "@/components/shared/OptimizedImage";
import ReportBlockMenu from "@/components/shared/ReportBlockMenu";
import HireRequestDialog from "@/components/driver/HireRequestDialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { normalizeAppPath } from "@/lib/routing";
import {
  availabilityClass,
  availabilityDotClass,
  availabilityLabel,
  formatDriverRate,
  formatVehicleSpecs,
  formatVehicleSummary,
  getDriverById,
  verificationStatusClass,
  verificationStatusLabel,
} from "@/lib/driverDirectoryApi";
import {
  isFavoriteDriver,
  isSavedDriver,
  toggleFavoriteDriver,
  toggleSavedDriver,
} from "@/lib/driverFavoritesApi";
import { computeDriverTitanScore, isTitanVerified, TITAN_SCORE_FACTORS } from "@/lib/titanScore";
import TitanVerifiedBadge from "@/components/shared/TitanVerifiedBadge";
import TitanScoreBadge from "@/components/shared/TitanScoreBadge";
import { cn } from "@/lib/utils";

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-center">
      {Icon ? <Icon className="mx-auto mb-1 h-4 w-4 text-primary" aria-hidden="true" /> : null}
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Stars({ rating }) {
  const n = Math.round(Number(rating) || 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < n ? "fill-warning text-warning" : "text-muted-foreground/40"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function DriverProfile() {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;

  const id = useMemo(() => {
    if (paramId) return paramId;
    const path = normalizeAppPath(location.pathname);
    const parts = path.split("/").filter(Boolean);
    return parts[0] === "driver" && parts[1] ? parts[1] : null;
  }, [paramId, location.pathname]);

  const driver = useMemo(() => getDriverById(id), [id]);
  const titanScore = useMemo(() => (driver ? computeDriverTitanScore(driver) : null), [driver]);
  const titanVerified = driver ? isTitanVerified({ driver }) : false;
  const vehicleSpecs = useMemo(() => (driver ? formatVehicleSpecs(driver) : []), [driver]);

  const [favorite, setFavorite] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);

  useEffect(() => {
    if (!driver) return;
    setFavorite(isFavoriteDriver(userId, driver.id));
    setSaved(isSavedDriver(userId, driver.id));
  }, [driver, userId]);

  if (!driver) {
    return (
      <PageShell maxWidth="md" className="space-y-4">
        <PageHeader title="Driver not found" eyebrow="Driver Hub" />
        <p className="text-sm text-muted-foreground">This driver profile isn’t in the directory.</p>
        <Button asChild variant="outline">
          <Link to="/driver?tab=directory">Back to Find Drivers</Link>
        </Button>
      </PageShell>
    );
  }

  const toggleFav = () => {
    const next = toggleFavoriteDriver(userId, driver.id);
    setFavorite(next);
    toast({ title: next ? `Favorited ${driver.name}` : `Removed from favorites` });
  };

  const toggleSave = () => {
    const next = toggleSavedDriver(userId, driver.id);
    setSaved(next);
    toast({ title: next ? `Saved ${driver.name}` : `Removed from saved` });
  };

  const openHire = () => {
    if (!user?.id) {
      toast({ title: "Sign in to request a driver", variant: "destructive" });
      navigate("/login");
      return;
    }
    setHireOpen(true);
  };

  const messageDriver = () => {
    navigate(
      `/messages?to=${encodeURIComponent(driver.id)}&name=${encodeURIComponent(driver.name)}`
    );
  };

  return (
    <PageShell maxWidth="md" className="space-y-5 pb-28 md:pb-10">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" className="min-h-[44px] gap-2 px-2" asChild>
          <Link to="/driver?tab=directory">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Find Drivers
          </Link>
        </Button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFav}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-ring",
              favorite
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={favorite}
          >
            <Heart className={cn("h-4 w-4", favorite && "fill-current")} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleSave}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-ring",
              saved
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-label={saved ? "Remove from saved" : "Save driver"}
            aria-pressed={saved}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
          </button>
          <ReportBlockMenu targetId={driver.id} targetName={driver.name} link={`/driver/${driver.id}`} />
        </div>
      </div>

      {/* Hero identity */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="relative mx-auto flex-shrink-0 sm:mx-0">
            <OptimizedImage
              src={driver.photo}
              alt={`${driver.name} profile photo`}
              width={112}
              height={112}
              className="h-28 w-28 rounded-full object-cover ring-2 ring-border"
            />
            <span
              className={cn(
                "absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full ring-2 ring-card",
                availabilityDotClass(driver.availability)
              )}
              title={availabilityLabel(driver.availability)}
              aria-hidden="true"
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{driver.name}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
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
              {titanScore ? (
                <TitanScoreBadge
                  score={titanScore.score}
                  grade={titanScore.grade}
                  href={null}
                  asLink={false}
                  size="sm"
                />
              ) : null}
            </div>

            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted-foreground sm:justify-start">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {driver.city}
              {driver.distanceMi ? ` · ${Number(driver.distanceMi).toFixed(1)} mi away` : ""}
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Star className="h-4 w-4 fill-warning text-warning" aria-hidden="true" />
                {Number(driver.rating).toFixed(1)}
                <span className="font-normal text-muted-foreground">
                  ({driver.reviewCount} reviews)
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Responds in ~{driver.responseTimeMin} min
              </span>
            </div>

            <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
              {formatDriverRate(driver)}
            </p>

            {driver.bio ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{driver.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="hidden gap-2 border-t border-border p-3 sm:flex">
          <Button type="button" variant="outline" className="min-h-[44px] flex-1" onClick={messageDriver}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Message
          </Button>
          <Button type="button" className="min-h-[44px] flex-1" onClick={openHire}>
            Request driver
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Completed jobs" value={driver.completedJobs} icon={Briefcase} />
        <Stat
          label="Experience"
          value={`${driver.yearsExperience} yr${driver.yearsExperience === 1 ? "" : "s"}`}
          icon={Award}
        />
        <Stat label="License" value={driver.licenseType} icon={IdCard} />
        <Stat label="Vehicle" value={driver.vehicleType} icon={Truck} />
      </div>

      {titanScore && (
        <section className="titan-surface space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Titan Score</h2>
            <span className="text-lg font-bold tabular-nums text-primary">
              {titanScore.score}{" "}
              <span className="text-xs font-semibold text-muted-foreground">{titanScore.grade}</span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TITAN_SCORE_FACTORS.map((f) => (
              <div key={f.id} className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {f.label}
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                  {titanScore.factors[f.id] ?? 0}
                  <span className="text-[10px] font-medium text-muted-foreground">/{f.max}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="titan-surface space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Verification & trust</h2>
        <div className="flex flex-wrap gap-2">
          {titanVerified ? <TitanVerifiedBadge size="md" /> : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold ${verificationStatusClass(
              driver.verificationStatus
            )}`}
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {verificationStatusLabel(driver.verificationStatus)}
          </span>
          {driver.insured && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs font-semibold text-success">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Insured
            </span>
          )}
          {driver.backgroundChecked && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground">
              Background check passed
            </span>
          )}
        </div>
      </section>

      {/* Vehicle */}
      <section className="titan-surface space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Vehicle</h2>
        </div>
        <p className="text-base font-semibold text-foreground">{formatVehicleSummary(driver)}</p>
        {vehicleSpecs.length ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {vehicleSpecs.map((s) => (
              <div
                key={s.label}
                className="flex justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5"
              >
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="text-sm font-medium text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>

      <section className="titan-surface space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Skills</h2>
        {driver.skills?.length ? (
          <div className="flex flex-wrap gap-2">
            {driver.skills.map((s) => (
              <span
                key={s}
                className="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No skills listed yet.</p>
        )}
      </section>

      <section className="titan-surface space-y-3 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Certifications</h2>
        {driver.certifications?.length ? (
          <ul className="space-y-2">
            {driver.certifications.map((c) => (
              <li key={c} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
                <Award className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No certifications listed yet.</p>
        )}
      </section>

      <section className="titan-surface space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Reviews</h2>
          <span className="text-xs text-muted-foreground">
            {driver.reviewCount} total · {Number(driver.rating).toFixed(1)} avg
          </span>
        </div>
        {driver.reviews?.length ? (
          <ul className="space-y-3">
            {driver.reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-muted/20 p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{r.author}</p>
                  <Stars rating={r.rating} />
                </div>
                {r.job_type ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.job_type}</p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                {r.created_at ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        )}
      </section>

      {/* Mobile sticky CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-md gap-2">
          <Button type="button" variant="outline" className="min-h-[48px] flex-1" onClick={messageDriver}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Message
          </Button>
          <Button type="button" className="min-h-[48px] flex-1" onClick={openHire}>
            Request driver
          </Button>
        </div>
      </div>

      <HireRequestDialog driver={driver} open={hireOpen} onOpenChange={setHireOpen} />
    </PageShell>
  );
}
