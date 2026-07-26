import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";
import { motion } from "framer-motion";
import {
  User, Building2, Bell, LogOut, ChevronRight, Check,
  Trash2, Gift, Upload, ShieldAlert, Sparkles,
  Search, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/shared/PageHeader";
import FormField from "@/components/shared/FormField";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import SuccessCheck from "@/components/shared/SuccessCheck";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { US_STATES } from "@/lib/platformConstants";
import { getPlanCheckoutUrl, getPlanConfig, isPaidPlan, PLANS, FREE_DURING_BETA, BETA_PERK_LABEL } from "@/lib/plan";
import { applyTheme, setStoredTheme, getHighContrast, setHighContrast, TEXT_SCALES, getTextScale, setTextScale, getReduceMotionPref, setReduceMotionPref } from "@/lib/theme";
import ThemeToggle from "@/components/brand/ThemeToggle";
import TitanBrandLogo from "@/components/brand/TitanBrandLogo";
import {
  MARKETING_CHANNELS,
  MARKETING_CATEGORIES,
  MARKETING_FREQUENCIES,
  mergeMarketingPrefs,
  normalizeMarketingPrefs,
  writeLocalMarketingPrefs,
} from "@/lib/marketingPrefs";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_PANELS,
  NOTIFICATION_OPTIONS,
  PRIVACY_OPTIONS,
  defaultNotificationPrefs,
  defaultPrivacyPrefs,
  searchSettings,
  panelsByCategory,
  buildResetPayload,
  resetAppearanceLocal,
  resetMarketingLocal,
} from "@/lib/settingsCatalog";
import { syncObservabilityFromPrivacyPrefs } from "@/lib/observabilityPrefs";
import { syncSentryReplayPreference } from "@/lib/sentry";
import ToggleRow from "@/components/shared/ToggleRow";

const inputClass = "bg-muted border-border text-foreground rounded-md";

function StateSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} className={`${inputClass} h-10 w-full px-3 text-sm`}>
      <option value="">Select a state</option>
      {US_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
    </select>
  );
}

export default function Settings() {
  const { user, isLoadingAuth, authChecked, authError, checkUserAuth, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activePanel, setPanel] = useState(null);
  const [profileForm, setProfile] = useState({});
  const [companyForm, setCompany] = useState({});
  const [notificationPrefs, setNotificationPrefs] = useState({});
  const [marketingPrefs, setMarketingPrefs] = useState(() => mergeMarketingPrefs(null));
  const [privacyForm, setPrivacy] = useState({ community_opt_in: false, privacy_prefs: {} });
  const [themePref, setThemePref] = useState("system");
  const [highContrast, setHighContrastState] = useState(() => getHighContrast());
  const [textScale, setTextScaleState] = useState(() => getTextScale());
  const [reduceMotion, setReduceMotionState] = useState(() => {
    const v = getReduceMotionPref();
    return v === null ? "system" : v ? "on" : "off";
  });
  const [passwordForm, setPassword] = useState({ password: "", confirmPassword: "" });
  const [savingPanel, setSavingPanel] = useState(null);
  const savingRef = useRef(false);
  const [savedPanel, setSavedPanel] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [connectedProviders, setConnectedProviders] = useState([]);

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (!panel) return;
    if (panel === "trust") {
      navigate("/trust-safety", { replace: true });
      return;
    }
    if (panel === "pro-profile") {
      navigate("/profile", { replace: true });
      return;
    }
    setPanel(panel);
  }, [searchParams, navigate]);

  useEffect(() => {
    if (user) {
      setProfile({
        full_name: user.full_name || "", username: user.username || "", phone: user.phone || "",
        email: user.email || "", bio: user.bio || "", city: user.city || "", state: user.state || "",
        avatar_url: user.avatar_url || user.avatar || "",
      });
      setCompany({
        company_name: user.company_name || "", company_address: user.company_address || "",
        company_city: user.company_city || "", company_state: user.company_state || "",
        company_zip: user.company_zip || "", company_logo_url: user.company_logo_url || "",
      });
      setNotificationPrefs({
        ...defaultNotificationPrefs(),
        ...(user.notification_prefs || {}),
      });
      setMarketingPrefs(mergeMarketingPrefs(user));
      setPrivacy({
        community_opt_in: user.community_opt_in ?? false,
        privacy_prefs: {
          ...defaultPrivacyPrefs().privacy_prefs,
          ...(user.privacy_prefs || {}),
        },
      });
      syncObservabilityFromPrivacyPrefs({
        ...defaultPrivacyPrefs().privacy_prefs,
        ...(user.privacy_prefs || {}),
      });
      syncSentryReplayPreference();
      setThemePref(user.theme_pref || "system");
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const identities = data.session?.user?.identities || [];
      setConnectedProviders(identities.map((identity) => identity.provider).filter(Boolean));
    }).catch(() => { if (active) setConnectedProviders([]); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    setStoredTheme(themePref);
    applyTheme(themePref);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (themePref === "system") applyTheme("system");
    };
    if (themePref === "system") {
      media.addEventListener?.("change", onChange);
      return () => media.removeEventListener?.("change", onChange);
    }
  }, [themePref]);

  const save = async (panel, updates, successMessage) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setSavingPanel(panel);
    try {
      await api.auth.updateMe(updates);
      await checkUserAuth();
      if (panel === "privacy") {
        syncObservabilityFromPrivacyPrefs(updates.privacy_prefs || updates);
        syncSentryReplayPreference();
      }
      setSavedPanel(panel);
      toast({ title: "Settings saved", description: successMessage });
      window.setTimeout(() => setSavedPanel((current) => current === panel ? null : current), 2000);
      return true;
    } catch (error) {
      toast({ title: "Couldn't save settings", description: error.message || "Please try again.", variant: "destructive" });
      return false;
    } finally {
      savingRef.current = false;
      setSavingPanel(null);
    }
  };

  const uploadImage = async (file, field) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choose an image file", variant: "destructive" });
      return;
    }
    setUploading(field);
    try {
      const { file_url } = await api.integrations.Core.UploadFile({ file, visibility: "public" });
      if (field === "avatar_url") setProfile((form) => ({ ...form, avatar_url: file_url }));
      else setCompany((form) => ({ ...form, company_logo_url: file_url }));
      toast({ title: "Image uploaded", description: "Save this panel to keep the new image." });
    } catch (error) {
      toast({ title: "Upload failed", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const closePanel = () => {
    if (!savingPanel) setPanel(null);
  };

  const saveProfile = () => {
    if (!profileForm.full_name?.trim()) {
      toast({ title: "Full name is required", variant: "destructive" });
      return;
    }
    if (profileForm.email && profileForm.email !== user.email && !/\S+@\S+\.\S+/.test(profileForm.email)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    save("profile", profileForm, profileForm.email !== user.email
      ? "Your email change may require verification before it takes effect."
      : "Your profile has been updated.");
  };

  const savePassword = () => {
    if (passwordForm.password.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    save("security", { password: passwordForm.password }, "Your password has been changed.")
      .then((saved) => {
        if (saved) setPassword({ password: "", confirmPassword: "" });
      });
  };

  const [settingsQuery, setSettingsQuery] = useState("");

  const settingsHits = searchSettings(settingsQuery);
  const grouped = panelsByCategory(settingsQuery.trim() ? settingsHits.panels : SETTINGS_PANELS);
  const categoryList =
    settingsQuery.trim() && settingsHits.categories.length
      ? settingsHits.categories
      : SETTINGS_CATEGORIES;

  const openSettingsPanel = (section) => {
    if (section.href) {
      navigate(section.href);
      return;
    }
    if (section.id === "pro-profile") {
      navigate("/profile");
      return;
    }
    if (section.id === "trust") {
      navigate("/trust-safety");
      return;
    }
    setPanel(section.id);
  };

  const resetPanelDefaults = async (panelId) => {
    if (panelId === "theme") {
      const next = resetAppearanceLocal();
      setThemePref(next.theme_pref);
      setHighContrastState(next.high_contrast);
      setTextScaleState(next.text_scale);
      setReduceMotionState(next.reduce_motion);
      await save("theme", { theme_pref: "system" }, "Appearance restored to defaults.");
      return;
    }
    if (panelId === "marketing") {
      const prefs = resetMarketingLocal(user?.id);
      setMarketingPrefs(prefs);
      await save("marketing", { marketing_prefs: prefs }, "Marketing preferences restored to defaults.");
      return;
    }
    if (panelId === "notifications") {
      const prefs = defaultNotificationPrefs();
      setNotificationPrefs(prefs);
      await save("notifications", { notification_prefs: prefs }, "Notification preferences restored to defaults.");
      return;
    }
    if (panelId === "privacy") {
      const prefs = defaultPrivacyPrefs();
      setPrivacy(prefs);
      await save(
        "privacy",
        { community_opt_in: prefs.community_opt_in, privacy_prefs: prefs.privacy_prefs },
        "Privacy preferences restored to defaults."
      );
      return;
    }
    const payload = buildResetPayload(panelId);
    if (!payload) {
      toast({ title: "This section can’t be bulk-reset", description: "Edit fields individually." });
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading settings" />;
  if (authError) {
    return (
      <ErrorState
        title="Couldn't load settings"
        message="We had trouble loading your account details."
        onRetry={checkUserAuth}
      />
    );
  }

  return (
    <div className="page-pad max-w-3xl mx-auto pb-28 md:pb-10">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        subtitle="Organized by category — search any option, restore defaults where available."
      />

      {user && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="titan-surface p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-foreground">{user.full_name?.[0]?.toUpperCase() || "U"}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground truncate">{user.full_name}</p>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-titan-cyan/10 text-primary font-semibold capitalize mt-1 inline-block">{user.role}</span>
          </div>
        </motion.div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
        <Input
          value={settingsQuery}
          onChange={(e) => setSettingsQuery(e.target.value)}
          placeholder="Search settings…"
          aria-label="Search settings"
          className="pl-10 bg-muted border-border h-12"
        />
      </div>

      {settingsQuery.trim() && settingsHits.options.length > 0 ? (
        <div className="titan-surface p-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 mb-2">Matching options</p>
          <ul className="space-y-1">
            {settingsHits.options.slice(0, 12).map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsQuery("");
                    openSettingsPanel({ id: opt.panelId, href: opt.path.startsWith("/settings") ? null : opt.path });
                    if (opt.path.startsWith("/settings?panel=")) setPanel(opt.panelId);
                    else if (!opt.path.startsWith("/settings")) navigate(opt.path);
                  }}
                  className="w-full text-left rounded-xl px-3 py-2.5 hover:bg-muted/60 min-h-[48px]"
                >
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                  {opt.docs ? <p className="text-[10px] text-muted-foreground/80 mt-0.5">{opt.docs}</p> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-8 mb-8">
        {categoryList.map((cat) => {
          const items = grouped[cat.id] || [];
          if (!items.length) return null;
          return (
            <section key={cat.id}>
              <div className="px-1 mb-2">
                <h2 className="text-sm font-semibold text-foreground">{cat.label}</h2>
                <p className="text-xs text-muted-foreground">{cat.description}</p>
              </div>
              <div className="space-y-2">
                {items.map((section, i) => {
                  const Icon = section.icon || User;
                  return (
                    <motion.button
                      key={section.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => openSettingsPanel(section)}
                      className="w-full titan-surface p-4 titan-surface-interactive transition-all duration-200 text-left flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-muted transition-colors">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{section.title}</p>
                        <p className="text-xs text-muted-foreground">{section.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground/40 transition-colors flex-shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {settingsQuery.trim() && !categoryList.some((c) => (grouped[c.id] || []).length) && settingsHits.options.length === 0 ? (
          <p className="text-sm text-muted-foreground px-1">No settings match “{settingsQuery.trim()}”.</p>
        ) : null}
      </div>

      {/* Membership / PayPal upgrade */}
      {!isPaidPlan(user) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="titan-surface p-4 mb-3 border border-titan-cyan/25 bg-titan-cyan/5"
        >
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-md bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-titan-cyan" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {FREE_DURING_BETA ? "Plan perks during beta" : "Upgrade your plan"}
              </p>
              <p className="text-xs text-muted-foreground">
                {FREE_DURING_BETA
                  ? `Current: ${getPlanConfig(user).name}. Premium and Business tools are a ${BETA_PERK_LABEL} at $0 while we launch.`
                  : `Current: ${getPlanConfig(user).name}. Pay securely with PayPal — Premium $${PLANS.worker_premium.priceMonthly}/mo or Business $${PLANS.business.priceMonthly}/mo.`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!FREE_DURING_BETA && (
              <>
                <Button asChild size="sm" className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold">
                  <a href={getPlanCheckoutUrl("worker_premium")} target="_blank" rel="noopener noreferrer">
                    Premium ${PLANS.worker_premium.priceMonthly}
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="border-border">
                  <a href={getPlanCheckoutUrl("business")} target="_blank" rel="noopener noreferrer">
                    Business ${PLANS.business.priceMonthly}
                  </a>
                </Button>
              </>
            )}
            <Button asChild size="sm" variant={FREE_DURING_BETA ? "default" : "ghost"} className={FREE_DURING_BETA ? "bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold" : ""}>
              <Link to="/pricing">{FREE_DURING_BETA ? "See free beta plans" : "Compare plans"}</Link>
            </Button>
          </div>
        </motion.div>
      )}

      {/* Referral Banner */}
      <Link to="/referral">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="titan-surface p-4 mb-3 border border-titan-indigo/20 bg-titan-indigo/5 flex items-center gap-4 hover:bg-titan-indigo/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-md bg-titan-indigo/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-titan-indigo" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Refer a friend</p>
            <p className="text-xs text-muted-foreground">Refer 3 paying subscribers after launch → Lifetime Premium</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-indigo/50" />
        </motion.div>
      </Link>

      {user?.role === "admin" && <Link to="/admin/moderation">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="titan-surface p-4 mb-3 border border-titan-amber/20 bg-titan-amber/5 flex items-center gap-4 hover:bg-titan-amber/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-md bg-titan-amber/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-titan-amber" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Marketplace moderation</p>
            <p className="text-xs text-muted-foreground">Review reports and remove unsafe listings.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-amber/50" />
        </motion.div>
      </Link>}

      {/* Plans */}
      <Link to="/pricing">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="titan-surface p-4 mb-4 border border-primary/20 bg-titan-cyan/5 flex items-center gap-4 hover:bg-titan-cyan/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-md bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Plans & pricing</p>
            <p className="text-xs text-muted-foreground">Free shifts · Premium add-ons · PayPal checkout</p>
          </div>
          <ChevronRight className="w-4 h-4 text-primary/50" />
        </motion.div>
      </Link>

      <Button onClick={() => logout("/login")} variant="outline"
        className="w-full border-red-400/20 text-red-400 hover:bg-red-400/10 rounded-md h-11 gap-2 mb-3">
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>

      <div className="titan-surface p-4 mb-3 flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legal</p>
        <Link to="/privacy-policy" className="text-sm text-foreground hover:text-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms" className="text-sm text-foreground hover:text-primary underline-offset-2 hover:underline">
          Terms of Service
        </Link>
      </div>

      {/* Account Deletion */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="titan-surface p-5 border border-red-500/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-md bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Delete Account</p>
            <p className="text-xs text-muted-foreground mt-0.5">Account deletion requests are being prepared. For now, this securely signs you out so you can contact support.</p>
          </div>
        </div>
        <Button onClick={() => setShowDeleteConfirm(true)} variant="outline"
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-md h-10 text-sm gap-2">
          <Trash2 className="w-4 h-4" /> Request Account Deletion
        </Button>
      </motion.div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border text-foreground  max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Account deletion is not yet automated. Confirming below securely signs you out; contact support to complete a permanent deletion request.
              <br /><br />
              Type <span className="font-mono text-red-400">DELETE</span> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="bg-muted border-border text-foreground rounded-md font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}
              className="bg-muted border-border text-foreground hover:bg-muted rounded-md">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirmText !== "DELETE"}
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); logout("/login"); }}
              className="bg-red-500 hover:bg-red-600 text-foreground rounded-md disabled:opacity-40">
              Sign Out and Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Panel */}
      <Dialog open={activePanel === "profile"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md  max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">
                {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-foreground/90 hover:bg-muted"><Upload className="w-3.5 h-3.5 mr-2" />{uploading === "avatar_url" ? "Uploading…" : "Upload photo"}</span>
                <input type="file" accept="image/*" className="sr-only" disabled={uploading === "avatar_url"} onChange={(event) => uploadImage(event.target.files?.[0], "avatar_url")} />
              </label>
            </div>
            <FormField label="Avatar image URL" value={profileForm.avatar_url || ""} onChange={(e) => setProfile((form) => ({ ...form, avatar_url: e.target.value }))} />
            <FormField label="Full Name" value={profileForm.full_name}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
            <FormField label="Username" value={profileForm.username || ""} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} />
            <FormField label="Email" type="email" value={profileForm.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
            <p className="text-xs text-amber-300/70">Changing your email may require you to verify the new address.</p>
            <FormField label="Phone" type="tel" value={profileForm.phone || ""} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
            <FormField label="Bio">
              <Textarea value={profileForm.bio || ""} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} className={`${inputClass} min-h-20`} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="City" value={profileForm.city || ""} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} />
              <FormField label="State"><StateSelect value={profileForm.state || ""} onChange={e => setProfile(p => ({ ...p, state: e.target.value }))} /></FormField>
            </div>
            <Button onClick={saveProfile} disabled={savingPanel === "profile" || !profileForm.full_name?.trim()}
              className="w-full gap-2 disabled:opacity-50">
              {savedPanel === "profile" ? <SuccessCheck label="Saved" /> : savingPanel === "profile" ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "company"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md  max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Company</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted overflow-hidden flex items-center justify-center">{companyForm.company_logo_url ? <img src={companyForm.company_logo_url} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-muted-foreground" />}</div>
              <label className="cursor-pointer"><span className="inline-flex h-9 items-center rounded-md border border-border px-3 text-xs text-foreground/90 hover:bg-muted"><Upload className="w-3.5 h-3.5 mr-2" />{uploading === "company_logo_url" ? "Uploading…" : "Upload logo"}</span><input type="file" accept="image/*" className="sr-only" disabled={uploading === "company_logo_url"} onChange={(event) => uploadImage(event.target.files?.[0], "company_logo_url")} /></label>
            </div>
            <FormField label="Company logo URL" value={companyForm.company_logo_url || ""} onChange={e => setCompany(f => ({ ...f, company_logo_url: e.target.value }))} />
            <FormField label="Company name" value={companyForm.company_name || ""} onChange={e => setCompany(f => ({ ...f, company_name: e.target.value }))} />
            <FormField label="Street address" value={companyForm.company_address || ""} onChange={e => setCompany(f => ({ ...f, company_address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3"><FormField label="City" value={companyForm.company_city || ""} onChange={e => setCompany(f => ({ ...f, company_city: e.target.value }))} /><FormField label="State"><StateSelect value={companyForm.company_state || ""} onChange={e => setCompany(f => ({ ...f, company_state: e.target.value }))} /></FormField></div>
            <FormField label="ZIP code" value={companyForm.company_zip || ""} onChange={e => setCompany(f => ({ ...f, company_zip: e.target.value }))} />
            <Button onClick={() => save("company", companyForm, "Your company details have been updated.")} disabled={savingPanel === "company"} className="w-full gap-2">{savedPanel === "company" ? <SuccessCheck label="Saved" /> : savingPanel === "company" ? "Saving…" : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "notifications"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md  max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg">Notifications</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            {SETTINGS_PANELS.find((p) => p.id === "notifications")?.docs}
            {" "}Defaults: all categories on.
          </p>
          <div className="space-y-1 mt-2">
            {NOTIFICATION_OPTIONS.map((opt) => (
              <ToggleRow
                key={opt.key}
                checked={notificationPrefs[opt.key] ?? opt.default}
                label={opt.label}
                description={`${opt.description}${opt.docs ? ` — ${opt.docs}` : ""}`}
                onChange={(value) => setNotificationPrefs((prefs) => ({ ...prefs, [opt.key]: value }))}
              />
            ))}
          </div>
          <div className="mt-4 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">Device push for messages</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Allow browser notifications when a new message arrives while you&apos;re away from Messages.</p>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-md"
              onClick={async () => {
                const { requestMessagePushPermission, getMessagePushPermission } = await import("@/lib/messagePush");
                const result = await requestMessagePushPermission();
                const status = result || getMessagePushPermission();
                if (status === "granted") toast({ title: "Push notifications enabled" });
                else if (status === "denied") toast({ variant: "destructive", title: "Notifications blocked — enable them in browser settings" });
                else toast({ title: "Notifications unavailable on this device" });
              }}
            >
              Enable message push
            </Button>
          </div>
          <div className="flex flex-col gap-2 mt-4">
            <Button onClick={() => save("notifications", { notification_prefs: notificationPrefs }, "Your notification preferences have been updated.")} disabled={savingPanel === "notifications"} className="w-full gap-2">{savedPanel === "notifications" ? <SuccessCheck label="Saved" /> : savingPanel === "notifications" ? "Saving…" : "Save Changes"}</Button>
            <Button type="button" variant="outline" className="w-full gap-2 min-h-[44px]" onClick={() => resetPanelDefaults("notifications")} disabled={savingPanel === "notifications"}>
              <RotateCcw className="w-4 h-4" /> Restore defaults
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "marketing"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md  max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Marketing preferences</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">Control promotional messages separately from job and account alerts.</p>

          <ToggleRow
            checked={!marketingPrefs.unsubscribed_all}
            label="Receive marketing"
            description="Master switch for promotional TitanOS communications"
            onChange={(value) => setMarketingPrefs((p) => ({ ...p, unsubscribed_all: !value }))}
          />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Channels</p>
          <div className="space-y-1">
            {MARKETING_CHANNELS.map(([key, label, description]) => (
              <ToggleRow
                key={key}
                checked={Boolean(marketingPrefs[key]) && !marketingPrefs.unsubscribed_all}
                label={label}
                description={description}
                onChange={(value) =>
                  setMarketingPrefs((p) => ({ ...p, [key]: value, unsubscribed_all: value ? false : p.unsubscribed_all }))
                }
              />
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">Frequency</p>
          <div className="grid grid-cols-2 gap-2">
            {MARKETING_FREQUENCIES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMarketingPrefs((p) => ({ ...p, frequency: opt.id }))}
                className={`rounded-md border px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                  marketingPrefs.frequency === opt.id
                    ? "border-primary bg-titan-cyan/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">Topics</p>
          <div className="space-y-1">
            {MARKETING_CATEGORIES.map(([key, label, description]) => (
              <ToggleRow
                key={key}
                checked={Boolean(marketingPrefs.categories?.[key]) && !marketingPrefs.unsubscribed_all}
                label={label}
                description={description}
                onChange={(value) =>
                  setMarketingPrefs((p) => ({
                    ...p,
                    categories: { ...p.categories, [key]: value },
                    unsubscribed_all: value ? false : p.unsubscribed_all,
                  }))
                }
              />
            ))}
          </div>

          <Button
            onClick={async () => {
              const next = normalizeMarketingPrefs(marketingPrefs);
              if (user?.id) writeLocalMarketingPrefs(user.id, next);
              const ok = await save("marketing", { marketing_prefs: next }, "Your marketing preferences have been updated.");
              if (!ok && user?.id) {
                toast({ title: "Saved on this device", description: "Marketing preferences stored locally." });
              }
            }}
            disabled={savingPanel === "marketing"}
            className="w-full gap-2 mt-4"
          >
            {savedPanel === "marketing" ? <SuccessCheck label="Saved" /> : savingPanel === "marketing" ? "Saving…" : "Save Changes"}
          </Button>
          <Button type="button" variant="outline" className="w-full gap-2 mt-2 min-h-[44px]" onClick={() => resetPanelDefaults("marketing")} disabled={savingPanel === "marketing"}>
            <RotateCcw className="w-4 h-4" /> Restore defaults
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "privacy"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md ">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Privacy</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground mt-1 mb-2">
            {SETTINGS_PANELS.find((p) => p.id === "privacy")?.docs} Defaults: community sharing off; session replay off; product analytics on (opt-out anytime).
          </p>
          <div className="space-y-1 mt-2">
            <ToggleRow checked={privacyForm.community_opt_in} label="Join the Community" description="Enable Community features for your account. Default: off." onChange={(value) => setPrivacy((form) => ({ ...form, community_opt_in: value }))} />
            <ToggleRow
              checked={Boolean(user?.verified_worker)}
              label="Show Verified Worker badge"
              description="Display a verification badge on your booking page (admin may revoke)."
              onChange={(value) => save("privacy", { ...privacyForm, verified_worker: value }, value ? "Verified badge enabled." : "Verified badge hidden.")}
            />
            {PRIVACY_OPTIONS.map((opt) => (
              <ToggleRow
                key={opt.key}
                checked={privacyForm.privacy_prefs?.[opt.key] ?? opt.default}
                label={opt.label}
                description={`${opt.description}${opt.docs ? ` — ${opt.docs}` : ""}`}
                onChange={(value) =>
                  setPrivacy((form) => ({
                    ...form,
                    privacy_prefs: { ...form.privacy_prefs, [opt.key]: value },
                  }))
                }
              />
            ))}
          </div>
          <Button onClick={() => save("privacy", privacyForm, "Your privacy preferences have been updated.")} disabled={savingPanel === "privacy"} className="w-full gap-2">{savedPanel === "privacy" ? <SuccessCheck label="Saved" /> : savingPanel === "privacy" ? "Saving…" : "Save Changes"}</Button>
          <Button type="button" variant="outline" className="w-full gap-2 mt-2 min-h-[44px]" onClick={() => resetPanelDefaults("privacy")} disabled={savingPanel === "privacy"}>
            <RotateCcw className="w-4 h-4" /> Restore defaults
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "security"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md ">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Security</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-muted-foreground">Choose a password with at least 8 characters.</p>
            <FormField label="New password" type="password" autoComplete="new-password" value={passwordForm.password} onChange={e => setPassword((form) => ({ ...form, password: e.target.value }))} />
            <FormField label="Confirm new password" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={e => setPassword((form) => ({ ...form, confirmPassword: e.target.value }))} />
            <Button onClick={savePassword} disabled={savingPanel === "security"} className="w-full gap-2">{savedPanel === "security" ? <SuccessCheck label="Saved" /> : savingPanel === "security" ? "Saving…" : "Change Password"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "accounts"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md ">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Connected accounts</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="rounded-md border border-border p-4">
              <p className="text-sm font-semibold text-foreground">Email</p>
              <p className="text-xs text-muted-foreground mt-1">{user?.email || "Email sign-in"}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-foreground">Google</p><p className="text-xs text-muted-foreground mt-1">{connectedProviders.includes("google") ? "Connected" : "Sign in with Google available on Login"}</p></div>
                {connectedProviders.includes("google") ? <Check className="w-5 h-5 text-emerald-400" aria-hidden="true" /> : <Button size="sm" type="button" onClick={() => api.auth.loginWithProvider?.("google")}>Connect</Button>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "theme"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Appearance &amp; accessibility</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">Theme, contrast, text size, and motion</p>
          <div className="mt-4 flex justify-center">
            <TitanBrandLogo layout="horizontal" imgClassName="h-12 dark:brightness-110" />
          </div>
          <ThemeToggle
            variant="segmented"
            className="mt-4"
            onChange={(next) => setThemePref(next)}
          />
          <button
            type="button"
            onClick={() => {
              const next = !highContrast;
              setHighContrastState(next);
              setHighContrast(next);
            }}
            className={`mt-4 w-full flex items-center justify-between rounded-md border px-4 py-3 text-left transition-colors duration-fast focus-ring ${
              highContrast ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
            }`}
            aria-pressed={highContrast}
          >
            <div>
              <p className="text-sm font-semibold text-foreground">High contrast</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Stronger borders and text — also turns on when your OS requests more contrast
              </p>
            </div>
            <span className={`text-xs font-bold ${highContrast ? "text-primary" : "text-muted-foreground"}`}>
              {highContrast ? "ON" : "OFF"}
            </span>
          </button>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-2">Text size</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Text size">
            {TEXT_SCALES.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTextScaleState(opt.id);
                  setTextScale(opt.id);
                }}
                className={`rounded-md border px-3 py-3 text-left text-sm font-medium transition-colors focus-ring ${
                  textScale === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={textScale === opt.id}
              >
                {opt.label}
                <span className="block text-[11px] opacity-70">{opt.pct}%</span>
              </button>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-5 mb-2">Motion</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Reduce motion">
            {[
              { id: "system", label: "System" },
              { id: "on", label: "Reduce" },
              { id: "off", label: "Full" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setReduceMotionState(opt.id);
                  setReduceMotionPref(opt.id === "system" ? null : opt.id === "on");
                }}
                className={`rounded-md border px-2 py-3 text-sm font-medium transition-colors focus-ring ${
                  reduceMotion === opt.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={reduceMotion === opt.id}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Keyboard: Tab to move, Enter to activate, Escape to close menus. Skip link appears on first Tab.
          </p>
          <Button
            onClick={() => save("theme", { theme_pref: themePref }, "Your appearance preference has been updated.")}
            disabled={savingPanel === "theme"}
            className="w-full mt-4 gap-2"
          >
            {savedPanel === "theme" ? <SuccessCheck label="Saved" /> : savingPanel === "theme" ? "Saving…" : "Save appearance"}
          </Button>
          <Button type="button" variant="outline" className="w-full gap-2 mt-2 min-h-[44px]" onClick={() => resetPanelDefaults("theme")} disabled={savingPanel === "theme"}>
            <RotateCcw className="w-4 h-4" /> Restore defaults
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}