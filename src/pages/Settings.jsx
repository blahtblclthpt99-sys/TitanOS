import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";
import { motion } from "framer-motion";
import {
  User, Building2, Bell, Shield, Palette, Lock, LogOut, ChevronRight, Check,
  Trash2, Gift, Upload, ShieldAlert, Megaphone, BadgeCheck,
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
import { betaBadgeLabel } from "@/lib/plan";
import { applyTheme, setStoredTheme, getHighContrast, setHighContrast, TEXT_SCALES, getTextScale, setTextScale, getReduceMotionPref, setReduceMotionPref } from "@/lib/theme";
import {
  MARKETING_CHANNELS,
  MARKETING_CATEGORIES,
  MARKETING_FREQUENCIES,
  mergeMarketingPrefs,
  normalizeMarketingPrefs,
  writeLocalMarketingPrefs,
} from "@/lib/marketingPrefs";

const NOTIFICATION_OPTIONS = [
  ["jobs", "Job updates", "Jobs, hires, estimates, and field activity"],
  ["messages", "Messages", "New messages and replies"],
  ["reviews", "Reviews", "Customer ratings and reputation"],
  ["account", "Account alerts", "Payments, billing, security, and profile"],
  ["system", "System updates", "Product news, maintenance, and tips"],
];

const PRIVACY_OPTIONS = [
  ["show_in_community", "Show my profile in Community", "Let other professionals discover you."],
  ["show_city", "Show my city", "Display your city on your community profile."],
  ["share_completed_jobs", "Share completed jobs", "Allow completed work to appear in Community."],
];

const inputClass = "bg-muted border-border text-foreground rounded-md";

function ToggleRow({ checked, label, description, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex min-h-[44px] items-center gap-3 text-left rounded-md p-3 hover:bg-muted/60 transition-colors focus-ring"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{description}</span>
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}

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
  const [activePanel, setPanel] = useState(null);
  const [profileForm, setProfile] = useState({});
  const [companyForm, setCompany] = useState({});
  const [notificationPrefs, setNotificationPrefs] = useState({});
  const [marketingPrefs, setMarketingPrefs] = useState(() => mergeMarketingPrefs(null));
  const [privacyForm, setPrivacy] = useState({ community_opt_in: false, privacy_prefs: {} });
  const [themePref, setThemePref] = useState("dark");
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
        ...Object.fromEntries(NOTIFICATION_OPTIONS.map(([key]) => [key, true])),
        ...(user.notification_prefs || {}),
      });
      setMarketingPrefs(mergeMarketingPrefs(user));
      setPrivacy({
        community_opt_in: user.community_opt_in ?? false,
        privacy_prefs: user.privacy_prefs || {},
      });
      setThemePref(user.theme_pref || "dark");
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
      const { file_url } = await api.integrations.Core.UploadFile({ file });
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

  const sections = [
    { id: "profile",       icon: User,      title: "Profile",       description: "Name and account details" },
    { id: "pro-profile",   icon: BadgeCheck, title: "Professional profile", description: "Public bio, portfolio, skills, and badges" },
    { id: "company",       icon: Building2, title: "Company",       description: "Business name, address, branding" },
    { id: "notifications", icon: Bell,      title: "Notifications", description: "Job, message, review, account, and system alerts" },
    { id: "marketing",     icon: Megaphone, title: "Marketing preferences", description: "Email, SMS, push, frequency, and topics" },
    { id: "trust",         icon: Shield,    title: "Trust & Safety", description: "Verification, 2FA, reports, and blocking" },
    { id: "privacy",       icon: Lock,      title: "Privacy",       description: "Community visibility and sharing" },
    { id: "security",      icon: Shield,    title: "Security",      description: "Password and login settings" },
    { id: "accounts",      icon: Lock,      title: "Connected accounts", description: "Google and email sign-in methods" },
    { id: "theme",         icon: Palette,   title: "Appearance",    description: "Theme, contrast, text size, and motion" },
  ];

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
        subtitle="Preferences, security, and how TitanOS looks on your devices."
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

      <div className="space-y-2 mb-8">
        {sections.map((section, i) => (
          <motion.button
            key={section.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => {
              if (section.id === "pro-profile") {
                navigate("/profile");
                return;
              }
              if (section.id === "trust") {
                navigate("/trust-safety");
                return;
              }
              setPanel(section.id);
            }}
            className="w-full titan-surface p-4 glass-hover transition-all duration-200 text-left flex items-center gap-4 group"
          >
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-muted transition-colors">
              <section.icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{section.title}</p>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground/40 transition-colors flex-shrink-0" />
          </motion.button>
        ))}
      </div>

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

      {/* Beta Program Banner */}
      <Link to="/beta">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="titan-surface p-4 mb-4 border border-primary/20 bg-titan-cyan/5 flex items-center gap-4 hover:bg-titan-cyan/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-md bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{betaBadgeLabel() || "Public Beta"}</p>
            <p className="text-xs text-muted-foreground">Free During Beta! All features included.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-primary/50" />
        </motion.div>
      </Link>

      <Button onClick={() => logout("/login")} variant="outline"
        className="w-full border-red-400/20 text-red-400 hover:bg-red-400/10 rounded-md h-11 gap-2 mb-3">
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>

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
        <AlertDialogContent className="bg-card border-border text-foreground rounded-2xl max-w-md">
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
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Notifications</DialogTitle></DialogHeader>
          <div className="space-y-1 mt-2">{NOTIFICATION_OPTIONS.map(([key, label, description]) => <ToggleRow key={key} checked={notificationPrefs[key] ?? true} label={label} description={description} onChange={(value) => setNotificationPrefs((prefs) => ({ ...prefs, [key]: value }))} />)}</div>
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
          <Button onClick={() => save("notifications", { notification_prefs: notificationPrefs }, "Your notification preferences have been updated.")} disabled={savingPanel === "notifications"} className="w-full gap-2">{savedPanel === "notifications" ? <SuccessCheck label="Saved" /> : savingPanel === "notifications" ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "marketing"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
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
                // Local save already written — still confirm UX
                toast({ title: "Saved on this device", description: "Marketing preferences stored locally." });
              }
            }}
            disabled={savingPanel === "marketing"}
            className="w-full gap-2 mt-4"
          >
            {savedPanel === "marketing" ? <SuccessCheck label="Saved" /> : savingPanel === "marketing" ? "Saving…" : "Save Changes"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "privacy"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-foreground text-lg">Privacy</DialogTitle></DialogHeader>
          <div className="space-y-1 mt-2">
            <ToggleRow checked={privacyForm.community_opt_in} label="Join the Community" description="Enable Community features for your account." onChange={(value) => setPrivacy((form) => ({ ...form, community_opt_in: value }))} />
            <ToggleRow
              checked={Boolean(user?.verified_worker)}
              label="Show Verified Worker badge"
              description="Display a verification badge on your booking page (admin may revoke)."
              onChange={(value) => save("privacy", { ...privacyForm, verified_worker: value }, value ? "Verified badge enabled." : "Verified badge hidden.")}
            />
            {PRIVACY_OPTIONS.map(([key, label, description]) => <ToggleRow key={key} checked={privacyForm.privacy_prefs?.[key] ?? false} label={label} description={description} onChange={(value) => setPrivacy((form) => ({ ...form, privacy_prefs: { ...form.privacy_prefs, [key]: value } }))} />)}
          </div>
          <Button onClick={() => save("privacy", privacyForm, "Your privacy preferences have been updated.")} disabled={savingPanel === "privacy"} className="w-full gap-2">{savedPanel === "privacy" ? <SuccessCheck label="Saved" /> : savingPanel === "privacy" ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "security"} onOpenChange={closePanel}>
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl">
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
        <DialogContent className="bg-card border-border text-foreground max-w-md rounded-2xl">
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
          <div className="grid grid-cols-3 gap-2 mt-4" role="group" aria-label="Color theme">
            {["system", "light", "dark"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setThemePref(option)}
                className={`rounded-md border px-3 py-4 text-sm font-medium capitalize transition-colors duration-fast focus-ring ${
                  themePref === option
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={themePref === option}
              >
                {option}
              </button>
            ))}
          </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}