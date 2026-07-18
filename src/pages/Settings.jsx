import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { User, Building2, Bell, Shield, LogOut, ChevronRight, Check, Trash2, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function Settings() {
  const { user, isLoadingAuth, authChecked, authError, checkUserAuth, logout } = useAuth();
  const [activePanel, setPanel]   = useState(null);
  const [profileForm, setProfile] = useState({ full_name: "", email: "" });
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  useEffect(() => {
    if (user) {
      setProfile({ full_name: user.full_name || "", email: user.email || "" });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!profileForm.full_name) return;
    setSaving(true);
    try {
      await api.auth.updateMe({ full_name: profileForm.full_name });
      await checkUserAuth();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const sections = [
    { id: "profile",       icon: User,      title: "Profile",       description: "Name and account details" },
    { id: "company",       icon: Building2, title: "Company",       description: "Business name, address, branding" },
    { id: "notifications", icon: Bell,      title: "Notifications", description: "Email and push preferences" },
    { id: "security",      icon: Shield,    title: "Security",      description: "Password and login settings" },
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-titan-cyan to-titan-indigo flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-white">{user.full_name?.[0]?.toUpperCase() || "U"}</span>
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
            <p className="text-xs text-white/40">Get 50% off your next annual plan</p>
          </div>
          <ChevronRight className="w-4 h-4 text-titan-indigo/50" />
        </motion.div>
      </Link>

      {/* Beta Program Banner */}
      <Link to="/beta">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 mb-4 border border-titan-cyan/20 bg-titan-cyan/5 flex items-center gap-4 hover:bg-titan-cyan/10 transition-colors cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-titan-cyan" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Public Beta — Free Access</p>
            <p className="text-xs text-white/40">All features included · Join the beta program</p>
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
            <p className="text-xs text-white/40 mt-0.5">Permanently remove your account and all associated data. This action cannot be undone.</p>
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
              This will permanently delete your account and all business data including customers, jobs, invoices, and expenses. <strong className="text-white/70">This cannot be undone.</strong>
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
              onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); api.auth.logout("/login"); }}
              className="bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-40">
              Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Profile Panel */}
      <Dialog open={activePanel === "profile"} onOpenChange={() => setPanel(null)}>
        <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
          <DialogHeader><DialogTitle className="text-white text-lg">Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <FormField label="Full Name" value={profileForm.full_name}
              onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
            <FormField label="Email" value={profileForm.email} disabled
              className="opacity-60 cursor-not-allowed" />
            <p className="text-xs text-white/30">Email address cannot be changed here.</p>
            <Button onClick={handleSaveProfile} disabled={saving || !profileForm.full_name}
              className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-11 disabled:opacity-50 gap-2">
              {saved ? <><Check className="w-4 h-4" /> Saved</> : saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Placeholder panels for other sections */}
      {["company", "notifications", "security"].map(id => (
        <Dialog key={id} open={activePanel === id} onOpenChange={() => setPanel(null)}>
          <DialogContent className="bg-[#1A1A1C] border-white/5 text-white max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-white text-lg capitalize">{id}</DialogTitle>
            </DialogHeader>
            <div className="py-8 text-center">
              <p className="text-white/30 text-sm">This section is coming soon.</p>
            </div>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}