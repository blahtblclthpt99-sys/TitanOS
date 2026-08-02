/**
 * TitanCom — push-to-talk channels (product name).
 * Module/file prefix remains `TitanComms` / `titanComms*` for stable imports.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  Mic,
  Plus,
  Radio,
  Siren,
  Users,
  MapPin,
  MessageSquare,
  Circle,
  Crown,
  UserPlus,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { haptic } from "@/lib/haptic";
import PageHeader from "@/components/shared/PageHeader";
import PageShell from "@/components/shared/PageShell";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import {
  VOICE_STATUSES,
  createChannel,
  deleteChannel,
  freeChannelHint,
  getShareLocation,
  getVoiceStatus,
  joinChannel,
  listChannelMessages,
  listChannels,
  postChannelMessage,
  setShareLocation,
  setVoiceStatus,
} from "@/lib/titanCommsApi";
import { canPersistTitanComChannels } from "@/lib/plan";
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
    reconnecting: false,
    talking: false,
    floorHolder: null,
    floorName: null,
    members: [],
    error: null,
    micReady: false,
    audioHint: null,
    hasTurn: false,
  });
  const [voiceStatus, setVoiceStatusUi] = useState("available");
  const [shareLoc, setShareLoc] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState("public");
  const sessionRef = useRef(null);
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

  const beginPtt = useCallback(async () => {
    if (pttActive.current) return;
    pttActive.current = true;
    try {
      haptic(12);
    } catch {
      /* ignore */
    }
    const result = await sessionRef.current?.startTalk();
    if (!result?.ok) {
      pttActive.current = false;
      toast({
        variant: "destructive",
        title: "Can't talk",
        description: result?.reason || "Try again",
      });
    }
  }, []);

  const endPtt = useCallback(async () => {
    if (!pttActive.current && !sessionRef.current?.talking) return;
    pttActive.current = false;
    await sessionRef.current?.stopTalk();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      if (e.repeat) return;
      beginPtt();
    };
    const onKeyUp = (e) => {
      if (e.code !== "Space" && e.key !== " ") return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) return;
      e.preventDefault();
      endPtt();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [beginPtt, endPtt]);

  const reconnect = async () => {
    try {
      await sessionRef.current?.reconnectNow();
    } catch (err) {
      toast({ variant: "destructive", title: "Reconnect failed", description: err?.message });
    }
  };

  const sendSos = async () => {
    let lat = null;
    let lng = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, maximumAge: 30000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* optional */
      }
    }
    const result = await sessionRef.current?.sendSos({ lat, lng, note: "SOS from TitanCom" });
    if (!result?.ok) {
      toast({ variant: "destructive", title: "SOS not sent", description: result?.reason || "Not connected" });
      return;
    }
    try {
      haptic(40);
    } catch {
      /* ignore */
    }
    toast({ title: "SOS broadcast", description: "Crew on this channel was alerted." });
    setVoiceStatusUi("emergency");
  };

  const sendText = async (e) => {
    e?.preventDefault?.();
    if (!user?.id || !draft.trim()) return;
    try {
      const { requestMessagePushPermission, getMessagePushPermission } = await import("@/lib/messagePush");
      if (getMessagePushPermission() === "default") {
        await requestMessagePushPermission();
      }
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
      const row = await createChannel(user, { name: newName.trim(), kind: newKind });
      setNewName("");
      refreshChannels();
      setChannelId(row.id);
      toast({
        title: "Channel created",
        description: row.expires_at
          ? `You're the only admin. Free channels expire tonight (${new Date(row.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).`
          : "You're the only admin. Coworkers and friends can join if it's public.",
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't create channel", description: err?.message });
    } finally {
      setCreating(false);
    }
  };

  const onJoin = async (id) => {
    try {
      await joinChannel(user, id);
      refreshChannels();
      setChannelId(id);
      toast({ title: "Joined channel" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't join", description: err?.message });
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this channel? There is no admin transfer — others will lose access.")) return;
    try {
      await deleteChannel(user, id);
      refreshChannels();
      setChannelId("tc-dispatch");
      toast({ title: "Channel deleted" });
    } catch (err) {
      toast({ variant: "destructive", title: "Couldn't delete", description: err?.message });
    }
  };

  if (!authChecked || loading) return <PageLoader variant="list" label="Loading TitanCom" />;

  if (!user?.id) {
    return (
      <PageShell maxWidth="lg">
        <PageHeader eyebrow="Connect" title="TitanCom" subtitle="Instant push-to-talk for your crew." />
        <EmptyState
          title="Sign in to use TitanCom"
          description="Channels and live push-to-talk require an account."
          actionLabel="Sign in"
          onAction={() => {
            window.location.href = "/login";
          }}
        />
      </PageShell>
    );
  }

  const speakingNow = sessionState.talking ? "You" : sessionState.floorName;
  const persistOk = canPersistTitanComChannels(user);

  return (
    <PageShell maxWidth="lg">
      <PageHeader
        eyebrow="Connect"
        title="TitanCom"
        subtitle="Push-to-talk for coworkers and friends"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                sessionState.connected
                  ? "border-emerald-500/40 text-emerald-400"
                  : sessionState.reconnecting
                    ? "border-titan-amber/40 text-titan-amber"
                    : "border-border text-muted-foreground"
              )}
            >
              <Circle
                className={cn(
                  "w-2 h-2 fill-current",
                  sessionState.connected
                    ? "text-emerald-400"
                    : sessionState.reconnecting
                      ? "text-titan-amber animate-pulse"
                      : "text-muted-foreground"
                )}
              />
              {sessionState.connected ? "Live" : sessionState.reconnecting ? "Reconnecting" : "Offline"}
            </span>
          </div>
        }
      />

      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        Create public channels your crew can find and join. You are the only admin — no transfers.{" "}
        {freeChannelHint(user)}
      </p>

      <div className="grid lg:grid-cols-[260px_1fr] gap-4">
        <aside className="titan-surface p-3 space-y-2 h-fit">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            Channels
          </p>
          <div className="space-y-1 max-h-[42vh] overflow-y-auto">
            {channels.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border transition-colors",
                  c.id === channelId ? "border-primary/40 bg-primary/10" : "border-transparent"
                )}
              >
                <button
                  type="button"
                  onClick={() => setChannelId(c.id)}
                  className="w-full text-left rounded-xl px-3 py-3 min-h-[52px] hover:bg-muted/40"
                >
                  <p className="text-sm font-medium flex items-center gap-2">
                    {c.kind === "emergency" ? (
                      <Siren className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    ) : (
                      <Radio className="w-3.5 h-3.5 text-titan-cyan shrink-0" />
                    )}
                    <span className="truncate">{c.name}</span>
                    {c.isAdmin ? <Crown className="w-3 h-3 text-titan-amber shrink-0" aria-label="Admin" /> : null}
                  </p>
                  {c.description ? (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 pl-5">{c.description}</p>
                  ) : null}
                  {c.custom && c.expires_at ? (
                    <p className="text-[10px] text-titan-amber mt-1 pl-5">
                      Expires {new Date(c.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  ) : null}
                </button>
                {c.custom && !c.joined ? (
                  <div className="px-3 pb-2">
                    <Button type="button" size="sm" variant="outline" className="w-full min-h-[40px] gap-1" onClick={() => onJoin(c.id)}>
                      <UserPlus className="w-3.5 h-3.5" /> Join
                    </Button>
                  </div>
                ) : null}
                {c.isAdmin ? (
                  <div className="px-3 pb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="w-full min-h-[36px] text-red-400 hover:text-red-300 gap-1"
                      onClick={() => onDelete(c.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <form onSubmit={addChannel} className="pt-2 border-t border-border space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Channel name"
              maxLength={48}
              className="bg-muted border-border h-11 text-sm"
            />
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => setNewKind("public")}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-semibold min-h-[40px]",
                  newKind === "public" ? "border-titan-cyan/50 bg-titan-cyan/10 text-titan-cyan" : "border-border text-muted-foreground"
                )}
              >
                Public
              </button>
              <button
                type="button"
                onClick={() => setNewKind("private")}
                className={cn(
                  "rounded-lg border px-2 py-2 text-xs font-semibold min-h-[40px]",
                  newKind === "private" ? "border-titan-cyan/50 bg-titan-cyan/10 text-titan-cyan" : "border-border text-muted-foreground"
                )}
              >
                Private
              </button>
            </div>
            <Button type="submit" disabled={creating || !newName.trim()} className="w-full gap-1 min-h-[44px]">
              <Plus className="w-4 h-4" /> Create channel
            </Button>
            {!persistOk ? (
              <p className="text-[10px] text-muted-foreground leading-snug">
                Free: expires tonight. Upgrade to keep channels.
              </p>
            ) : null}
          </form>
        </aside>

        <section className="space-y-4">
          <div className="titan-surface p-5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-cyan-500/5 pointer-events-none" />
            <div className="relative">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Active channel</p>
                  <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                    {activeChannel?.name || "Channel"}
                    {activeChannel?.isAdmin ? (
                      <span className="text-[10px] font-bold uppercase text-titan-amber border border-titan-amber/40 px-1.5 py-0.5 rounded">
                        Admin
                      </span>
                    ) : null}
                    {String(activeChannel?.id || "").startsWith("tc-") ? (
                      <span className="text-[10px] font-bold uppercase text-sky-300 border border-sky-500/40 px-1.5 py-0.5 rounded">
                        Open network
                      </span>
                    ) : null}
                    {activeChannel?.kind === "emergency" && (
                      <span className="text-[10px] font-bold uppercase text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded">
                        Urgent
                      </span>
                    )}
                  </h2>
                  {sessionState.error && <p className="text-xs text-titan-amber mt-1">{sessionState.error}</p>}
                  {!sessionState.hasTurn ? (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      STUN only — set VITE_TURN_* for hard NATs.
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={voiceStatus}
                    onChange={(e) => onStatusChange(e.target.value)}
                    className="h-11 rounded-lg bg-muted border border-border text-sm px-2 text-foreground min-w-[140px]"
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
                    variant="outline"
                    onClick={onShareToggle}
                    className={cn("gap-1 min-h-[44px]", shareLoc && "border-sky-500/50 text-sky-300")}
                  >
                    <MapPin className="w-4 h-4" />
                    {shareLoc ? "GPS on" : "GPS off"}
                  </Button>
                  {!sessionState.connected ? (
                    <Button type="button" variant="outline" onClick={reconnect} className="min-h-[44px]">
                      Reconnect
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendSos}
                    className="gap-1 min-h-[44px] border-red-500/40 text-red-400 hover:text-red-300"
                  >
                    <Siren className="w-4 h-4" />
                    SOS
                  </Button>
                </div>
              </div>

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

              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  type="button"
                  aria-label="Push to talk — hold to speak"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    beginPtt();
                  }}
                  onPointerUp={endPtt}
                  onPointerLeave={endPtt}
                  onPointerCancel={endPtt}
                  onLostPointerCapture={endPtt}
                  onContextMenu={(e) => e.preventDefault()}
                  className={cn(
                    "relative w-44 h-44 sm:w-52 sm:h-52 rounded-full select-none touch-manipulation",
                    "flex flex-col items-center justify-center gap-2",
                    "font-bold text-base tracking-wide transition-transform active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-titan-cyan/40",
                    sessionState.talking
                      ? "bg-titan-cyan text-black shadow-[0_0_48px_rgba(34,211,238,0.6)]"
                      : "bg-gradient-to-b from-slate-600 to-slate-900 text-foreground border-2 border-sky-400/40 shadow-[0_0_36px_rgba(14,165,233,0.35)]"
                  )}
                >
                  <Mic className={cn("w-14 h-14", sessionState.talking && "animate-pulse")} />
                  {sessionState.talking ? "RELEASE" : "HOLD TO TALK"}
                </button>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Hold the circle or Space — release to stop.
                  {sessionState.micReady ? " Mic warmed." : ""}
                </p>
                {sessionState.audioHint ? (
                  <p className="text-[11px] text-muted-foreground/80 text-center max-w-sm leading-snug">
                    {sessionState.audioHint}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="titan-surface p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-titan-cyan" /> On channel
                <span className="text-xs text-muted-foreground font-normal">({sessionState.members.length})</span>
              </h3>
              {sessionState.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No one else live yet. Open TitanCom on another signed-in device to talk.
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
                      <p className="text-foreground/90">{m.body}</p>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendText} className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message this channel…"
                  className="bg-muted border-border h-11"
                />
                <Button type="submit" disabled={!draft.trim()} className="min-h-[44px] px-4">
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
