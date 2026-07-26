/**
 * TitanCom PTT session — Supabase Realtime presence/signaling + WebRTC audio.
 * Mesh topology (good for small crews). Uses public STUN; TURN is a later add-on.
 */
import { supabase, isSupabaseConfigured } from "@/api/supabaseClient";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }];

function displayName(user) {
  return user?.full_name || user?.email?.split("@")[0] || "Crew member";
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
    this.talking = false;
    this.floorHolder = null;
    this.floorName = null;
    this.members = [];
    this.connected = false;
    this.error = null;
    this._unsub = null;
  }

  _emit(patch = {}) {
    this.onState({
      connected: this.connected,
      talking: this.talking,
      floorHolder: this.floorHolder,
      floorName: this.floorName,
      members: this.members,
      error: this.error,
      ...patch,
    });
  }

  async connect() {
    if (!isSupabaseConfigured()) {
      this.error = "Supabase is not configured — live PTT needs Realtime.";
      this._emit();
      return;
    }
    if (!this.user?.id || !this.channelId) return;

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
        this._emit();
      } else if (payload.type === "release") {
        if (this.floorHolder === payload.userId) {
          this.floorHolder = null;
          this.floorName = null;
          this._emit();
        }
        if (payload.userId !== this.user.id) {
          this._teardownPeer(payload.userId);
        }
      } else if (payload.type === "sos") {
        this._emit({ sos: payload });
      }
    });

    const { error } = await this.rt.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        this.connected = true;
        this.error = null;
        await this._trackPresence({ speaking: false });
        this._emit();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.connected = false;
        this.error = "Realtime connection issue — retrying…";
        this._emit();
      }
    });

    if (error) {
      this.error = error.message;
      this._emit();
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
      return { ok: false, reason: `${this.floorName || "Someone"} has the floor.` };
    }
    if (!this.connected) {
      return { ok: false, reason: "Not connected to channel yet." };
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      return { ok: false, reason: "Microphone permission denied." };
    }

    this.talking = true;
    this.floorHolder = this.user.id;
    this.floorName = displayName(this.user);
    await this.rt.send({
      type: "broadcast",
      event: "floor",
      payload: { type: "claim", userId: this.user.id, name: displayName(this.user) },
    });
    await this._trackPresence({ speaking: true });

    const peers = this.members.filter((m) => !m.self).map((m) => m.userId);
    await Promise.all(peers.map((peerId) => this._offerTo(peerId)));
    this._emit();
    return { ok: true };
  }

  async stopTalk() {
    if (!this.talking) return;
    this.talking = false;
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    for (const peerId of [...this.peers.keys()]) {
      this._teardownPeer(peerId);
    }
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

  async _offerTo(peerId) {
    const pc = this._ensurePeer(peerId);
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const already = pc.getSenders().some((s) => s.track?.id === track.id);
        if (!already) pc.addTrack(track, this.localStream);
      }
    }
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
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
  }

  _ensurePeer(peerId) {
    let entry = this.peers.get(peerId);
    if (entry) return entry.pc;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.playsInline = true;
    audioEl.dataset.peer = peerId;
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

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      if (stream) {
        audioEl.srcObject = stream;
        audioEl.play().catch(() => {});
      }
    };

    this.peers.set(peerId, { pc, audioEl });
    return pc;
  }

  async _onSignal(payload) {
    if (!payload || payload.to !== this.user.id) return;
    const { from, type } = payload;

    if (type === "offer") {
      const pc = this._ensurePeer(from);
      await pc.setRemoteDescription(payload.sdp);
      if (this.localStream && this.talking) {
        for (const track of this.localStream.getTracks()) {
          const already = pc.getSenders().some((s) => s.track?.id === track.id);
          if (!already) pc.addTrack(track, this.localStream);
        }
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
    await this.stopTalk();
    for (const peerId of [...this.peers.keys()]) {
      this._teardownPeer(peerId);
    }
    if (this.rt) {
      try {
        await this.rt.untrack();
      } catch {
        /* */
      }
      await supabase.removeChannel(this.rt);
      this.rt = null;
    }
    this.connected = false;
    this.members = [];
    this.floorHolder = null;
    this.floorName = null;
    this._emit();
  }
}
