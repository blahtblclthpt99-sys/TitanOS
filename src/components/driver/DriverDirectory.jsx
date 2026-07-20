import React, { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  Heart,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/shared/EmptyState";
import FilterChip from "@/components/shared/FilterChip";
import NativeSelect from "@/components/shared/NativeSelect";
import DriverCard from "@/components/driver/DriverCard";
import HireRequestDialog from "@/components/driver/HireRequestDialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  AVAILABILITY_FILTERS,
  COLLECTION_FILTERS,
  DISTANCE_FILTERS,
  LICENSE_FILTERS,
  RATING_FILTERS,
  ROUTE_FILTERS,
  SORT_OPTIONS,
  TRUST_FILTERS,
  VEHICLE_FILTERS,
  filterDrivers,
  listDrivers,
  sortDrivers,
} from "@/lib/driverDirectoryApi";
import {
  listFavoriteDriverIds,
  listSavedDriverIds,
  toggleFavoriteDriver,
  toggleSavedDriver,
} from "@/lib/driverFavoritesApi";

function FilterGroup({ title, children }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function DriverDirectory({ initialQuery = "" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id || null;

  const [query, setQuery] = useState(initialQuery);
  const [sortBy, setSortBy] = useState("rating");
  const [collection, setCollection] = useState("all");
  const [availability, setAvailability] = useState("any");
  const [minRating, setMinRating] = useState(0);
  const [maxDistance, setMaxDistance] = useState(null);
  const [trust, setTrust] = useState("any");
  const [license, setLicense] = useState([]);
  const [vehicle, setVehicle] = useState([]);
  const [route, setRoute] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => listFavoriteDriverIds(userId));
  const [savedIds, setSavedIds] = useState(() => listSavedDriverIds(userId));
  const [hireTarget, setHireTarget] = useState(null);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setFavoriteIds(listFavoriteDriverIds(userId));
    setSavedIds(listSavedDriverIds(userId));
  }, [userId]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setShowFilters(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const all = useMemo(() => listDrivers(), []);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const results = useMemo(() => {
    let availabilityFilter = availability;
    let collectionIds = null;

    if (collection === "available") {
      availabilityFilter = "available";
    } else if (collection === "favorites") {
      collectionIds = favoriteSet;
    } else if (collection === "saved") {
      collectionIds = savedSet;
    }

    const filtered = filterDrivers(all, {
      query,
      filters: { license, vehicle, route },
      availability: availabilityFilter,
      minRating,
      maxDistance,
      trust,
      collectionIds,
    });
    return sortDrivers(filtered, sortBy);
  }, [
    all,
    query,
    license,
    vehicle,
    route,
    availability,
    minRating,
    maxDistance,
    trust,
    sortBy,
    collection,
    favoriteSet,
    savedSet,
  ]);

  const toggleTag = (setList, id) => {
    setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearFilters = () => {
    setLicense([]);
    setVehicle([]);
    setRoute([]);
    setAvailability("any");
    setMinRating(0);
    setMaxDistance(null);
    setTrust("any");
    setQuery("");
    setSortBy("rating");
    setCollection("all");
  };

  const activeFilterCount =
    license.length +
    vehicle.length +
    route.length +
    (availability !== "any" && collection !== "available" ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (maxDistance != null ? 1 : 0) +
    (trust !== "any" ? 1 : 0);

  const handleFavorite = (driver) => {
    const next = toggleFavoriteDriver(userId, driver.id);
    setFavoriteIds(listFavoriteDriverIds(userId));
    toast({
      title: next ? `Favorited ${driver.name}` : `Removed ${driver.name} from favorites`,
    });
  };

  const handleSaved = (driver) => {
    const next = toggleSavedDriver(userId, driver.id);
    setSavedIds(listSavedDriverIds(userId));
    toast({
      title: next ? `Saved ${driver.name}` : `Removed ${driver.name} from saved`,
    });
  };

  const openHire = (driver) => {
    if (!user?.id) {
      toast({ title: "Sign in to request a driver", variant: "destructive" });
      navigate("/login");
      return;
    }
    setHireTarget(driver);
  };

  const emptyCopy =
    collection === "favorites"
      ? {
          title: "No favorite drivers yet",
          description: "Tap the heart on a driver card to build your shortlist.",
        }
      : collection === "saved"
        ? {
            title: "No saved drivers yet",
            description: "Bookmark drivers you want to hire later.",
          }
        : {
            title: "No drivers match",
            description: "Try clearing filters, widening distance, or posting a haul job.",
          };

  return (
    <div className="space-y-4">
      {/* Trust strip */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-3 sm:items-center">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary sm:mt-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Verified drivers you can hire with confidence</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Check ID, insurance, ratings, and vehicle details before you request. Favorites and saved lists stay on this
            device.
          </p>
        </div>
      </div>

      {/* Sticky search toolbar */}
      <div className="sticky top-0 z-10 -mx-1 space-y-3 rounded-lg bg-background/95 px-1 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, city, skill, vehicle…"
              className="h-11 pl-9 pr-9"
              aria-label="Search drivers"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted focus-ring"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <NativeSelect
              value={sortBy}
              onValueChange={setSortBy}
              placeholder="Sort by"
              aria-label="Sort drivers"
              className="min-w-[9.5rem] flex-1 sm:flex-none sm:min-w-[11rem]"
              options={SORT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
            />
            <Button
              type="button"
              variant={showFilters ? "default" : "outline"}
              className="min-h-[44px] flex-shrink-0 lg:hidden"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">Filters</span>
              {activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>
        </div>

        {/* Collection filters */}
        <div
          className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Driver collections"
        >
          {COLLECTION_FILTERS.map((c) => {
            const active = collection === c.id;
            const count =
              c.id === "favorites"
                ? favoriteIds.length
                : c.id === "saved"
                  ? savedIds.length
                  : null;
            return (
              <FilterChip key={c.id} active={active} onClick={() => setCollection(c.id)} className="gap-1.5">
                {c.id === "favorites" ? <Heart className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {c.id === "saved" ? <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {c.label}
                {count != null ? (
                  <span className="tabular-nums opacity-80">({count})</span>
                ) : null}
              </FilterChip>
            );
          })}
        </div>
      </div>

      {showFilters && (
        <div className="titan-surface space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Filters</p>
            <div className="flex items-center gap-3">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-md px-1 text-xs font-semibold text-primary hover:underline focus-ring"
                >
                  Clear all
                </button>
              )}
              <button
                type="button"
                className="rounded-md px-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-ring lg:hidden"
                onClick={() => setShowFilters(false)}
              >
                Done
              </button>
            </div>
          </div>

          <FilterGroup title="License">
            {LICENSE_FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                active={license.includes(f.id)}
                onClick={() => toggleTag(setLicense, f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Vehicle type">
            {VEHICLE_FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                active={vehicle.includes(f.id)}
                onClick={() => toggleTag(setVehicle, f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Route">
            {ROUTE_FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                active={route.includes(f.id)}
                onClick={() => toggleTag(setRoute, f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Availability">
            {AVAILABILITY_FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                active={availability === f.id}
                onClick={() => setAvailability(f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Distance">
            {DISTANCE_FILTERS.map((f) => (
              <FilterChip
                key={String(f.id)}
                active={maxDistance === f.id}
                onClick={() => setMaxDistance(f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Rating">
            {RATING_FILTERS.map((f) => (
              <FilterChip
                key={f.id}
                active={minRating === f.id}
                onClick={() => setMinRating(f.id)}
              >
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup title="Trust">
            {TRUST_FILTERS.map((f) => (
              <FilterChip key={f.id} active={trust === f.id} onClick={() => setTrust(f.id)}>
                {f.label}
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      )}

      {!showFilters && activeFilterCount > 0 && (
        <p className="text-xs text-muted-foreground lg:hidden">
          {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""} active — open Filters to edit
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{results.length}</span> driver
          {results.length !== 1 ? "s" : ""}
          {query ? ` matching “${query}”` : ""}
          {activeFilterCount > 0 ? " · filtered" : ""}
        </p>
        {(favoriteIds.length > 0 || savedIds.length > 0) && collection === "all" && (
          <p className="text-[11px] text-muted-foreground">
            {favoriteIds.length} favorite · {savedIds.length} saved
          </p>
        )}
      </div>

      {results.length === 0 ? (
        <div className="titan-surface px-6 py-10 text-center">
          <EmptyState
            title={emptyCopy.title}
            description={emptyCopy.description}
            onAction={
              collection === "favorites" || collection === "saved"
                ? () => setCollection("all")
                : clearFilters
            }
            actionLabel={
              collection === "favorites" || collection === "saved" ? "Browse all drivers" : "Clear filters"
            }
          />
          {collection === "all" && (
            <Button type="button" className="mt-2" onClick={() => navigate("/hire?new=1")}>
              Post a haul job
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              favorite={favoriteSet.has(driver.id)}
              saved={savedSet.has(driver.id)}
              onToggleFavorite={handleFavorite}
              onToggleSaved={handleSaved}
              onMessage={() => {
                navigate(
                  `/messages?to=${encodeURIComponent(driver.id)}&name=${encodeURIComponent(driver.name)}`
                );
              }}
              onHire={openHire}
            />
          ))}
        </div>
      )}

      <HireRequestDialog
        driver={hireTarget}
        open={!!hireTarget}
        onOpenChange={(open) => !open && setHireTarget(null)}
      />
    </div>
  );
}
