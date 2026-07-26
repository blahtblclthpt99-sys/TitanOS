import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Mic,
  Plus,
  Radio,
  Siren,
  Users,
  MapPin,
  MessageSquare,
  Circle,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import FeatureHonestyBanner from "@/components/shared/FeatureHonestyBanner";
import { cn } from "@/lib/utils";
import {
  VOICE_STATUSES,
  createChannel,
  getShareLocation,
  getVoiceStatus,
  listChannelMessages,
  listChannels,
  postChannelMessage,
  setShareLocation,
  setVoiceStatus,
} from "@/lib/titanCommsApi";
import { TitanCommsSession } from "@/lib/titanCommsPtt";
import { isSupabaseConfigured } from "@/api/supabaseClient";

export default function TitanComms() {
  const { user, authChecked } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState(searchParams.get("channel") || "tc-dispatch");
  const [loading, setLoading] = useState(true);
  const [sessionState, setSessionState] = useState({
    connected: false,
    talking: false,
    floorHolder: null,
    floorName: null,
    members: [],
    error: null,
  });
  const [voiceStatus, setVoiceStatusUi] = useState("available");
  const [shareLoc, setShareLoc] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [sosHold, setSosHold] = useState(0);
  const sessionRef = useRef(null);
  const sosTimerRef = useRef(null);
  const pttActive = useRef(false);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === channelId) || channels[0],
    [channels, channelId]
  );

  const refreshChannels = useCallback(() => {
    if (!user?.id) return;
    setChannels(listChannels(user.id));
  }, [user?.id]);

  useEffect(() => {
    if (!authChecked) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setVoiceStatusUi(getVoiceStatus(user.id));
    setShareLoc(getShareLocation(user.id));
    refreshChannels();
    setLoading(false);
  }, [authChecked, user?.id, refreshChannels]);

  useEffect(() => {
    if (!channelId) return;
    setMessages(listChannelMessages(channelId));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("channel", channelId);
      return next;
    }, { replace: true });
  }, [channelId, setSearchParams]);

  // Connect / reconnect session when channel or user changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (sessionRef.current) {
        await sessionRef.current.disconnect();
        sessionRef.current = null;
      }
      if (!user?.id || !channelId || !isSupabaseConfigured()) {
        setSessionState((s) => ({
          ...s,
          connected: false,
          members: [],
          error: isSupabaseConfigured() ? null : "Configure Supabase to enable live PTT.",
        }));
        return;
      }
      const session = new TitanCommsSession({
        user,
        channelId,
        voiceStatus: getVoiceStatus(user.id),
        shareLocation: getShareLocation(user.id),
        onState: (state) => {
          if (cancelled) return;
          setSessionState(state);
          if (state.sos) {
            toast({
              variant: "destructive",
              title: `SOS from ${state.sos.name}`,
              description: state.sos.note || "Emergency alert on this channel",
            });
          }
        },
      });
      sessionRef.current = session;
      await session.connect();
    })();
    return () => {
      cancelled = true;
      sessionRef.current?.disconnect();
      sessionRef.current = null;
    };
  }, [user?.id, channelId]);

  const onStatusChange = async (status) => {
    if (!user?.id) return;
    setVoiceStatusUi(setVoiceStatus(user.id, status));
    await sessionRef.current?.setVoiceStatus(status);
  };

  const onShareToggle = async () => {
    if (!user?.id) return;
    const next = setShareLocation(user.id, !shareLoc);
    setShareLoc(next);
    await sessionRef.current?.setShareLocation(next);
  };

  const beginPtt = async () => {
    if (pttActive.current) return;
    pttActive.current = true;
    const result = await sessionRef.current?.startTalk();
    if (!result?.ok) {
      pttActive.current = false;
      toast({
        variant: "destructive",
        title: "Can't talk",
        description: result?.reason || "Try again",
      });
    }
  };

  const endPtt = async () => {
    if (!pttActive.current && !sessionState.talking) return;
    pttActive.current = false;
    await sessionRef.current?.stopTalk();
  };

  const sendText = async (e) => {
    e?.preventDefault?.();
    if (!user?.id || !draft.trim()) return;
    try {
      const row = await postChannelMessage(user, channelId, draft.trim());
      setMessages((m) => [...m, row]);
      setDraft("");
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't send", description: err?.message });
    }
  };

  const addChannel = async (e) => {
    e.preventDefault();
    if (!user?.id || !newName.trim() || creating) return;
    setCreating(true);
    try {
      const row = await createChannel(user, { name: newName.trim(), kind: "private" });
      setNewName("");
      refreshChannels();
      setChannelId(row.id);
      toast({ title: "Channel created" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't create channel", description: err?.message });
    } finally {
      setCreating(false);
    }
  };

  const startSosHold = () => {
    setSosHold(0);
    const started = Date.now();
    sosTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      setSosHold(Math.min(3, elapsed));
      if (elapsed >= 3) {
        clearInterval(sosTimerRef.current);
        sosTimerRef.current = null;
        triggerSos();
      }
    }, 50);
  };

  const cancelSosHold = () => {
    if (sosTimerRef.current) {
      clearInterval(sosTimerRef.current);
      sosTimerRef.current = null;
    }
    setSosHold(0);
  };

  const triggerSos = async () => {
    setSosHold(0);
    setChannelId("tc-emergency");
    await onStatusChange("emergency");
    let lat = null;
    let lng = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* optional */
      }
    }
    // Wait a tick for emergency channel session
    setTimeout(async () => {
      await sessionRef.current?.sendSos({ lat, lng, note: "SOS — need assistance" });
      if (user?.id) {
        const row = await postChannelMessage(user, "tc-emergency", "SOS — need assistance", "sos", {
          lat,
          lng,
        });
        setMessages((m) => [...m, row]);
      }
      toast({ variant: "destructive", title: "SOS sent", description: "Emergency channel notified" });
    }, 400);
  };

  if (!authChecked || loading) return <PageLoader variant="list" label="Loading TitanComms" />;

  if (!user?.id) {
    return (
      <PageShell maxWidth="lg">
        <PageHeader
          eyebrow="Connect · Preview"
          title="TitanComms"
          subtitle="Instant push-to-talk for your field crew."
        />
        <EmptyState
          title="Sign in to use TitanComms"
          description="Channels and live push-to-talk require an account."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = "/login";
          }}
        />
      </PageShell>
    );
  }

  const speakingNow = sessionState.talking
    ? "You"
    : sessionState.floorName;

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Connect · Preview"
        title="TitanComms"
        subtitle="Instant push-to-talk communication"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                sessionState.connected
                  ? "border-emerald-500/40 text-emerald-400"
                  : "border-border text-muted-foreground"
              )}
            >
              <Circle
                className={cn("w-2 h-2 fill-current", sessionState.connected ? "text-emerald-400" : "text-muted-foreground")}
              />
              {sessionState.connected ? "Live" : "Offline"}
            </span>
          </div>
        }
      />

      <FeatureHonestyBanner tone="info">
        MVP: hold-to-talk WebRTC over Supabase Realtime, public network channels, presence, SOS, and
        channel text. Mesh audio works best on the same Wi‑Fi/network; TURN servers, CarPlay, and
        wake-phrase hands-free come later.
      </FeatureHonestyBanner>

      <div className="grid lg:grid-cols-[240px_1fr] gap-4">
        {/* Channel list */}
        <aside className="titan-surface p-3 space-y-2 h-fit">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            Channels
          </p>
          <div className="space-y-1 max-h-[40vh] overflow-y-auto">
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannelId(c.id)}
                className={cn(
                  "w-full text-left rounded-xl px-3 py-2.5 transition-colors",
                  c.id === channelId
                    ? "bg-primary/15 text-foreground border border-primary/30"
                    : "hover:bg-muted/60 text-foreground/85"
                )}
              >
                <p className="text-sm font-medium flex items-center gap-2">
                  {c.kind === "emergency" ? (
                    <Siren className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <Radio className="w-3.5 h-3.5 text-titan-cyan" />
                  )}
                  {c.name}
                </p>
                {c.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
                )}
              </button>
            ))}
          </div>
          <form onSubmit={addChannel} className="pt-2 border-t border-border space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New private channel"
              className="bg-muted border-border h-9 text-sm"
            />
            <Button type="submit" size="sm" disabled={creating || !newName.trim()} className="w-full gap-1">
              <Plus className="w-3.5 h-3.5" /> Create
            </Button>
          </form>
        </aside>

        {/* Main radio panel */}
        <section className="space-y-4">
          <div className="titan-surface p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-cyan-500/5 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Active channel</p>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    {activeChannel?.name || "Channel"}
                    {activeChannel?.kind === "emergency" && (
                      <span className="text-[10px] font-bold uppercase text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded">
                        SOS
                      </span>
                    )}
                  </h2>
                  {sessionState.error && (
                    <p className="text-xs text-titan-amber mt-1">{sessionState.error}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={voiceStatus}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="h-9 rounded-lg bg-muted border border-border text-sm px-2 text-foreground"
                    aria-label="Voice status"
                  >
                    {VOICE_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onShareToggle}
                    className={cn("gap-1", shareLoc && "border-sky-500/50 text-sky-300")}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {shareLoc ? "GPS on" : "GPS off"}
                  </Button>
                </div>
              </div>

              {/* Live speaking indicator */}
              <div className="flex items-center justify-center gap-3 mb-4 min-h-[28px]">
                {speakingNow ? (
                  <>
                    <span className="flex gap-0.5 items-end h-5" aria-hidden>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="w-1 rounded-full bg-titan-cyan animate-pulse"
                          style={{
                            height: `${8 + ((i * 5 + (sessionState.talking ? 12 : 4)) % 16)}px`,
                            animationDelay: `${i * 80}ms`,
                          }}
                        />
                      ))}
                    </span>
                    <p className="text-sm font-medium text-titan-cyan">
                      {sessionState.talking ? "You are transmitting" : `${speakingNow} is speaking`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Channel clear — hold Talk to transmit</p>
                )}
              </div>

              {/* PTT button */}
              <div className="flex flex-col items-center gap-4 py-4">
                <button
                  type="button"
                  aria-label="Push to talk"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    beginPtt();
                  }}
                  onPointerUp={endPtt}
                  onPointerLeave={endPtt}
                  onPointerCancel={endPtt}
                  onContextMenu={(e) => e.preventDefault()}
                  className={cn(
                    "relative w-36 h-36 rounded-full select-none touch-none",
                    "flex flex-col items-center justify-center gap-1",
                    "font-semibold text-sm transition-transform active:scale-95",
                    sessionState.talking
                      ? "bg-titan-cyan text-black shadow-[0_0_40px_rgba(34,211,238,0.55)]"
                      : "bg-gradient-to-b from-slate-700 to-slate-900 text-foreground border border-sky-500/30 shadow-[0_0_28px_rgba(14,165,233,0.25)]"
                  )}
                >
                  <Mic className={cn("w-10 h-10", sessionState.talking && "animate-pulse")} />
                  {sessionState.talking ? "RELEASE" : "HOLD TO TALK"}
                </button>

                <button
                  type="button"
                  onPointerDown={startSosHold}
                  onPointerUp={cancelSosHold}
                  onPointerLeave={cancelSosHold}
                  onPointerCancel={cancelSosHold}
                  className="relative w-full max-w-xs h-12 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-semibold text-sm overflow-hidden"
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-red-400/50 transition-[width] duration-75"
                    style={{ width: `${(sosHold / 3) * 100}%` }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    <Siren className="w-4 h-4" />
                    {sosHold > 0 ? `SOS ${sosHold.toFixed(1)}s…` : "Hold 3s — SOS"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Presence + chat */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="titan-surface p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-titan-cyan" /> On channel
                <span className="text-xs text-muted-foreground font-normal">
                  ({sessionState.members.length})
                </span>
              </h3>
              {sessionState.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one else live yet. Open TitanComms on another signed-in device to test PTT.
                </p>
              ) : (
                <ul className="space-y-2 max-h-48 overflow-y-auto">
                  {sessionState.members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            m.speaking ? "bg-titan-cyan animate-pulse" : "bg-emerald-400"
                          )}
                        />
                        <span className="truncate text-foreground">
                          {m.name}
                          {m.self ? " (you)" : ""}
                        </span>
                      </span>
                      <span className="text-[11px] text-muted-foreground capitalize shrink-0">
                        {m.speaking ? "speaking" : m.status}
                        {m.lat != null && m.lng != null ? " · GPS" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="titan-surface p-4 flex flex-col">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-titan-cyan" /> Channel chat
              </h3>
              <div className="flex-1 space-y-2 max-h-40 overflow-y-auto mb-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  messages.slice(-30).map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="text-[11px] text-muted-foreground">
                        {m.sender_name || "User"} ·{" "}
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <p
                        className={cn(
                          "text-foreground/90",
                          m.message_type === "sos" && "text-red-300 font-medium"
                        )}
                      >
                        {m.body}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendText} className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message this channel…"
                  className="bg-muted border-border h-9"
                />
                <Button type="submit" size="sm" disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
