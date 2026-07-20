import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Star,
  Download,
  Zap,
  Shield,
  Clock,
  Search,
  Check,
  Bell,
  Loader2,
  ExternalLink,
  PackageCheck,
  Trash2,
  Sparkles,
  LayoutGrid,
  Thermometer,
  Home,
  Bug,
  Calculator,
  Package,
  Bot,
  BarChart3,
  Code2,
  ArrowRight,
  Gift,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useAuth } from "@/lib/AuthContext";
import {
  MARKETPLACE_CATEGORIES,
  formatInstallCount,
  formatModulePrice,
} from "@/lib/marketplaceCatalog";
import {
  fetchMarketplaceModules,
  fetchUserInstalls,
  fetchUserWaitlist,
  installModule,
  uninstallModule,
  joinWaitlist,
  submitDeveloperApplication,
} from "@/lib/marketplaceApi";

const CATEGORY_ICONS = {
  All: LayoutGrid,
  HVAC: Thermometer,
  Cleaning: Sparkles,
  Roofing: Home,
  "Pest Control": Bug,
  Accounting: Calculator,
  Inventory: Package,
  "AI Agents": Bot,
  Reports: BarChart3,
};

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-titan-cyan/8 blur-[100px]" />
      <div className="absolute top-1/3 -left-24 w-72 h-72 rounded-full bg-titan-indigo/10 blur-[90px]" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-titan-amber/5 blur-[110px]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  );
}

function StarRating({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-2.5 h-2.5 ${
            i < Math.floor(rating)
              ? "text-titan-amber fill-titan-amber"
              : i < rating
                ? "text-titan-amber fill-titan-amber/40"
                : "text-muted-foreground"
          }`}
        />
      ))}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, accent }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`glass rounded-2xl px-5 py-3 border ${accent} min-w-[110px]`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-muted-foreground text-[10px] uppercase tracking-wider font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </motion.div>
  );
}

function ModuleCard({ module, index, isInstalled, isOnWaitlist, onView }) {
  const priceLabel = module.status === "coming_soon" ? "Soon" : formatModulePrice(module);
  const isFree = module.price === 0 && module.status !== "coming_soon";
  const reduceMotion = useReducedMotion();
  const open = () => onView(module);

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.96 }}
      transition={reduceMotion ? { duration: 0 } : { delay: index * 0.05, duration: 0.35 }}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.2 } }}
      role="button"
      tabIndex={0}
      aria-label={`View ${module.name}${isInstalled ? " (installed)" : ""}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={`group relative rounded-2xl p-5 cursor-pointer overflow-hidden bg-gradient-to-br ${module.gradient} border transition-all duration-300 focus-ring ${
        isInstalled
          ? "border-titan-green/30 ring-1 ring-titan-green/20 shadow-[0_0_30px_rgba(34,197,94,0.08)]"
          : "border-border hover:border-border hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      }`}
    >
      <div className="absolute inset-0 glass opacity-80 group-hover:opacity-90 transition-opacity" />
      <div className="absolute top-0 right-0 w-32 h-32 bg-muted rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-muted transition-colors" />

      {isInstalled && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-titan-green/20 border border-titan-green/30">
          <PackageCheck className="w-3 h-3 text-titan-green" />
          <span className="text-[10px] font-semibold text-titan-green">Active</span>
        </div>
      )}

      <div className="relative z-10">
        <div className="flex items-start gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-black/20 border border-border flex items-center justify-center text-2xl shadow-inner group-hover:scale-105 transition-transform duration-300">
              {module.icon}
            </div>
            {module.verified && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-titan-cyan/20 border border-titan-cyan/40 flex items-center justify-center">
                <Shield className="w-2.5 h-2.5 text-titan-cyan" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-semibold text-foreground truncate pr-14">{module.name}</p>
            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
              {module.category}
            </span>
          </div>
        </div>

        <p className="text-xs text-foreground/45 leading-relaxed mb-4 line-clamp-2 min-h-[2.5rem]">
          {module.description}
        </p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {module.features.slice(0, 2).map((feature) => (
            <span
              key={feature}
              className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border"
            >
              {feature}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <StarRating rating={module.rating} />
              <span className="text-[10px] text-muted-foreground">{module.rating} · {formatInstallCount(module.install_count)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isFree && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-titan-green/15 text-titan-green font-semibold border border-titan-green/20">
                Free
              </span>
            )}
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                module.status === "coming_soon"
                  ? "bg-muted text-muted-foreground"
                  : "bg-titan-cyan/10 text-titan-cyan border border-titan-cyan/20"
              }`}
            >
              {priceLabel}
            </span>
          </div>
        </div>

        {isOnWaitlist && (
          <p className="text-[10px] text-titan-amber mt-2 flex items-center gap-1">
            <Bell className="w-3 h-3" /> On waitlist
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default function Marketplace() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [showDevForm, setShowDevForm] = useState(false);
  const [devCompany, setDevCompany] = useState("");
  const [devDescription, setDevDescription] = useState("");
  const [devSubmitting, setDevSubmitting] = useState(false);
  const [devError, setDevError] = useState("");
  const [devSuccess, setDevSuccess] = useState(false);

  const marketplaceQueryKey = ["marketplace", user?.id];

  const {
    data: marketplaceData,
    isLoading: dataLoading,
    error: dataError,
    refetch: reloadMarketplace,
  } = useQuery({
    queryKey: marketplaceQueryKey,
    queryFn: async () => {
      const [modules, installs, waitlist] = await Promise.all([
        fetchMarketplaceModules(),
        fetchUserInstalls(user?.id),
        fetchUserWaitlist(user?.id),
      ]);
      return { modules, installs, waitlist };
    },
    enabled: authChecked && !isLoadingAuth && !!user?.id,
    staleTime: 60_000,
  });

  const loading = !authChecked || isLoadingAuth || dataLoading;
  const modules = marketplaceData?.modules ?? [];
  const installs = marketplaceData?.installs ?? [];
  const waitlist = marketplaceData?.waitlist ?? [];

  const installedSlugs = new Set(installs.map((item) => item.module_slug));
  const waitlistSlugs = new Set(waitlist.map((item) => item.module_slug));

  const filtered = modules.filter((module) =>
    (activeCategory === "All" || module.category === activeCategory) &&
    (module.name.toLowerCase().includes(search.toLowerCase()) ||
      module.description.toLowerCase().includes(search.toLowerCase()))
  );

  const installedModules = modules.filter((module) => installedSlugs.has(module.slug));
  const installedCount = installedModules.length;
  const freeCount = modules.filter((m) => m.price === 0).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: marketplaceQueryKey });

  const clearMessages = () => {
    setActionError("");
    setActionSuccess("");
  };

  const handleInstall = async (module) => {
    clearMessages();
    setActionLoading(true);
    try {
      await installModule(user, module);
      await invalidate();
      setActionSuccess(`${module.name} installed successfully.`);
    } catch {
      setActionError("Failed to install module. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUninstall = async (module) => {
    clearMessages();
    setActionLoading(true);
    try {
      await uninstallModule(user, module.slug);
      await invalidate();
      setActionSuccess(`${module.name} removed.`);
    } catch {
      setActionError("Failed to remove module. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotify = async (module) => {
    clearMessages();
    setActionLoading(true);
    try {
      await joinWaitlist(user, module);
      await invalidate();
      setActionSuccess(`You're on the waitlist for ${module.name}.`);
    } catch {
      setActionError("Failed to join waitlist. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeveloperSubmit = async (e) => {
    e.preventDefault();
    setDevError("");
    if (!devCompany.trim() || !devDescription.trim()) {
      setDevError("Please fill in all fields.");
      return;
    }
    setDevSubmitting(true);
    try {
      await submitDeveloperApplication(user, {
        company: devCompany,
        description: devDescription,
      });
      setDevSuccess(true);
      setDevCompany("");
      setDevDescription("");
    } catch {
      setDevError("Failed to submit application. Please try again.");
    } finally {
      setDevSubmitting(false);
    }
  };

  if (loading) return <PageLoader variant="list" label="Loading marketplace" />;
  if (dataError) {
    return <ErrorState title="Couldn't load marketplace" onRetry={reloadMarketplace} />;
  }

  const selectedInstalled = selected ? installedSlugs.has(selected.slug) : false;
  const selectedOnWaitlist = selected ? waitlistSlugs.has(selected.slug) : false;

  return (
    <div className="relative p-4 md:p-8 max-w-7xl mx-auto min-h-full">
      <AmbientBackground />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-8"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 mb-4">
          <Sparkles className="w-3 h-3 text-titan-cyan" />
          <span className="text-[10px] text-titan-cyan font-semibold uppercase tracking-widest">
            Extension Store
          </span>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center titan-glow ai-pulse">
              <Store className="w-7 h-7 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                TitanOS <span className="gradient-text">Marketplace</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Industry modules, AI agents &amp; integrations — one click away
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatPill icon={PackageCheck} label="Installed" value={installedCount} accent="border-titan-green/20" />
            <StatPill icon={Gift} label="Free" value={freeCount} accent="border-titan-amber/20" />
            <StatPill icon={Store} label="Catalog" value={modules.length} accent="border-titan-cyan/20" />
          </div>
        </div>
      </motion.div>

      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="relative mb-8 rounded-3xl overflow-hidden border border-titan-cyan/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-titan-cyan/15 via-titan-indigo/10 to-titan-amber/5" />
        <div className="absolute inset-0 glass" />
        <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="max-w-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-titan-amber" />
              <span className="text-xs font-semibold text-titan-amber uppercase tracking-wider">Beta Access</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              Every module is <span className="gradient-text">free</span> right now
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Install industry-specific workflows, accounting syncs, and AI agents.
              Your toolkit grows with your business.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {[
              { icon: Shield, label: "Verified secure" },
              { icon: Clock, label: "1-click install" },
              { icon: Download, label: "No credit card" },
            ].map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 glass rounded-xl px-3 py-2 border border-border">
                <Icon className="w-3.5 h-3.5 text-titan-cyan" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Installed modules strip */}
      {installedModules.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative mb-6"
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
            <PackageCheck className="w-3.5 h-3.5 text-titan-green" />
            Your installed modules
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {installedModules.map((module) => (
              <button
                key={module.slug}
                onClick={() => module.route ? navigate(module.route) : setSelected(module)}
                className="flex items-center gap-2.5 glass rounded-2xl px-4 py-2.5 border border-titan-green/20 hover:border-titan-green/40 transition-all flex-shrink-0 group"
              >
                <span className="text-lg">{module.icon}</span>
                <span className="text-xs font-medium text-foreground/90 group-hover:text-foreground whitespace-nowrap">
                  {module.name}
                </span>
                {module.route && (
                  <ArrowRight className="w-3 h-3 text-titan-cyan opacity-60 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="relative mb-5"
      >
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search modules, features, categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 bg-titan-surface1/80 border-border text-foreground rounded-2xl h-12 placeholder:text-muted-foreground/80 focus:border-titan-cyan/30 focus:ring-titan-cyan/10 transition-all"
        />
      </motion.div>

      {/* Categories */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide"
      >
        {MARKETPLACE_CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] || LayoutGrid;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-medium whitespace-nowrap transition-colors ${
                isActive ? "text-titan-cyan" : "text-muted-foreground hover:text-foreground/85 glass border border-border"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="marketplace-category"
                  className="absolute inset-0 bg-titan-cyan/10 border border-titan-cyan/25 rounded-2xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10">{cat}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Results count */}
      <div className="flex items-center gap-2 mb-5 text-xs text-muted-foreground">
        <span className="glass rounded-full px-3 py-1 border border-border">
          {filtered.length} {filtered.length === 1 ? "module" : "modules"}
          {activeCategory !== "All" && ` in ${activeCategory}`}
        </span>
        {search && (
          <span className="text-muted-foreground">
            matching &ldquo;{search}&rdquo;
          </span>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-3xl p-14 text-center border border-border"
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium mb-1">No modules found</p>
          <p className="text-muted-foreground text-sm">Try a different search or category</p>
          <Button
            variant="ghost"
            onClick={() => { setSearch(""); setActiveCategory("All"); }}
            className="mt-4 text-titan-cyan hover:text-titan-cyan/80 text-xs"
          >
            Clear filters
          </Button>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((module, i) => (
              <ModuleCard
                key={module.slug}
                module={module}
                index={i}
                isInstalled={installedSlugs.has(module.slug)}
                isOnWaitlist={waitlistSlugs.has(module.slug)}
                onView={setSelected}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Developer CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="relative mt-14 rounded-3xl overflow-hidden border border-titan-indigo/25"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-titan-indigo/20 via-transparent to-titan-cyan/10" />
        <div className="absolute top-4 left-6 text-foreground/5 font-mono text-xs select-none">&lt;module /&gt;</div>
        <div className="absolute bottom-4 right-6 text-foreground/5 font-mono text-xs select-none">{"{ publish }"}</div>
        <div className="relative glass p-8 md:p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-titan-indigo/30 to-titan-cyan/20 border border-titan-indigo/30 flex items-center justify-center mx-auto mb-4 titan-glow">
            <Code2 className="w-8 h-8 text-titan-indigo" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            Build for <span className="gradient-text">TitanOS</span>
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
            Publish your modules to thousands of field service businesses.
            SDK docs, revenue share, and a built-in audience await.
          </p>
          {devSuccess ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-titan-green/15 border border-titan-green/25 text-titan-green text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Application submitted — we&apos;ll be in touch!
            </motion.div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowDevForm(true)}
              className="border-titan-indigo/40 text-foreground hover:bg-titan-indigo/15 rounded-2xl px-6 h-11 gap-2"
            >
              Apply for Developer Access
              <ArrowRight className="w-4 h-4 text-titan-indigo" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Module detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); clearMessages(); }}>
        <DialogContent className="bg-titan-surface1 border-border text-foreground max-w-md rounded-3xl p-0 overflow-hidden gap-0">
          {selected && (
            <>
              <div className={`relative px-6 pt-6 pb-5 bg-gradient-to-br ${selected.gradient}`}>
                <div className="absolute inset-0 bg-black/40" />
                <DialogHeader className="relative">
                  <DialogTitle className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-black/30 border border-border flex items-center justify-center text-3xl backdrop-blur-sm">
                      {selected.icon}
                    </div>
                    <div className="text-left">
                      <p className="text-foreground font-bold text-lg">{selected.name}</p>
                      <p className="text-xs text-muted-foreground font-normal flex items-center gap-2 mt-0.5">
                        {selected.category}
                        {selected.verified && (
                          <span className="flex items-center gap-0.5 text-titan-cyan">
                            <Shield className="w-3 h-3" /> Verified
                          </span>
                        )}
                      </p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="px-6 py-5 space-y-5">
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-3 font-semibold uppercase tracking-widest">
                    What&apos;s Included
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {selected.features.map((feature, i) => (
                      <motion.div
                        key={feature}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2.5 text-sm text-foreground/90 glass rounded-xl px-3 py-2 border border-border"
                      >
                        <div className="w-5 h-5 rounded-full bg-titan-green/15 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-titan-green" />
                        </div>
                        {feature}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between glass rounded-2xl px-4 py-3 border border-border">
                  <div className="flex items-center gap-3">
                    <StarRating rating={selected.rating} />
                    <span className="text-xs text-muted-foreground">{selected.review_count} reviews</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {formatInstallCount(selected.install_count)}
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  {actionError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-red-400 text-center"
                    >
                      {actionError}
                    </motion.p>
                  )}
                  {actionSuccess && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-titan-green text-center font-medium"
                    >
                      {actionSuccess}
                    </motion.p>
                  )}
                </AnimatePresence>

                {selected.status === "coming_soon" ? (
                  <div className="space-y-3">
                    <div className="glass rounded-2xl p-4 border border-titan-amber/20 text-center">
                      <Sparkles className="w-5 h-5 text-titan-amber mx-auto mb-2" />
                      <p className="text-sm font-semibold text-titan-amber mb-1">Coming Soon</p>
                      <p className="text-xs text-muted-foreground">Be first to know when this launches.</p>
                    </div>
                    <Button
                      onClick={() => handleNotify(selected)}
                      disabled={actionLoading || selectedOnWaitlist}
                      className="w-full bg-titan-amber hover:bg-titan-amber/90 text-black font-semibold rounded-2xl h-11"
                    >
                      {actionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : selectedOnWaitlist ? (
                        "On Waitlist ✓"
                      ) : (
                        <>
                          <Bell className="w-4 h-4 mr-1.5" />
                          Notify Me
                        </>
                      )}
                    </Button>
                  </div>
                ) : selectedInstalled ? (
                  <div className="space-y-3">
                    <div className="glass rounded-2xl p-4 border border-titan-green/25 text-center bg-titan-green/5">
                      <PackageCheck className="w-5 h-5 text-titan-green mx-auto mb-2" />
                      <p className="text-sm font-semibold text-titan-green mb-1">Installed &amp; Active</p>
                      <p className="text-xs text-muted-foreground">This module is running on your account.</p>
                    </div>
                    <div className="flex gap-2">
                      {selected.route && (
                        <Button
                          onClick={() => { setSelected(null); navigate(selected.route); }}
                          className="flex-1 bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-2xl h-11"
                        >
                          <ExternalLink className="w-4 h-4 mr-1.5" />
                          Open Module
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => handleUninstall(selected)}
                        disabled={actionLoading}
                        className={`${selected.route ? "flex-none px-4" : "flex-1"} border-red-400/25 text-red-300 hover:bg-red-400/10 rounded-2xl h-11`}
                      >
                        {actionLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleInstall(selected)}
                    disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-titan-cyan to-titan-indigo hover:opacity-90 text-foreground font-semibold rounded-2xl h-12 shadow-[0_4px_24px_rgba(0,199,217,0.25)]"
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1.5" />
                        Install — {formatModulePrice(selected)}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Developer form dialog */}
      <Dialog open={showDevForm} onOpenChange={setShowDevForm}>
        <DialogContent className="bg-titan-surface1 border-border text-foreground max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-titan-indigo" />
              Developer Application
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeveloperSubmit} className="space-y-4 mt-1">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                Company / Studio
              </label>
              <Input
                value={devCompany}
                onChange={(e) => setDevCompany(e.target.value)}
                placeholder="Your company name"
                className="bg-titan-surface2 border-border text-foreground rounded-xl h-11 focus:border-titan-indigo/40"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1.5 block uppercase tracking-wider font-medium">
                What do you want to build?
              </label>
              <Textarea
                value={devDescription}
                onChange={(e) => setDevDescription(e.target.value)}
                placeholder="Describe your module idea, tech stack, and experience..."
                rows={4}
                className="bg-titan-surface2 border-border text-foreground rounded-xl resize-none focus:border-titan-indigo/40"
                required
              />
            </div>
            {devError && <p className="text-xs text-red-400">{devError}</p>}
            <Button
              type="submit"
              disabled={devSubmitting}
              className="w-full bg-titan-indigo hover:bg-titan-indigo/90 text-foreground font-semibold rounded-2xl h-11"
            >
              {devSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Application"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
