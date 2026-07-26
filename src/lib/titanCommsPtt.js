/**
 * TitanCom PTT session — Supabase Realtime presence/signaling + WebRTC audio.
 * Warm mic, mesh kept across presses, TURN when configured, explicit reconnect.
 */
import { Capacitor } from "@capacitor/core";
import { supabase, isSupabaseConfigured } from "@/api/supabaseClient";
import { assertCanJoinVoice } from "@/lib/titanCommsApi";

const FLOOR_LEASE_MS = 45_000;
const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 12_000;

function stunServers() {
  return [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
}

/** STUN + optional TURN from VITE_TURN_URLS / USERNAME / CREDENTIAL. */
export function buildIceServers() {
  const servers = [...stunServers()];
  const urlsRaw = String(import.meta.env?.VITE_TURN_URLS || "").trim();
  if (!urlsRaw) return servers;
  const urls = urlsRaw.split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls.length) return servers;
  const username = String(import.meta.env?.VITE_TURN_USERNAME || "").trim();
  const credential = String(import.meta.env?.VITE_TURN_CREDENTIAL || "").trim();
  const entry = { urls };
  if (username) entry.username = username;
  if (credential) entry.credential = credential;
  servers.push(entry);
  return servers;
}

function displayName(user) {
  return user?.full_name || user?.email?.split("@")[0] || "Crew member";
}

function micConstraints() {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      // Let the OS route to Bluetooth / wired headset when available
      channelCount: 1,
    },
    video: false,
  };
}

export class TitanCommsSession {
  constructor({ user, channelId, voiceStatus = "available", shareLocation = false, onState }) {
    this.user = user;
    this.channelId = channelId;
    this.voiceStatus = voiceStatus;
    this.shareLocation = shareLocation;
    this.onState = onState || (() => {});
    this.rt = null;
    this.peers = new Map(); // peerUserId -> { pc, audioEl }
    this.localStream = null;
    this.micReady = false;
    this.talking = false;
    this.floorHolder = null;
    this.floorName = null;
    this.floorClaimAt = 0;
    this.members = [];
    this.connected = false;
    this.reconnecting = false;
    this.error = null;
    this.audioHint = null;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._floorWatch = null;
    this._disposed = false;
    this._onOnline = null;
    this._onVisible = null;
    this._iceServers = buildIceServers();
  }

  _emit(patch = {}) {
    this.onState({
      connected: this.connected,
      reconnecting: this.reconnecting,
      talking: this.talking,
      floorHolder: this.floorHolder,
      floorName: this.floorName,
      members: this.members,
      error: this.error,
      micReady: this.micReady,
      audioHint: this.audioHint,
      hasTurn: this._iceServers.some((s) => {
        const u = s.urls;
        const list = Array.isArray(u) ? u : [u];
        return list.some((x) => String(x).startsWith("turn"));
      }),
      ...patch,
    });
  }

  async connect() {
    if (this._disposed) return;
    if (!isSupabaseConfigured()) {
      this.error = "Supabase is not configured — live PTT needs Realtime.";
      this._emit();
      return;
    }
    if (!this.user?.id || !this.channelId) return;

    const access = assertCanJoinVoice(this.user, this.channelId);
    if (!access.ok) {
      this.error = access.reason || "No permission for this channel.";
      this.connected = false;
      this._emit();
      return;
    }

    this._bindLifecycle();
    await this._subscribeChannel();
    // Warm mic in background — PTT then only unmutes
    this._ensureMic().catch(() => {});
  }

  _bindLifecycle() {
    if (this._onOnline) return;
    this._onOnline = () => {
      if (!this.connected && !this._disposed) this._scheduleReconnect(0);
    };
    this._onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if (!this.connected && !this._disposed) this._scheduleReconnect(0);
        // Nudge receive audio after returning from background
        for (const { audioEl } of this.peers.values()) {
          audioEl.play?.().catch(() => {});
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("online", this._onOnline);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._onVisible);
    }

    if (Capacitor.isNativePlatform()) {
      this.audioHint =
        "Native: keep TitanCom open for reliable receive. Background/Bluetooth keep-alive is best-effort until an audio-session plugin is installed.";
    } else {
      this.audioHint =
        "Browser tabs may pause audio in the background. Use Bluetooth/wired headsets via the OS audio route.";
    }
  }

  _unbindLifecycle() {
    if (typeof window !== "undefined" && this._onOnline) {
      window.removeEventListener("online", this._onOnline);
    }
    if (typeof document !== "undefined" && this._onVisible) {
      document.removeEventListener("visibilitychange", this._onVisible);
    }
    this._onOnline = null;
    this._onVisible = null;
  }

  async _subscribeChannel() {
    if (this._disposed) return;

    if (this.rt) {
      try {
        await supabase.removeChannel(this.rt);
      } catch {
        /* */
      }
      this.rt = null;
    }

    const topic = `titan-comms:${this.channelId}`;
    this.rt = supabase.channel(topic, {
      config: {
        presence: { key: this.user.id },
        broadcast: { self: false },
      },
    });

    this.rt.on("presence", { event: "sync" }, () => {
      const state = this.rt.presenceState();
      const members = [];
      for (const [key, metas] of Object.entries(state)) {
        const meta = metas?.[0] || {};
        members.push({
          userId: key,
          name: meta.name || "Crew",
          status: meta.status || "available",
          speaking: Boolean(meta.speaking),
          lat: meta.lat ?? null,
          lng: meta.lng ?? null,
          self: key === this.user.id,
        });
      }
      members.sort((a, b) => a.name.localeCompare(b.name));
      this.members = members;
      this._pruneMissingPeers();
      this._emit();
    });

    this.rt.on("broadcast", { event: "signal" }, ({ payload }) => {
      this._onSignal(payload).catch((err) => {
        console.warn("[TitanCom] signal error", err);
      });
    });

    this.rt.on("broadcast", { event: "floor" }, ({ payload }) => {
      if (!payload) return;
      if (payload.type === "claim") {
        this.floorHolder = payload.userId;
        this.floorName = payload.name || "Someone";
        this.floorClaimAt = payload.at || Date.now();
        this._armFloorWatch();
        this._emit();
      } else if (payload.type === "release") {
        if (this.floorHolder === payload.userId) {
          this.floorHolder = null;
          this.floorName = null;
          this.floorClaimAt = 0;
          this._clearFloorWatch();
          this._emit();
        }
        // Keep mesh; only mute remote if they stopped talking (tracks end naturally)
      } else if (payload.type === "sos") {
        this._emit({ sos: payload });
      }
    });

    const { error } = await this.rt.subscribe(async (status) => {
      if (this._disposed) return;
      if (status === "SUBSCRIBED") {
        this.connected = true;
        this.reconnecting = false;
        this._reconnectAttempt = 0;
        this.error = null;
        await this._trackPresence({ speaking: this.talking });
        this._emit();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.connected = false;
        this.error = "Realtime dropped — reconnecting…";
        this._emit();
        this._scheduleReconnect();
      }
    });

    if (error) {
      this.error = error.message;
      this.connected = false;
      this._emit();
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect(forceDelayMs) {
    if (this._disposed || this._reconnectTimer) return;
    this.reconnecting = true;
    const attempt = this._reconnectAttempt++;
    const delay =
      forceDelayMs != null
        ? forceDelayMs
        : Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 4));
    this.error = `Realtime dropped — reconnecting${attempt > 0 ? ` (${attempt + 1})` : ""}…`;
    this._emit();
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      if (this._disposed) return;
      try {
        await this._subscribeChannel();
      } catch (err) {
        this.error = err?.message || "Reconnect failed";
        this._emit();
        this._scheduleReconnect();
      }
    }, delay);
  }

  /** Manual reconnect from UI. */
  async reconnectNow() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempt = 0;
    this.reconnecting = true;
    this.error = "Reconnecting…";
    this._emit();
    await this._subscribeChannel();
  }

  _armFloorWatch() {
    this._clearFloorWatch();
    this._floorWatch = setInterval(() => {
      if (!this.floorHolder || this.floorHolder === this.user.id) return;
      if (Date.now() - (this.floorClaimAt || 0) > FLOOR_LEASE_MS) {
        this.floorHolder = null;
        this.floorName = null;
        this.floorClaimAt = 0;
        this._clearFloorWatch();
        this._emit();
      }
    }, 2000);
  }

  _clearFloorWatch() {
    if (this._floorWatch) {
      clearInterval(this._floorWatch);
      this._floorWatch = null;
    }
  }

  async _ensureMic() {
    if (this.localStream) {
      this.micReady = true;
      return this.localStream;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error("Microphone not available in this browser.");
    }
    const stream = await navigator.mediaDevices.getUserMedia(micConstraints());
    for (const track of stream.getAudioTracks()) {
      track.enabled = false; // warm but muted until PTT
    }
    this.localStream = stream;
    this.micReady = true;
    this._emit();
    return stream;
  }

  _setMicEnabled(on) {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = Boolean(on);
    }
  }

  async _trackPresence(extra = {}) {
    if (!this.rt) return;
    let lat = null;
    let lng = null;
    if (this.shareLocation && navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 4000,
            maximumAge: 60000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        /* privacy / denied */
      }
    }
    await this.rt.track({
      name: displayName(this.user),
      status: this.voiceStatus,
      speaking: Boolean(extra.speaking),
      lat,
      lng,
      at: Date.now(),
    });
  }

  async setVoiceStatus(status) {
    this.voiceStatus = status;
    await this._trackPresence({ speaking: this.talking });
  }

  async setShareLocation(on) {
    this.shareLocation = Boolean(on);
    await this._trackPresence({ speaking: this.talking });
  }

  async startTalk() {
    if (this.talking) return { ok: true };
    if (this.voiceStatus === "dnd" || this.voiceStatus === "offline") {
      return { ok: false, reason: "Set status to Available before talking." };
    }
    if (this.floorHolder && this.floorHolder !== this.user.id) {
      const stale = Date.now() - (this.floorClaimAt || 0) > FLOOR_LEASE_MS;
      if (!stale) {
        return { ok: false, reason: `${this.floorName || "Someone"} has the floor.` };
      }
      this.floorHolder = null;
      this.floorName = null;
    }
    if (!this.connected) {
      return { ok: false, reason: "Not connected — tap Reconnect." };
    }

    try {
      await this._ensureMic();
    } catch {
      return { ok: false, reason: "Microphone permission denied." };
    }

    this._setMicEnabled(true);
    this.talking = true;
    this.floorHolder = this.user.id;
    this.floorName = displayName(this.user);
    this.floorClaimAt = Date.now();
    this._armFloorWatch();

    await this.rt.send({
      type: "broadcast",
      event: "floor",
      payload: {
        type: "claim",
        userId: this.user.id,
        name: displayName(this.user),
        at: this.floorClaimAt,
        leaseMs: FLOOR_LEASE_MS,
      },
    });
    await this._trackPresence({ speaking: true });

    const peers = this.members.filter((m) => !m.self).map((m) => m.userId);
    await Promise.all(peers.map((peerId) => this._ensureSendTo(peerId)));
    this._emit();
    return { ok: true };
  }

  async stopTalk() {
    if (!this.talking) {
      this._setMicEnabled(false);
      return;
    }
    this.talking = false;
    this._setMicEnabled(false);

    // Keep peer connections for next press — only release floor + presence
    if (this.rt) {
      await this.rt.send({
        type: "broadcast",
        event: "floor",
        payload: { type: "release", userId: this.user.id },
      });
      await this._trackPresence({ speaking: false });
    }
    if (this.floorHolder === this.user.id) {
      this.floorHolder = null;
      this.floorName = null;
      this.floorClaimAt = 0;
      this._clearFloorWatch();
    }
    this._emit();
  }

  async sendSos({ lat = null, lng = null, note = "" } = {}) {
    if (!this.rt || !this.connected) return { ok: false, reason: "Not connected." };
    const payload = {
      type: "sos",
      userId: this.user.id,
      name: displayName(this.user),
      lat,
      lng,
      note,
      at: Date.now(),
      channelId: this.channelId,
    };
    await this.rt.send({ type: "broadcast", event: "floor", payload });
    this.voiceStatus = "emergency";
    await this._trackPresence({ speaking: false });
    this._emit({ sos: payload });
    return { ok: true };
  }

  async _ensureSendTo(peerId) {
    const entry = this.peers.get(peerId);
    const pc = this._ensurePeer(peerId);
    let needOffer = !entry?.offered || !pc.localDescription;
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) {
          if (sender.track?.id !== track.id) {
            await sender.replaceTrack(track);
          }
        } else {
          pc.addTrack(track, this.localStream);
          needOffer = true;
        }
      }
    }
    if (!needOffer) return;
    if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      const peer = this.peers.get(peerId);
      if (peer) peer.offered = true;
      await this.rt.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "offer",
          from: this.user.id,
          to: peerId,
          sdp: pc.localDescription,
        },
      });
    } catch (err) {
      console.warn("[TitanCom] offer failed", err);
    }
  }

  _ensurePeer(peerId) {
    let entry = this.peers.get(peerId);
    if (entry) return entry.pc;

    const pc = new RTCPeerConnection({ iceServers: this._iceServers });
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.setAttribute("playsinline", "true");
    audioEl.dataset.peer = peerId;
    try {
      audioEl.setAttribute("webkit-playsinline", "true");
    } catch {
      /* */
    }
    document.body.appendChild(audioEl);

    pc.onicecandidate = (ev) => {
      if (!ev.candidate || !this.rt) return;
      this.rt.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "ice",
          from: this.user.id,
          to: peerId,
          candidate: ev.candidate,
        },
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "failed") {
        this._restartIce(peerId).catch(() => {});
      }
      if (state === "disconnected") {
        setTimeout(() => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            this._restartIce(peerId).catch(() => {});
          }
        }, 1500);
      }
    };

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) {
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      }
    };

    this.peers.set(peerId, { pc, audioEl, offered: false });
    return pc;
  }

  async _restartIce(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry || !this.rt || !this.connected) return;
    const { pc } = entry;
    try {
      if (typeof pc.restartIce === "function") pc.restartIce();
      const offer = await pc.createOffer({ iceRestart: true, offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      entry.offered = true;
      await this.rt.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "offer",
          from: this.user.id,
          to: peerId,
          sdp: pc.localDescription,
          iceRestart: true,
        },
      });
    } catch (err) {
      console.warn("[TitanCom] ICE restart failed", err);
      this.error = "Peer audio path failed — release and hold Talk again.";
      this._emit();
    }
  }

  async _onSignal(payload) {
    if (!payload || payload.to !== this.user.id) return;
    const { from, type } = payload;

    if (type === "offer") {
      const pc = this._ensurePeer(from);
      await pc.setRemoteDescription(payload.sdp);
      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          const already = pc.getSenders().some((s) => s.track?.id === track.id);
          if (!already) pc.addTrack(track, this.localStream);
        }
        // Keep muted unless we are transmitting
        this._setMicEnabled(this.talking);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.rt.send({
        type: "broadcast",
        event: "signal",
        payload: {
          type: "answer",
          from: this.user.id,
          to: from,
          sdp: pc.localDescription,
        },
      });
      return;
    }

    if (type === "answer") {
      const entry = this.peers.get(from);
      if (!entry) return;
      await entry.pc.setRemoteDescription(payload.sdp);
      return;
    }

    if (type === "ice") {
      const entry = this.peers.get(from);
      if (!entry || !payload.candidate) return;
      try {
        await entry.pc.addIceCandidate(payload.candidate);
      } catch {
        /* ignore late ICE */
      }
    }
  }

  _pruneMissingPeers() {
    const live = new Set(this.members.filter((m) => !m.self).map((m) => m.userId));
    for (const peerId of [...this.peers.keys()]) {
      if (!live.has(peerId)) this._teardownPeer(peerId);
    }
  }

  _teardownPeer(peerId) {
    const entry = this.peers.get(peerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {
      /* */
    }
    entry.audioEl.srcObject = null;
    entry.audioEl.remove();
    this.peers.delete(peerId);
  }

  async disconnect() {
    this._disposed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._clearFloorWatch();
    this._unbindLifecycle();
    await this.stopTalk();
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
      this.micReady = false;
    }
    for (const peerId of [...this.peers.keys()]) {
      this._teardownPeer(peerId);
    }
    if (this.rt) {
      try {
        await this.rt.untrack();
      } catch {
        /* */
      }
      try {
        await supabase.removeChannel(this.rt);
      } catch {
        /* */
      }
      this.rt = null;
    }
    this.connected = false;
    this.reconnecting = false;
    this.members = [];
    this.floorHolder = null;
    this.floorName = null;
    this._emit();
  }
}
