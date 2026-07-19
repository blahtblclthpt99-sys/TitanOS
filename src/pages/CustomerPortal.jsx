import React, { useState, useEffect } from "react";
import { api } from "@/api/apiClient";
import { motion } from "framer-motion";
import { Briefcase, FileText, Receipt, LogOut, Clock, CheckCircle, AlertCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_CONFIG = {
  scheduled:   { label: "Scheduled",   icon: Clock,         color: "text-titan-cyan",   bg: "bg-titan-cyan/10"  },
  in_progress: { label: "In Progress", icon: Loader2,        color: "text-titan-amber",  bg: "bg-titan-amber/10" },
  completed:   { label: "Completed",   icon: CheckCircle,   color: "text-titan-green",  bg: "bg-green-500/10"   },
  cancelled:   { label: "Cancelled",   icon: XCircle,       color: "text-red-400",      bg: "bg-red-500/10"     },
  draft:       { label: "Draft",       icon: FileText,      color: "text-gray-400",     bg: "bg-gray-500/10"    },
  sent:        { label: "Sent",        icon: FileText,      color: "text-titan-cyan",   bg: "bg-titan-cyan/10"  },
  viewed:      { label: "Viewed",      icon: FileText,      color: "text-titan-indigo", bg: "bg-titan-indigo/10"},
  accepted:    { label: "Accepted",    icon: CheckCircle,   color: "text-titan-green",  bg: "bg-green-500/10"   },
  declined:    { label: "Declined",    icon: XCircle,       color: "text-red-400",      bg: "bg-red-500/10"     },
  expired:     { label: "Expired",     icon: AlertCircle,   color: "text-gray-400",     bg: "bg-gray-500/10"    },
  paid:        { label: "Paid",        icon: CheckCircle,   color: "text-titan-green",  bg: "bg-green-500/10"   },
  overdue:     { label: "Overdue",     icon: AlertCircle,   color: "text-red-400",      bg: "bg-red-500/10"     },
  partial:     { label: "Partial",     icon: AlertCircle,   color: "text-titan-amber",  bg: "bg-titan-amber/10" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, icon: FileText, color: "text-gray-400", bg: "bg-gray-500/10" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color} ${cfg.bg}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-card border border-white/8 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

// ─── Login Screen (email + OTP verification) ────────────────────────────────
function PortalLogin({ onLogin }) {
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      await api.functions.invoke("portalRequestOtp", { email: email.trim() });
      setStep("code");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await api.functions.invoke("portalVerifyOtp", { email: email.trim(), otp_code: code.trim() });
      onLogin(res.data.token, res.data.customer);
    } catch (err) {
      setError(err?.response?.data?.error || "Invalid or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-titan-cyan/10 border border-titan-cyan/30 mb-4">
            <span className="text-titan-cyan font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
          <p className="text-gray-400 text-sm mt-1">
            {step === "email" ? "Enter your email to view your account" : "Enter the code we sent to your email"}
          </p>
        </div>

        <Card>
          {step === "email" ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Address</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-[#0A0A0B] border-white/10 text-white placeholder:text-gray-600"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-titan-cyan text-black font-semibold hover:bg-titan-cyan/90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Verification Code</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="bg-[#0A0A0B] border-white/10 text-white placeholder:text-gray-600 tracking-widest text-center"
                  autoFocus
                  maxLength={6}
                />
                <p className="text-gray-600 text-xs mt-2">
                  If an account exists for {email}, a 6-digit code was sent. It expires in 10 minutes.
                </p>
              </div>
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-titan-cyan text-black font-semibold hover:bg-titan-cyan/90"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue"}
              </Button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="w-full flex items-center justify-center gap-1 text-gray-400 hover:text-white text-xs transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Use a different email
              </button>
            </form>
          )}
        </Card>
        <p className="text-center text-gray-600 text-xs mt-6">
          Powered by TitanOS Field Service
        </p>
      </motion.div>
    </div>
  );
}

// ─── Portal Dashboard ─────────────────────────────────────────────────────────
function PortalDashboard({ token, initialCustomer, onLogout }) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [jobs, setJobs] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState("jobs");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await api.functions.invoke("portalGetData", { token });
        setCustomer(res.data.customer);
        setJobs(res.data.jobs || []);
        setEstimates(res.data.estimates || []);
        setInvoices(res.data.invoices || []);
      } catch (err) {
        setLoadError("Your session expired. Please sign in again.");
        setTimeout(onLogout, 1500);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const tabs = [
    { id: "jobs",      label: "Jobs",      icon: Briefcase, count: jobs.length },
    { id: "estimates", label: "Estimates", icon: FileText,  count: estimates.filter(e => ["sent","viewed","draft"].includes(e.status)).length },
    { id: "invoices",  label: "Invoices",  icon: Receipt,   count: invoices.filter(i => ["sent","overdue","partial"].includes(i.status)).length },
  ];

  const activeEstimates = estimates.filter(e => ["sent","viewed","draft","accepted"].includes(e.status));

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0A0A0B]/80 backdrop-blur border-b border-white/8 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-base">Hi, {customer?.first_name} 👋</h1>
          <p className="text-gray-500 text-xs">{customer?.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-1 text-gray-400 hover:text-white text-xs transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loadError && (
          <Card className="text-center py-6">
            <p className="text-red-400 text-sm">{loadError}</p>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-2 bg-card rounded-xl p-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-titan-cyan text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-bold ${
                    activeTab === tab.id ? "bg-black/20" : "bg-white/10"
                  }`}>{tab.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-titan-cyan animate-spin" />
          </div>
        ) : (
          <>
            {/* JOBS TAB */}
            {activeTab === "jobs" && (
              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <Card className="text-center py-8">
                    <Briefcase className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No jobs on record</p>
                  </Card>
                ) : jobs.map(job => (
                  <Card key={job.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-medium text-sm">{job.title}</p>
                        {job.service_type && <p className="text-gray-500 text-xs">{job.service_type}</p>}
                      </div>
                      <StatusBadge status={job.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 pt-1 border-t border-white/5">
                      {job.scheduled_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(job.scheduled_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {job.scheduled_time && ` at ${job.scheduled_time}`}
                        </span>
                      )}
                      {job.amount > 0 && (
                        <span className="ml-auto font-medium text-white">${job.amount.toFixed(2)}</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ESTIMATES TAB */}
            {activeTab === "estimates" && (
              <div className="space-y-3">
                {activeEstimates.length === 0 ? (
                  <Card className="text-center py-8">
                    <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No estimates to review</p>
                  </Card>
                ) : activeEstimates.map(est => (
                  <Card key={est.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-medium text-sm">{est.estimate_number || "Estimate"}</p>
                        {est.service_type && <p className="text-gray-500 text-xs">{est.service_type}</p>}
                      </div>
                      <StatusBadge status={est.status} />
                    </div>
                    {est.line_items && est.line_items.length > 0 && (
                      <div className="text-xs text-gray-500 space-y-1">
                        {est.line_items.map((li, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{li.description}</span>
                            <span className="text-gray-400">${(li.total || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                      {est.valid_until && (
                        <span className="text-gray-500">Valid until {new Date(est.valid_until).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      )}
                      <span className="font-semibold text-white ml-auto">${(est.total || 0).toFixed(2)}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* INVOICES TAB */}
            {activeTab === "invoices" && (
              <div className="space-y-3">
                {invoices.length === 0 ? (
                  <Card className="text-center py-8">
                    <Receipt className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No invoices on record</p>
                  </Card>
                ) : invoices.map(inv => (
                  <Card key={inv.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-white font-medium text-sm">{inv.invoice_number || "Invoice"}</p>
                        {inv.due_date && (
                          <p className="text-gray-500 text-xs">Due {new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        )}
                      </div>
                      <StatusBadge status={inv.status} />
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                      <span className="text-gray-500">Total</span>
                      <span className="font-semibold text-white">${(inv.total || 0).toFixed(2)}</span>
                    </div>
                    {inv.balance_due > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-red-400">Balance due</span>
                        <span className="font-bold text-red-400">${inv.balance_due.toFixed(2)}</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Portal Page ─────────────────────────────────────────────────────────
export default function CustomerPortal() {
  const [session, setSession] = useState(() => {
    try {
      const token = sessionStorage.getItem("portal_token");
      const customer = JSON.parse(sessionStorage.getItem("portal_customer") || "null");
      return token && customer ? { token, customer } : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (token, customer) => {
    sessionStorage.setItem("portal_token", token);
    sessionStorage.setItem("portal_customer", JSON.stringify(customer));
    setSession({ token, customer });
  };

  const handleLogout = () => {
    sessionStorage.removeItem("portal_token");
    sessionStorage.removeItem("portal_customer");
    setSession(null);
  };

  if (!session) return <PortalLogin onLogin={handleLogin} />;
  return <PortalDashboard token={session.token} initialCustomer={session.customer} onLogout={handleLogout} />;
}