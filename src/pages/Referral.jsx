import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCircle2, Clock3, Copy, Gift, Loader2, Mail, ShieldCheck, Users } from "lucide-react";
import { api } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { getReferralLink, ensureReferralCode, inviteReferral, listReferrals, referralStats } from "@/lib/referralApi";
import { FREE_DURING_BETA, REFERRAL_REWARD, betaBadgeLabel } from "@/lib/plan";

export default function Referral() {
  const { user, isLoadingAuth, authChecked, checkUserAuth } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const referralCode = await ensureReferralCode(user, async (updates) => {
        await api.auth.updateMe(updates);
        await checkUserAuth();
      });
      setCode(referralCode);
      setReferrals(await listReferrals(user.id));
    } catch (error) {
      toast({ title: "Couldn't load referrals", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authChecked && user?.id) loadDashboard();
  }, [authChecked, user?.id]);

  const stats = useMemo(() => referralStats(referrals), [referrals]);
  const referralLink = getReferralLink(code);
  const progress = Math.min(100, (stats.completedPaying / stats.required) * 100);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast({ title: "Referral link copied" });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" });
    }
  };

  const handleSendInvite = async (event) => {
    event.preventDefault();
    if (sending || !email.trim()) return;
    setSending(true);
    try {
      await inviteReferral(user, email, code);
      setEmail("");
      await loadDashboard();
      toast({ title: "Invite sent", description: "We'll track their progress here." });
    } catch (error) {
      toast({ title: "Couldn't send invite", description: error.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!authChecked || isLoadingAuth || loading) return <PageLoader variant="list" label="Loading referrals" />;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Referral Program" subtitle="Invite your network. Unlock premium for life." />

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-6 mb-5 border border-titan-cyan/20 bg-titan-cyan/5">
        <div className="flex gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-titan-cyan/15 grid place-items-center"><Gift className="w-6 h-6 text-titan-cyan" /></div>
          <div>
            <div className="flex gap-2 items-center mb-1">
              <h2 className="text-lg font-bold text-foreground">Earn {REFERRAL_REWARD.label}</h2>
              {betaBadgeLabel() && <span className="text-[10px] font-semibold text-titan-cyan bg-titan-cyan/10 rounded-full px-2 py-0.5">{betaBadgeLabel()}</span>}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">During beta everyone is free. After paid launch, 3 verified paying subscribers unlock Lifetime TitanOS Premium.</p>
          </div>
        </div>
      </motion.section>

      <section className="glass rounded-2xl p-5 mb-5">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{stats.progressLabel}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.rewardUnlocked ? "Lifetime Premium unlocked!" : `${stats.required - stats.completedPaying} more verified subscriber${stats.required - stats.completedPaying === 1 ? "" : "s"} to go`}</p>
          </div>
          <span className="text-titan-cyan font-bold">{stats.completedPaying}/{stats.required}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden mt-4"><div className="h-full bg-titan-cyan transition-all duration-500" style={{ width: `${progress}%` }} /></div>
      </section>

      <section className="glass rounded-2xl p-5 mb-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your unique referral code</p>
        <p className="font-mono font-bold tracking-widest text-titan-cyan">{code}</p>
        <div className="flex gap-2 mt-4">
          <Input readOnly value={referralLink} className="bg-card border-border text-muted-foreground rounded-xl h-10 text-xs" />
          <Button onClick={handleCopy} variant="outline" className="border-border text-foreground rounded-xl h-10 shrink-0 gap-2">
            {copied ? <Check className="w-4 h-4 text-titan-cyan" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </section>

      <section className="glass rounded-2xl p-5 mb-5">
        <h3 className="font-semibold text-foreground flex gap-2 items-center mb-3"><Mail className="w-4 h-4 text-titan-cyan" /> Invite by email</h3>
        <form onSubmit={handleSendInvite} className="flex gap-2">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="friend@example.com" type="email" className="bg-card border-border text-foreground rounded-xl h-10" />
          <Button type="submit" disabled={sending || !email.trim()} className="bg-titan-cyan hover:bg-titan-cyan/90 text-black rounded-xl h-10 font-semibold shrink-0">
            {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{sending ? "Sending…" : "Send invite"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground flex gap-1.5 items-center mt-3"><ShieldCheck className="w-3.5 h-3.5" /> Self-referrals blocked to protect the program.</p>
      </section>

      <div className="grid md:grid-cols-2 gap-5">
        <ReferralList title="Pending invitations" icon={Clock3} rows={stats.pending} empty="No pending invitations." />
        <ReferralList title="Successful paying referrals" icon={CheckCircle2} rows={stats.paying} empty={FREE_DURING_BETA ? "Verified paying referrals begin after launch." : "No verified paying referrals yet."} successful />
      </div>

      <section className="glass rounded-2xl p-5 mt-5">
        <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-titan-cyan" /> Referral history</h3>
        {referrals.length ? <div className="space-y-2">{referrals.map((row) => <div key={row.id} className="flex items-center justify-between py-2 border-b border-border last:border-0"><div><p className="text-sm text-foreground">{row.referred_email || "Referral"}</p><p className="text-xs text-muted-foreground">{new Date(row.created_at || row.created_date || Date.now()).toLocaleDateString()}</p></div><span className={`text-xs ${row.is_paying || row.status === "completed" ? "text-titan-cyan" : "text-titan-amber"}`}>{row.is_paying || row.status === "completed" ? "Verified paying" : row.status === "signed_up" ? "Signed up" : "Pending"}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Your sent invitations will appear here.</p>}
      </section>
    </div>
  );
}

function ReferralList({ title, icon: Icon, rows, empty, successful = false }) {
  return <section className="glass rounded-2xl p-5"><h3 className="font-semibold text-foreground flex gap-2 items-center mb-3"><Icon className={`w-4 h-4 ${successful ? "text-titan-cyan" : "text-titan-amber"}`} /> {title}</h3>{rows.length ? <div className="space-y-2">{rows.map((row) => <p key={row.id} className="text-sm text-foreground/85 truncate py-1 border-b border-border last:border-0">{row.referred_email || "Referral"}</p>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}</section>;
}
