import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { Gift, Users, Copy, Check, Mail, Loader2, CheckCircle, Clock, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import ErrorState from "@/components/shared/ErrorState";
import { useAuth } from "@/lib/AuthContext";

export default function Referral() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState(false);

  const {
    data: referrals = [],
    isLoading: referralsLoading,
    error: referralsError,
    refetch: reloadReferrals,
  } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: () => api.entities.Referral.filter({ referrer_user_id: user.id }),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const loading = !authChecked || isLoadingAuth || referralsLoading;

  const completedReferrals = referrals.filter(r => r.status === "completed");
  const pendingReferrals   = referrals.filter(r => r.status === "pending");
  const currentYear        = new Date().getFullYear();
  const redeemedThisYear   = referrals.some(r => r.reward_redeemed && r.reward_year === currentYear);
  const hasUnredeemedReward = completedReferrals.some(r => !r.reward_redeemed);
  const canClaim = hasUnredeemedReward && !redeemedThisYear;

  const referralLink = user
    ? `${window.location.origin}/register?ref=${btoa(user.email).replace(/=/g, "")}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email address."); return; }
    if (referrals.some(r => r.referred_email === email.trim())) {
      setError("You've already invited this person."); return;
    }
    setSending(true);
    try {
      await api.entities.Referral.create({
        referrer_user_id: user.id,
        referrer_email: user.email,
        referred_email: email.trim(),
        status: "pending",
      });
      await api.integrations.Core.SendEmail({
        to: email.trim(),
        from_name: user.full_name || "TitanOS",
        subject: `${user.full_name || "Someone"} invited you to TitanOS`,
        body: `Hi there!\n\n${user.full_name || "A TitanOS user"} thinks you'd love TitanOS — the AI-powered operating system for field service businesses.\n\nSign up with this link and get started:\n${referralLink}\n\nNo credit card required.\n\n— The TitanOS Team`,
      });
      await reloadReferrals();
      setEmail("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError("Failed to send invite. Please try again.");
    } finally { setSending(false); }
  };

  const handleClaimReward = async () => {
    setClaimError("");
    setClaiming(true);
    try {
      const toRedeem = completedReferrals.find(r => !r.reward_redeemed);
      if (!toRedeem) { setClaimError("No completed referral found."); return; }
      await api.entities.Referral.update(toRedeem.id, {
        reward_redeemed: true,
        reward_redeemed_at: new Date().toISOString(),
        reward_year: currentYear,
      });
      await api.integrations.Core.SendEmail({
        to: user.email,
        from_name: "TitanOS",
        subject: "🎉 Your referral reward — 50% off your next annual plan",
        body: `Hi ${user.full_name || "there"},\n\nYour referral reward has been claimed! You'll receive 50% off your next annual TitanOS subscription.\n\nOur team will apply this discount when you renew or upgrade. If you have questions, reply to this email.\n\nThank you for growing the TitanOS community!\n\n— The TitanOS Team`,
      });
      await reloadReferrals();
      setClaimSuccess(true);
    } catch {
      setClaimError("Something went wrong. Please try again.");
    } finally { setClaiming(false); }
  };

  if (loading) return <PageLoader variant="list" label="Loading referrals" />;
  if (referralsError) {
    return <ErrorState title="Couldn't load referrals" onRetry={reloadReferrals} />;
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Referral Program" subtitle="Invite friends. Earn rewards." />

      {/* Hero card */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 mb-6 border border-titan-cyan/20 bg-titan-cyan/5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-titan-cyan/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-titan-cyan" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Refer a friend, earn perks</h2>
            <p className="text-sm text-white/50 leading-relaxed">
              When someone you refer signs up, you'll be first in line for exclusive perks when paid plans launch. <span className="text-titan-cyan font-semibold">Beta referrers get locked-in founder pricing.</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Invited", value: referrals.length, color: "text-white" },
          { label: "Completed", value: completedReferrals.length, color: "text-titan-cyan" },
          { label: "Pending", value: pendingReferrals.length, color: "text-titan-amber" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Reward status */}
      {claimSuccess ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="glass rounded-2xl p-5 mb-6 border border-titan-cyan/30 bg-titan-cyan/5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-titan-cyan flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Reward claimed!</p>
            <p className="text-xs text-white/50">We've sent details to your email. Your founder pricing perk will be applied when paid plans launch.</p>
          </div>
        </motion.div>
      ) : canClaim ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-5 mb-6 border border-titan-amber/30 bg-titan-amber/5">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-5 h-5 text-titan-amber flex-shrink-0" />
            <p className="text-sm font-semibold text-white">You have a reward ready to claim!</p>
          </div>
          <p className="text-xs text-white/50 mb-4">Your referral signed up! Claim your founder reward — locked-in pricing when paid plans launch.</p>
          {claimError && <p className="text-xs text-red-400 mb-3">{claimError}</p>}
          <Button onClick={handleClaimReward} disabled={claiming}
            className="w-full bg-titan-amber hover:bg-titan-amber/90 text-black font-semibold rounded-xl h-10 gap-2">
            {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {claiming ? "Claiming…" : "Claim Founder Reward"}
          </Button>
        </motion.div>
      ) : redeemedThisYear ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-4 mb-6 border border-white/5 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-titan-cyan flex-shrink-0" />
          <p className="text-sm text-white/50">Founder reward claimed for {currentYear}. Keep inviting friends to build more perks!</p>
        </motion.div>
      ) : null}

      {/* Send invite */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-5 mb-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Mail className="w-4 h-4 text-titan-cyan" /> Send an invite
        </h3>
        <form onSubmit={handleSendInvite} className="flex gap-2">
          <Input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="friend@example.com"
            type="email"
            className="bg-[#1A1A1C] border-white/5 text-white rounded-xl h-10 flex-1 placeholder:text-white/20"
          />
          <Button type="submit" disabled={sending || !email.trim()}
            className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 px-4 gap-2 flex-shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <Check className="w-4 h-4" /> : null}
            {sent ? "Sent!" : sending ? "Sending…" : "Invite"}
          </Button>
        </form>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
      </motion.div>

      {/* Referral link */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass rounded-2xl p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-titan-cyan" /> Your referral link
        </h3>
        <div className="flex gap-2">
          <Input readOnly value={referralLink}
            className="bg-[#1A1A1C] border-white/5 text-white/50 rounded-xl h-10 flex-1 text-xs" />
          <Button onClick={handleCopy} variant="outline"
            className="border-white/10 text-white rounded-xl h-10 px-4 gap-2 flex-shrink-0">
            {copied ? <Check className="w-4 h-4 text-titan-cyan" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </motion.div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Invite History</h3>
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm text-white/80">{r.referred_email}</p>
                  <p className="text-xs text-white/30">{new Date(r.created_date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.reward_redeemed && <span className="text-xs text-titan-cyan bg-titan-cyan/10 px-2 py-0.5 rounded-full">Rewarded</span>}
                  {r.status === "completed"
                    ? <span className="flex items-center gap-1 text-xs text-titan-cyan"><CheckCircle className="w-3.5 h-3.5" /> Signed up</span>
                    : <span className="flex items-center gap-1 text-xs text-white/30"><Clock className="w-3.5 h-3.5" /> Pending</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}