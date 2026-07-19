import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";
import { supabase } from "@/api/supabaseClient";
import { motion } from "framer-motion";
import {
  User, Building2, Bell, Shield, Palette, Lock, LogOut, ChevronRight, Check,
  Trash2, Gift, Upload, ShieldAlert,
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
import { useAuth } from "@/lib/AuthContext";
import { toast } from "@/components/ui/use-toast";
import { US_STATES } from "@/lib/platformConstants";
import { betaBadgeLabel } from "@/lib/plan";

const NOTIFICATION_OPTIONS = [
  ["messages", "Messages", "New messages and replies"],
  ["hires", "Hires", "New hire requests and updates"],
  ["applications", "Applications", "Applicant activity"],
  ["payments", "Payments", "Payment confirmations and reminders"],
  ["estimates", "Estimates", "Estimate activity"],
  ["referrals", "Referrals", "Referral progress and rewards"],
  ["marketplace", "Marketplace", "Marketplace activity"],
  ["reviews", "Reviews", "New customer reviews"],
  ["activity", "Activity", "Important account activity"],
];

const PRIVACY_OPTIONS = [
  ["show_in_community", "Show my profile in Community", "Let other professionals discover you."],
  ["show_city", "Show my city", "Display your city on your community profile."],
  ["share_completed_jobs", "Share completed jobs", "Allow completed work to appear in Community."],
];

const inputClass = "bg-[#242427] border-white/5 text-white rounded-xl focus:ring-1 focus:ring-titan-cyan/40";

function ToggleRow({ checked, label, description, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 text-left rounded-xl p-3 hover:bg-white/[0.03] transition-colors"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-white">{label}</span>
        <span className="block text-xs text-white/40 mt-0.5">{description}</span>
      </span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition-colors ${checked ? "bg-titan-cyan" : "bg-white/10"}`}>
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
  const [activePanel, setPanel] = useState(null);
  const [profileForm, setProfile] = useState({});
  const [companyForm, setCompany] = useState({});
  const [notificationPrefs, setNotificationPrefs] = useState({});
  const [privacyForm, setPrivacy] = useState({ community_opt_in: false, privacy_prefs: {} });
  const [themePref, setThemePref] = useState("system");
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
      setPrivacy({
        community_opt_in: user.community_opt_in ?? false,
        privacy_prefs: user.privacy_prefs || {},
      });
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
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark = themePref === "dark" || (themePref === "system" && media.matches);
      document.documentElement.classList.toggle("dark", isDark);
    };
    applyTheme();
    if (themePref === "system") {
      media.addEventListener?.("change", applyTheme);
      return () => media.removeEventListener?.("change", applyTheme);
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
    { id: "company",       icon: Building2, title: "Company",       description: "Business name, address, branding" },
    { id: "notifications", icon: Bell,      title: "Notifications", description: "Email and push preferences" },
    { id: "privacy",       icon: Lock,      title: "Privacy",       description: "Community visibility and sharing" },
    { id: "security",      icon: Shield,    title: "Security",      description: "Password and login settings" },
    { id: "accounts",      icon: Lock,      title: "Connected accounts", description: "Google and email sign-in methods" },
    { id: "theme",         icon: Palette,   title: "Theme",         description: "Choose your display preference" },
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
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Settings" subtitle="Account & preferences" />

      {user && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-white">{user.full_name?.[0]?.toUpperCase() || "U"}</span>}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-white truncate">{user.full_name}</p>
            <p className="text-sm text-white/40 truncate">{user.email}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-titan-cyan/10 text-titan-cyan font-semibold capitalize mt-1 inline-block">{user.role}</span>
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
            onClick={() => setPanel(section.id)}
            className="w-full glass rounded-2xl p-4 glass-hover transition-all duration-200 text-left flex items-center gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors">
              <section.icon className="w-5 h-5 text-white/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{section.title}</p>
              <p className="text-xs text-white/40">{section.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" />
          </motion.button>
        ))}
      </div>

      {/* Referral Banner */}
      <Link to="/referral">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 mb-3 border border-titan-indigo/20 bg-titan-indigo/5 flex items-center gap-4 hover:bg-titan-indigo/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-titan-indigo/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-titan-indigo" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Refer a friend</p>
            <p className="text-xs text-white/40">Refer 3 paying subscribers after launch → Lifetime Premium</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-indigo/50" />
        </motion.div>
      </Link>

      {user?.role === "admin" && <Link to="/admin/moderation">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 mb-3 border border-titan-amber/20 bg-titan-amber/5 flex items-center gap-4 hover:bg-titan-amber/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-titan-amber/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-titan-amber" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Marketplace moderation</p>
            <p className="text-xs text-white/40">Review reports and remove unsafe listings.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-amber/50" />
        </motion.div>
      </Link>}

      {/* Beta Program Banner */}
      <Link to="/beta">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 mb-4 border border-titan-cyan/20 bg-titan-cyan/5 flex items-center gap-4 hover:bg-titan-cyan/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-titan-cyan" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{betaBadgeLabel() || "Public Beta"}</p>
            <p className="text-xs text-white/40">Free During Beta! All features included.</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-cyan/50" />
        </motion.div>
      </Link>

      <Button onClick={() => logout("/login")} variant="outline"
        className="w-full border-red-400/20 text-red-400 hover:bg-red-400/10 rounded-xl h-11 gap-2 mb-3">
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>

      {/* Account Deletion */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-5 border border-red-500/10">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Delete Account</p>
            <p className="text-xs text-white/40 mt-0.5">Account deletion requests are being prepared. For now, this securely signs you out so you can contact support.</p>
          </div>
        </div>
        <Button onClick={() => setShowDeleteConfirm(true)} variant="outline"
          className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl h-10 text-sm gap-2">
          <Trash2 className="w-4 h-4" /> Request Account Deletion
        </Button>
      </motion.div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[#1A1A1C] border-white/5 text-white rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete your account?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Account deletion is not yet automated. Confirming below securely signs you out; contact support to complete a permanent deletion request.
              <br /><br />
              Type <span className="font-mono text-red-400">DELETE</span> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="bg-[#242427] border-white/10 text-white rounded-xl font-mono"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteConfirmText !== "DELETE"}
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); logout("/login"); }}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-40">
              Sign Out and Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Panel */}
      <Dialog open={activePanel === "profile"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-lg">Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center">
                {profileForm.avatar_url ? <img src={profileForm.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-white/40" />}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex h-9 items-center rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5"><Upload className="w-3.5 h-3.5 mr-2" />{uploading === "avatar_url" ? "Uploading…" : "Upload photo"}</span>
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
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50 gap-2">
              {savedPanel === "profile" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "profile" ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "company"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-lg">Company</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center">{companyForm.company_logo_url ? <img src={companyForm.company_logo_url} alt="" className="w-full h-full object-cover" /> : <Building2 className="w-5 h-5 text-white/40" />}</div>
              <label className="cursor-pointer"><span className="inline-flex h-9 items-center rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/5"><Upload className="w-3.5 h-3.5 mr-2" />{uploading === "company_logo_url" ? "Uploading…" : "Upload logo"}</span><input type="file" accept="image/*" className="sr-only" disabled={uploading === "company_logo_url"} onChange={(event) => uploadImage(event.target.files?.[0], "company_logo_url")} /></label>
            </div>
            <FormField label="Company logo URL" value={companyForm.company_logo_url || ""} onChange={e => setCompany(f => ({ ...f, company_logo_url: e.target.value }))} />
            <FormField label="Company name" value={companyForm.company_name || ""} onChange={e => setCompany(f => ({ ...f, company_name: e.target.value }))} />
            <FormField label="Street address" value={companyForm.company_address || ""} onChange={e => setCompany(f => ({ ...f, company_address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3"><FormField label="City" value={companyForm.company_city || ""} onChange={e => setCompany(f => ({ ...f, company_city: e.target.value }))} /><FormField label="State"><StateSelect value={companyForm.company_state || ""} onChange={e => setCompany(f => ({ ...f, company_state: e.target.value }))} /></FormField></div>
            <FormField label="ZIP code" value={companyForm.company_zip || ""} onChange={e => setCompany(f => ({ ...f, company_zip: e.target.value }))} />
            <Button onClick={() => save("company", companyForm, "Your company details have been updated.")} disabled={savingPanel === "company"} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 gap-2">{savedPanel === "company" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "company" ? "Saving…" : "Save Changes"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "notifications"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white text-lg">Notifications</DialogTitle></DialogHeader>
          <div className="space-y-1 mt-2">{NOTIFICATION_OPTIONS.map(([key, label, description]) => <ToggleRow key={key} checked={notificationPrefs[key] ?? true} label={label} description={description} onChange={(value) => setNotificationPrefs((prefs) => ({ ...prefs, [key]: value }))} />)}</div>
          <Button onClick={() => save("notifications", { notification_prefs: notificationPrefs }, "Your notification preferences have been updated.")} disabled={savingPanel === "notifications"} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 gap-2">{savedPanel === "notifications" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "notifications" ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "privacy"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Privacy</DialogTitle></DialogHeader>
          <div className="space-y-1 mt-2">
            <ToggleRow checked={privacyForm.community_opt_in} label="Join the Community" description="Enable Community features for your account." onChange={(value) => setPrivacy((form) => ({ ...form, community_opt_in: value }))} />
            {PRIVACY_OPTIONS.map(([key, label, description]) => <ToggleRow key={key} checked={privacyForm.privacy_prefs?.[key] ?? false} label={label} description={description} onChange={(value) => setPrivacy((form) => ({ ...form, privacy_prefs: { ...form.privacy_prefs, [key]: value } }))} />)}
          </div>
          <Button onClick={() => save("privacy", privacyForm, "Your privacy preferences have been updated.")} disabled={savingPanel === "privacy"} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 gap-2">{savedPanel === "privacy" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "privacy" ? "Saving…" : "Save Changes"}</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "security"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Security</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-xs text-white/40">Choose a password with at least 8 characters.</p>
            <FormField label="New password" type="password" autoComplete="new-password" value={passwordForm.password} onChange={e => setPassword((form) => ({ ...form, password: e.target.value }))} />
            <FormField label="Confirm new password" type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={e => setPassword((form) => ({ ...form, confirmPassword: e.target.value }))} />
            <Button onClick={savePassword} disabled={savingPanel === "security"} className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 gap-2">{savedPanel === "security" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "security" ? "Saving…" : "Change Password"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "accounts"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Connected accounts</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="rounded-xl border border-white/10 p-4">
              <p className="text-sm font-semibold text-white">Email</p>
              <p className="text-xs text-white/40 mt-1">{user?.email || "Email sign-in"}</p>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">Google</p><p className="text-xs text-white/40 mt-1">{connectedProviders.includes("google") ? "Connected" : "Sign in with Google available on Login"}</p></div>
                {connectedProviders.includes("google") ? <Check className="w-5 h-5 text-emerald-400" /> : <Button size="sm" onClick={() => api.auth.loginWithProvider?.("google")} className="bg-titan-cyan text-black hover:bg-titan-cyan/90">Connect</Button>}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activePanel === "theme"} onOpenChange={closePanel}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Theme</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {["system", "light", "dark"].map((option) => <button key={option} type="button" onClick={() => setThemePref(option)} className={`rounded-xl border px-3 py-4 text-sm font-medium capitalize transition-colors ${themePref === option ? "border-titan-cyan bg-titan-cyan/10 text-titan-cyan" : "border-white/10 text-white/60 hover:bg-white/5"}`}>{option}</button>)}
          </div>
          <Button onClick={() => save("theme", { theme_pref: themePref }, "Your theme preference has been updated.")} disabled={savingPanel === "theme"} className="w-full mt-4 bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 gap-2">{savedPanel === "theme" ? <><Check className="w-4 h-4" /> Saved</> : savingPanel === "theme" ? "Saving…" : "Save Theme"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}