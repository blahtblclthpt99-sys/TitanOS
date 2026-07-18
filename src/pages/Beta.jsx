import React, { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Star, Zap, Shield, MessageSquare, Check, ChevronRight, Users, Sparkles, Bug, Lightbulb, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/api/apiClient";
import { Link } from "react-router-dom";

const BENEFITS = [
  { icon: Star,    title: "Early Access",        description: "Every new feature lands in your hands first." },
  { icon: Zap,     title: "Shape the Roadmap",   description: "Your feedback directly drives what we build next." },
  { icon: Shield,  title: "Founder Pricing",     description: "Beta testers lock in special rates when paid plans launch." },
  { icon: Users,   title: "Direct Founder Line", description: "Chat directly with the team building TitanOS." },
];

const BUSINESS_SIZES = [
  { value: "solo",  label: "Just me (solo)" },
  { value: "2-5",   label: "2–5 people" },
  { value: "6-15",  label: "6–15 people" },
  { value: "16-50", label: "16–50 people" },
  { value: "50+",   label: "50+ people" },
];

const EXPERIENCE = [
  { value: "not_technical",      label: "Not technical — I just want it to work" },
  { value: "somewhat_technical", label: "Somewhat technical" },
  { value: "very_technical",     label: "Very technical — I love digging deep" },
];

const FEEDBACK_TYPES = [
  { id: "bug",     label: "Bug",     icon: Bug,          color: "text-red-400",        bg: "bg-red-400/10",        border: "border-red-400/30" },
  { id: "feature", label: "Feature", icon: Lightbulb,    color: "text-titan-amber",    bg: "bg-titan-amber/10",    border: "border-titan-amber/30" },
  { id: "general", label: "General", icon: MessageSquare, color: "text-titan-cyan",    bg: "bg-titan-cyan/10",     border: "border-titan-cyan/30" },
];

export default function Beta() {
  // Tester application state
  const [form, setForm] = useState({ full_name: "", email: "", business_type: "", business_size: "", experience: "", why_join: "" });
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  // Feedback state
  const [fbType, setFbType]       = useState("general");
  const [fbMessage, setFbMessage] = useState("");
  const [fbEmail, setFbEmail]     = useState("");
  const [fbSent, setFbSent]       = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [fbError, setFbError]     = useState("");

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email) return;
    setApplying(true);
    setApplyError("");
    const payload = { ...form, status: "pending", submitted_at: new Date().toISOString() };
    try {
      // Guest-friendly: don't hard-fail if DB/email aren't reachable on static hosting
      try {
        await api.entities.BetaSignup.create(payload);
      } catch {
        const pending = JSON.parse(localStorage.getItem("titanos_beta_signups") || "[]");
        pending.push(payload);
        localStorage.setItem("titanos_beta_signups", JSON.stringify(pending));
      }
      try {
        await api.integrations.Core.SendEmail({
          to: "hello@titanos.app",
          subject: `New Beta Tester Application — ${form.full_name}`,
          body: `New beta tester application:\n\nName: ${form.full_name}\nEmail: ${form.email}\nBusiness Type: ${form.business_type || "N/A"}\nTeam Size: ${form.business_size || "N/A"}\nTech Level: ${form.experience || "N/A"}\n\nWhy they want to join:\n${form.why_join || "Not provided"}`,
        });
      } catch {
        /* sendEmail may be stubbed on IONOS — application still counted locally */
      }
      setApplied(true);
    } catch {
      setApplyError("Something went wrong. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const handleFeedback = async (e) => {
    e.preventDefault();
    if (!fbMessage.trim()) return;
    setFbLoading(true);
    setFbError("");
    const payload = {
      type: fbType,
      message: fbMessage,
      email: fbEmail || undefined,
      status: "new",
      submitted_at: new Date().toISOString(),
    };
    try {
      try {
        await api.entities.BetaFeedback.create(payload);
      } catch {
        const pending = JSON.parse(localStorage.getItem("titanos_beta_feedback") || "[]");
        pending.push(payload);
        localStorage.setItem("titanos_beta_feedback", JSON.stringify(pending));
      }
      try {
        await api.integrations.Core.SendEmail({
          to: "hello@titanos.app",
          subject: `[${fbType.toUpperCase()}] Beta Feedback`,
          body: `Type: ${fbType}\nFrom: ${fbEmail || "Anonymous"}\n\nMessage:\n${fbMessage}`,
        });
      } catch {
        /* optional on static hosts */
      }
      setFbSent(true);
    } catch {
      setFbError("Something went wrong. Please try again.");
    } finally {
      setFbLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-titan-cyan/10 border border-titan-cyan/20 mb-5">
            <Sparkles className="w-3.5 h-3.5 text-titan-cyan" />
            <span className="text-xs text-titan-cyan font-semibold uppercase tracking-wider">Public Beta Program</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
            Help Build the Future of<br />
            <span className="gradient-text">Service Business Software</span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            Join the TitanOS Public Beta. Get early access to every new feature and help shape the next generation of AI-powered business management.
          </p>
        </motion.div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {BENEFITS.map((b, i) => (
            <motion.div key={b.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className="glass rounded-2xl p-4 border border-white/5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
                <b.icon className="w-4 h-4 text-titan-cyan" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-0.5">{b.title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{b.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── TESTER APPLICATION FORM ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-3xl p-6 sm:p-8 border border-titan-cyan/20 titan-glow mb-6">

          {applied ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-titan-cyan/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-titan-cyan" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Application received!</h3>
              <p className="text-sm text-white/50 mb-2">We'll review your application and reach out to <span className="text-white/70">{form.email}</span> soon.</p>
              <p className="text-xs text-white/30 mb-6">In the meantime, feel free to explore the app.</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button asChild className="bg-titan-cyan hover:bg-titan-cyan/90 text-black font-semibold rounded-xl h-10 text-sm gap-2">
                  <Link to="/register">
                    Create free account <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-xl h-10 text-sm border-white/15 bg-transparent text-white hover:bg-white/5">
                  <Link to="/download">Download app</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-titan-cyan/10 flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-5 h-5 text-titan-cyan" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Apply to be a Beta Tester</h2>
                  <p className="text-xs text-white/40">Takes about 1 minute · We review every application</p>
                </div>
              </div>

              <form onSubmit={handleApply} className="space-y-4">
                {/* Row: name + email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Full Name *</label>
                    <Input value={form.full_name} onChange={set("full_name")} placeholder="Jane Smith" required
                      className="bg-[#242427] border-white/10 text-white rounded-xl h-11 placeholder:text-white/20 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-white/50 mb-1.5 block">Email Address *</label>
                    <Input type="email" value={form.email} onChange={set("email")} placeholder="jane@example.com" required
                      className="bg-[#242427] border-white/10 text-white rounded-xl h-11 placeholder:text-white/20 text-sm" />
                  </div>
                </div>

                {/* Business type */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Type of Service Business <span className="text-white/25">(optional)</span></label>
                  <Input value={form.business_type} onChange={set("business_type")} placeholder="e.g. HVAC, plumbing, cleaning, landscaping..."
                    className="bg-[#242427] border-white/10 text-white rounded-xl h-11 placeholder:text-white/20 text-sm" />
                </div>

                {/* Team size */}
                <div>
                  <label className="text-xs text-white/50 mb-2 block">Team Size <span className="text-white/25">(optional)</span></label>
                  <div className="flex flex-wrap gap-2">
                    {BUSINESS_SIZES.map(s => (
                      <button type="button" key={s.value} onClick={() => setForm(f => ({ ...f, business_size: s.value }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${form.business_size === s.value ? "bg-titan-cyan/10 border-titan-cyan/40 text-titan-cyan" : "border-white/10 text-white/40 hover:text-white/60"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tech experience */}
                <div>
                  <label className="text-xs text-white/50 mb-2 block">Tech Comfort Level <span className="text-white/25">(optional)</span></label>
                  <div className="flex flex-col gap-2">
                    {EXPERIENCE.map(ex => (
                      <button type="button" key={ex.value} onClick={() => setForm(f => ({ ...f, experience: ex.value }))}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border text-left transition-all ${form.experience === ex.value ? "bg-titan-cyan/10 border-titan-cyan/40 text-titan-cyan" : "border-white/10 text-white/40 hover:text-white/60"}`}>
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Why join */}
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Why do you want to join the beta? <span className="text-white/25">(optional)</span></label>
                  <textarea value={form.why_join} onChange={set("why_join")}
                    placeholder="Tell us what you're hoping to get out of TitanOS..." rows={3}
                    className="w-full bg-[#242427] border border-white/10 text-white rounded-xl p-3 text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-titan-cyan/50 resize-none" />
                </div>

                {applyError && <p className="text-xs text-red-400">{applyError}</p>}

                <Button type="submit" disabled={applying || !form.full_name || !form.email}
                  className="w-full bg-titan-cyan hover:bg-titan-cyan/90 text-black font-bold rounded-xl h-12 text-sm gap-2 disabled:opacity-50">
                  {applying ? "Submitting…" : <><Rocket className="w-4 h-4" /> Apply to Beta Program</>}
                </Button>
              </form>
            </>
          )}
        </motion.div>

        {/* ── FEEDBACK FORM ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass rounded-3xl p-6 sm:p-8 border border-titan-indigo/20 bg-titan-indigo/5 mb-6">

          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-titan-indigo/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-titan-indigo" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Leave Feedback</h2>
              <p className="text-xs text-white/40">Already testing? Tell us what you think.</p>
            </div>
          </div>

          {fbSent ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-titan-indigo/20 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-titan-indigo" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">Feedback received — thank you!</p>
              <p className="text-xs text-white/40">We read every submission and it shapes what we build.</p>
              <button onClick={() => { setFbSent(false); setFbMessage(""); setFbEmail(""); }}
                className="mt-4 text-xs text-titan-indigo hover:text-titan-indigo/80 transition-colors">
                Submit more feedback
              </button>
            </div>
          ) : (
            <form onSubmit={handleFeedback} className="space-y-4">
              {/* Type selector */}
              <div className="flex gap-2">
                {FEEDBACK_TYPES.map(t => (
                  <button type="button" key={t.id} onClick={() => setFbType(t.id)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${fbType === t.id ? `${t.bg} ${t.border} ${t.color}` : "border-white/5 text-white/30 hover:text-white/50"}`}>
                    <t.icon className="w-4 h-4" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Message */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">
                  {fbType === "bug" ? "What happened? How do we reproduce it?" : fbType === "feature" ? "What feature would help you most?" : "What's on your mind?"}
                </label>
                <textarea value={fbMessage} onChange={e => setFbMessage(e.target.value)} required rows={4}
                  placeholder={fbType === "bug" ? "Describe the bug and steps to reproduce..." : fbType === "feature" ? "Describe the feature you'd like to see..." : "Share thoughts, ideas, or anything..."}
                  className="w-full bg-[#242427] border border-white/10 text-white rounded-xl p-3 text-sm placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-titan-indigo/50 resize-none" />
              </div>

              {/* Optional email */}
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Your email <span className="text-white/25">(optional — if you'd like a reply)</span></label>
                <Input type="email" value={fbEmail} onChange={e => setFbEmail(e.target.value)} placeholder="you@example.com"
                  className="bg-[#242427] border-white/10 text-white rounded-xl h-11 placeholder:text-white/20 text-sm" />
              </div>

              {fbError && <p className="text-xs text-red-400">{fbError}</p>}

              <Button type="submit" disabled={fbLoading || !fbMessage.trim()}
                className="w-full bg-titan-indigo hover:bg-titan-indigo/90 text-white font-semibold rounded-xl h-11 text-sm gap-2 disabled:opacity-40">
                {fbLoading ? "Sending…" : <><Send className="w-4 h-4" /> Send Feedback</>}
              </Button>
            </form>
          )}
        </motion.div>

        <div className="text-center">
          <Link to="/privacy-policy" className="text-xs text-white/20 hover:text-white/40 transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}