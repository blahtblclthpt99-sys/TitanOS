import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = String(
  import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
);
const configured = Boolean(supabaseUrl && supabaseKey);
const supabase = configured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const money = (cents = 0) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const cents = (value) => Math.max(0, Math.round(Number(value || 0) * 100));

async function attention(action, payload = {}) {
  if (!supabase) throw new Error("Titan Attention is not configured.");
  const { data, error } = await supabase.functions.invoke("attention-api", {
    body: { action, ...payload },
  });
  if (error) throw error;
  if (data?.error) {
    const err = new Error(data.error);
    err.code = data.error;
    throw err;
  }
  return data;
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">T</span>
      <span className="brand-copy"><b>Titan</b><em>Attention</em></span>
    </div>
  );
}

function PublicHome({ openAuth }) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Brand />
        <nav>
          <a href="#earn">Earn</a>
          <a href="#advertise">Advertise</a>
          <a href="#trust">Trust</a>
          <button className="btn ghost" onClick={() => openAuth("signin", "viewer")}>Sign in</button>
          <button className="btn primary" onClick={() => openAuth("signup", "viewer")}>Start earning</button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">Verified human attention marketplace</span>
            <h1>Get paid for attention. Buy attention that is actually human.</h1>
            <p className="lead">
              Titan Attention connects sponsors directly with people who voluntarily engage with sponsored content.
              Rewards are verified server-side and never depend on fake ad clicks, automated views, or pretending incentive traffic is organic.
            </p>
            <div className="actions">
              <button className="btn primary large" onClick={() => openAuth("signup", "viewer")}>Earn from campaigns</button>
              <button className="btn secondary large" onClick={() => openAuth("signup", "advertiser")}>Create a campaign</button>
            </div>
            <div className="trust-row">
              <span>Active-view verification</span>
              <span>One reward per campaign</span>
              <span>Direct sponsor budgets</span>
            </div>
          </div>

          <div className="hero-card">
            <div className="card-head"><span>LIVE CAMPAIGN MODEL</span><b>Verified</b></div>
            <div className="creative-preview"><span className="play">▶</span><small>Sponsored product demo</small></div>
            <div className="reward-grid">
              <div><small>Attention</small><strong>20 sec</strong></div>
              <div><small>Reward</small><strong>$0.05</strong></div>
              <div><small>Status</small><strong>Active</strong></div>
            </div>
            <div className="progress"><span style={{ width: "72%" }} /></div>
            <p className="fine">Example only. Real balances change only after a server-verified completion.</p>
          </div>
        </section>

        <section className="section" id="earn">
          <div className="section-copy">
            <span className="eyebrow">For viewers</span>
            <h2>Choose. Engage. Earn.</h2>
            <p>Every campaign shows the reward and required active time before you start. You decide what you want to engage with.</p>
          </div>
          <div className="three-grid">
            <article><b>01</b><h3>Choose</h3><p>Open a sponsor campaign that interests you.</p></article>
            <article><b>02</b><h3>Stay active</h3><p>Visible-page heartbeats verify genuine engagement time.</p></article>
            <article><b>03</b><h3>Get credited</h3><p>The server checks completion before adding the reward to your wallet.</p></article>
          </div>
        </section>

        <section className="section split" id="advertise">
          <div className="section-copy">
            <span className="eyebrow">For advertisers</span>
            <h2>Stop buying empty impressions.</h2>
            <p>Set your budget, viewer reward, and required engagement time. Campaigns activate only after verified funding.</p>
            <button className="btn primary" onClick={() => openAuth("signup", "advertiser")}>Launch a campaign</button>
          </div>
          <div className="budget-card">
            <div><span>Campaign budget</span><strong>$500.00</strong></div>
            <div><span>Viewer reward</span><strong>$0.05</strong></div>
            <div><span>Required engagement</span><strong>20 seconds</strong></div>
            <div><span>Traffic model</span><strong>Direct sponsored</strong></div>
          </div>
        </section>

        <section className="policy" id="trust">
          <span className="eyebrow">Clean traffic by design</span>
          <h2>Not an ad-click farm.</h2>
          <p>
            Sponsors purchase engagement directly through Titan Attention. Viewers are rewarded for the disclosed sponsored experience itself.
            The platform does not pay people to click third-party display ads, inflate an ad network's impressions, or manufacture supposedly organic traffic.
          </p>
        </section>
      </main>

      <footer><Brand /><span>Human verified · Direct sponsored engagement · Built on TitanFieldOS.com</span></footer>
    </div>
  );
}

function AuthModal({ initialMode, initialRole, close, success }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name, attention_role: role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Confirm your email, then sign in.");
          setMode("signin");
        } else {
          await attention("ensure_profile", { role, display_name: name });
          success();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        success();
      }
    } catch (err) {
      setMessage(err?.message || "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="auth-modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close} aria-label="Close">×</button>
        <Brand />
        <h2>{mode === "signup" ? "Create your account" : "Welcome back"}</h2>
        {mode === "signup" && (
          <div className="role-picker">
            <button type="button" className={role === "viewer" ? "selected" : ""} onClick={() => setRole("viewer")}><b>Earn</b><span>View sponsor campaigns</span></button>
            <button type="button" className={role === "advertiser" ? "selected" : ""} onClick={() => setRole("advertiser")}><b>Advertise</b><span>Buy verified attention</span></button>
          </div>
        )}
        <form onSubmit={submit}>
          {mode === "signup" && <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>}
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
          {message && <div className="notice">{message}</div>}
          <button className="btn primary full" disabled={busy}>{busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
        </form>
        <button className="text-btn" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
      </div>
    </div>
  );
}

function DashboardShell({ profile, children, signOut }) {
  return (
    <div className="dashboard">
      <aside>
        <Brand />
        <div className="account-chip"><small>ACCOUNT</small><b>{profile.role === "advertiser" ? "Advertiser" : "Viewer"}</b><span>{profile.display_name || "Member"}</span></div>
        <div className="side-note"><span>Verified attention</span><p>Direct sponsor campaigns only. No automated views or paid third-party ad clicks.</p></div>
        <button className="btn ghost full" onClick={signOut}>Sign out</button>
      </aside>
      <main className="dash-main">{children}</main>
    </div>
  );
}

function ViewerDashboard({ profile, campaigns, reload, signOut }) {
  const [watch, setWatch] = useState(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!watch?.session?.view) return undefined;
    let stopped = false;
    async function heartbeat() {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const result = await attention("heartbeat", {
          view_id: watch.session.view.id,
          session_token: watch.session.view.session_token,
        });
        if (!stopped) setActiveSeconds(Number(result.active_seconds || 0));
      } catch {
        // Final completion validation remains authoritative.
      }
    }
    heartbeat();
    const timer = window.setInterval(heartbeat, 4000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [watch]);

  async function start(campaign) {
    setBusy(true); setNotice("");
    try {
      const session = await attention("start_view", { campaign_id: campaign.id });
      setActiveSeconds(0);
      setWatch({ campaign, session });
    } catch (err) {
      setNotice(err?.code === "already_completed" ? "You already completed this campaign." : "This campaign is unavailable right now.");
    } finally { setBusy(false); }
  }

  async function complete() {
    setBusy(true); setNotice("");
    try {
      await attention("complete_view", {
        view_id: watch.session.view.id,
        session_token: watch.session.view.session_token,
      });
      const earned = watch.campaign.reward_cents;
      setWatch(null);
      setNotice(`${money(earned)} was verified and credited to your wallet.`);
      await reload();
    } catch (err) {
      setNotice(err?.code === "insufficient_active_time" ? "More active engagement time is required." : "The server could not verify this completion.");
    } finally { setBusy(false); }
  }

  async function withdraw() {
    setBusy(true); setNotice("");
    try {
      await attention("request_withdrawal", { amount_cents: profile.balance_cents });
      setNotice("Payout request added to the withdrawal queue.");
      await reload();
    } catch (err) {
      setNotice(err?.message || "Unable to request payout.");
    } finally { setBusy(false); }
  }

  return (
    <DashboardShell profile={profile} signOut={signOut}>
      <header className="dash-head"><div><span className="eyebrow">Earn</span><h1>Available campaigns</h1><p>Only funded, active sponsor campaigns appear here.</p></div></header>
      {notice && <div className="notice success">{notice}</div>}
      <section className="stats">
        <article><small>Available balance</small><strong>{money(profile.balance_cents)}</strong><button className="btn secondary compact" disabled={busy || Number(profile.balance_cents) < 500} onClick={withdraw}>Request payout</button></article>
        <article><small>Pending payout</small><strong>{money(profile.pending_cents)}</strong><span>$5.00 minimum withdrawal</span></article>
        <article><small>Lifetime earned</small><strong>{money(profile.lifetime_earned_cents)}</strong><span>Verified rewards only</span></article>
      </section>
      <section className="campaign-grid">
        {campaigns.length === 0 ? <div className="empty"><h3>No campaigns are live yet.</h3><p>New funded campaigns will appear here automatically.</p></div> : campaigns.map((campaign) => (
          <article className="campaign" key={campaign.id}>
            <div className="campaign-top"><span>SPONSORED</span><b>{money(campaign.reward_cents)}</b></div>
            <h3>{campaign.title}</h3><p>{campaign.description}</p>
            <div className="campaign-meta"><span>{campaign.duration_seconds}s active</span><span>{money(Math.max(0, campaign.total_budget_cents - campaign.spent_cents))} budget left</span></div>
            <button className="btn primary full" disabled={busy} onClick={() => start(campaign)}>Start verified session</button>
          </article>
        ))}
      </section>
      {watch && <WatchModal watch={watch} activeSeconds={activeSeconds} busy={busy} close={() => setWatch(null)} complete={complete} />}
    </DashboardShell>
  );
}

function WatchModal({ watch, activeSeconds, busy, close, complete }) {
  const { campaign, session } = watch;
  const required = Number(session.duration_seconds || campaign.duration_seconds || 20);
  const ready = activeSeconds >= required;
  const percent = Math.min(100, Math.round((activeSeconds / required) * 100));
  const media = String(campaign.media_url || "");
  const video = /\.(mp4|webm|mov)(\?|$)/i.test(media);
  return (
    <div className="modal-backdrop dark">
      <div className="watch-modal">
        <div className="watch-title"><div><span className="eyebrow">Sponsored session</span><h2>{campaign.title}</h2></div><button className="close" onClick={close}>×</button></div>
        <div className="media-stage">
          {media ? (video ? <video src={media} autoPlay controls playsInline /> : <img src={media} alt="Sponsored creative" />) : <div className="media-placeholder"><span>T</span><b>{campaign.title}</b><small>Sponsored content</small></div>}
        </div>
        <p>{campaign.description}</p>
        {campaign.destination_url && <a className="sponsor-link" href={campaign.destination_url} target="_blank" rel="noreferrer">Visit sponsor site ↗</a>}
        <div className="watch-stats"><div><small>Verified active time</small><strong>{activeSeconds}s / {required}s</strong></div><div><small>Reward</small><strong>{money(campaign.reward_cents)}</strong></div></div>
        <div className="progress"><span style={{ width: `${percent}%` }} /></div>
        <p className="fine">Keep this page visible while engaging. Background time does not count.</p>
        <button className="btn primary full" disabled={!ready || busy} onClick={complete}>{busy ? "Verifying…" : ready ? `Verify & credit ${money(campaign.reward_cents)}` : "Complete active time first"}</button>
      </div>
    </div>
  );
}

function AdvertiserDashboard({ profile, campaigns, reload, signOut }) {
  const [form, setForm] = useState({ title: "", description: "", media_url: "", destination_url: "", reward: "0.05", duration: "20", budget: "25.00" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function createCampaign(e) {
    e.preventDefault();
    setBusy(true); setNotice("");
    try {
      await attention("create_campaign", {
        title: form.title,
        description: form.description,
        media_url: form.media_url || null,
        destination_url: form.destination_url || null,
        reward_cents: cents(form.reward),
        duration_seconds: Number(form.duration),
        total_budget_cents: cents(form.budget),
      });
      setForm({ title: "", description: "", media_url: "", destination_url: "", reward: "0.05", duration: "20", budget: "25.00" });
      setNotice("Campaign draft created. Fund it to make it eligible for viewers.");
      await reload();
    } catch (err) {
      setNotice(err?.message || "Unable to create campaign.");
    } finally { setBusy(false); }
  }

  async function fund(campaign) {
    setBusy(true); setNotice("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch("/api/attention/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: campaign.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Checkout unavailable");
      window.location.assign(data.url);
    } catch (err) {
      setNotice(err?.message || "Unable to start campaign funding.");
      setBusy(false);
    }
  }

  const totals = useMemo(() => campaigns.reduce((acc, c) => ({ budget: acc.budget + Number(c.total_budget_cents || 0), spent: acc.spent + Number(c.spent_cents || 0) }), { budget: 0, spent: 0 }), [campaigns]);

  return (
    <DashboardShell profile={profile} signOut={signOut}>
      <header className="dash-head"><div><span className="eyebrow">Advertise</span><h1>Campaign control</h1><p>Create direct sponsored campaigns and fund them before distribution.</p></div></header>
      {notice && <div className="notice">{notice}</div>}
      <section className="stats">
        <article><small>Campaigns</small><strong>{campaigns.length}</strong><span>{campaigns.filter((c) => c.status === "active").length} active</span></article>
        <article><small>Committed budget</small><strong>{money(totals.budget)}</strong><span>Across all drafts and campaigns</span></article>
        <article><small>Verified spend</small><strong>{money(totals.spent)}</strong><span>Viewer rewards + platform fees</span></article>
      </section>

      <div className="advertiser-layout">
        <form className="create-card" onSubmit={createCampaign}>
          <div><span className="eyebrow">New campaign</span><h2>Build a sponsored task</h2></div>
          <label>Campaign title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} minLength={3} maxLength={120} required /></label>
          <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} required /></label>
          <label>Media URL <small>Optional image or direct video URL</small><input type="url" value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} /></label>
          <label>Sponsor destination <small>Optional</small><input type="url" value={form.destination_url} onChange={(e) => setForm({ ...form, destination_url: e.target.value })} /></label>
          <div className="form-row">
            <label>Viewer reward ($)<input type="number" min="0.01" max="100" step="0.01" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} required /></label>
            <label>Active seconds<input type="number" min="5" max="600" step="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} required /></label>
          </div>
          <label>Campaign budget ($)<input type="number" min="5" max="100000" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} required /></label>
          <p className="fine">Titan currently applies a 25% platform fee to each viewer reward, disclosed in campaign economics before activation.</p>
          <button className="btn primary full" disabled={busy}>Create draft</button>
        </form>

        <section className="campaign-list">
          <h2>Your campaigns</h2>
          {campaigns.length === 0 ? <div className="empty"><h3>No campaigns yet.</h3><p>Create the first draft on the left.</p></div> : campaigns.map((campaign) => (
            <article key={campaign.id}>
              <div className="campaign-top"><span className={`status ${campaign.status}`}>{campaign.status}</span><b>{money(campaign.total_budget_cents)}</b></div>
              <h3>{campaign.title}</h3><p>{campaign.description}</p>
              <div className="campaign-meta"><span>{money(campaign.reward_cents)} viewer reward</span><span>{campaign.duration_seconds}s active</span><span>{money(campaign.spent_cents)} spent</span></div>
              {(campaign.status === "draft" || campaign.status === "funding") && <button className="btn secondary full" disabled={busy} onClick={() => fund(campaign)}>{campaign.status === "funding" ? "Resume funding" : `Fund ${money(campaign.total_budget_cents)}`}</button>}
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(configured);
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState("");

  async function load(currentSession = session) {
    if (!currentSession?.user || !supabase) { setProfile(null); setCampaigns([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      let { data: found, error: profileError } = await supabase.from("attention_profiles").select("*").eq("user_id", currentSession.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!found) {
        const role = currentSession.user.user_metadata?.attention_role === "advertiser" ? "advertiser" : "viewer";
        const result = await attention("ensure_profile", { role, display_name: currentSession.user.user_metadata?.full_name || "" });
        found = result.profile;
      }
      setProfile(found);
      let query = supabase.from("attention_campaigns").select("*").order("created_at", { ascending: false });
      if (found.role === "viewer") query = query.eq("status", "active");
      const { data: rows, error: campaignError } = await query;
      if (campaignError) throw campaignError;
      setCampaigns(rows || []);
    } catch (err) {
      setError(err?.message || "Unable to load Titan Attention.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    document.title = "Titan Attention — Verified Human Engagement";
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); load(data.session || null); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next || null);
      if (!next) { setProfile(null); setCampaigns([]); setLoading(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("funding") === "success" && session) {
      const t = window.setTimeout(() => load(session), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [session]);

  async function signOut() { await supabase.auth.signOut(); setSession(null); setProfile(null); setCampaigns([]); }

  if (!configured) return <div className="fatal"><Brand /><h1>Configuration required</h1><p>Set the Supabase public URL and publishable key for this deployment.</p></div>;
  if (loading && session) return <div className="fatal"><Brand /><div className="spinner" /><p>Loading your account…</p></div>;

  return (
    <>
      {!session ? <PublicHome openAuth={(mode, role) => setAuth({ mode, role })} /> : error ? <div className="fatal"><Brand /><h2>Unable to load account</h2><p>{error}</p><button className="btn secondary" onClick={() => load(session)}>Retry</button><button className="text-btn" onClick={signOut}>Sign out</button></div> : profile?.role === "advertiser" ? <AdvertiserDashboard profile={profile} campaigns={campaigns} reload={() => load(session)} signOut={signOut} /> : <ViewerDashboard profile={profile} campaigns={campaigns} reload={() => load(session)} signOut={signOut} />}
      {auth && <AuthModal initialMode={auth.mode} initialRole={auth.role} close={() => setAuth(null)} success={async () => { setAuth(null); const { data } = await supabase.auth.getSession(); setSession(data.session || null); await load(data.session || null); }} />}
    </>
  );
}
