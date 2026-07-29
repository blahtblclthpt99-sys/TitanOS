import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  parseVoiceCommand,
  speakText,
  formatDecisionSpeech,
  getSpeechRecognitionCtor,
  isVoiceSupported,
} from "@/lib/driverActivity/voiceCommands";
import {
  decideOfferSetForget,
  readAutopilotSettings,
  saveAutopilotSettings,
  logAutopilotDecision,
} from "@/lib/driverActivity/autopilot";
import { buildZipBenchmarks } from "@/lib/driverActivity/zipBenchmarks";
import { listTripJournal } from "@/lib/driverActivity/tripJournal";
import { classifyRushWindow } from "@/lib/driverActivity/intelligence";
import { formatDuration } from "@/lib/driverHubApi";
import {
  acceptNewOrder,
  arriveAtCustomer,
  arriveAtRestaurant,
  cancelDelivery,
  completeDelivery,
  createDelivery,
  departRestaurant,
  lastKnownGps,
  rejectNewOrder,
  readActiveDelivery,
  saveDeliverySnapshot,
} from "@/lib/driverActivity/doorDashWorkflow";

const FOLDER_VOICE_GUIDE = {
  "live-shift": "Live Shift: say start driving, pause, resume, or end shift.",
  doordash:
    "DoorDash: say start delivery single or double, add double, reject order, arrived restaurant, depart restaurant, arrived customer, or order delivered.",
  "trip-history": "Trip History: say open trip history, search hub for a ZIP, or open reports for exports.",
  analytics: "Analytics: say open analytics, open performance, open rush intelligence, or what is next.",
  rush: "Rush Intelligence: say open rush intelligence, then read timers to compare your window pacing.",
  platforms: "Platform Statistics: say open platform statistics to review app-by-app performance.",
  heatmaps: "Heat Maps: say open heat maps, then search hub for a ZIP to jump to recent matching history.",
  performance: "Performance: say open performance, then ask what is next for your next best action.",
  ai: "AI Insights: say open ai insights, then ask what is next to get a practical recommendation.",
  goals: "Goals: say open goals and keep busy mode or high roller to tune your offer strategy.",
  vehicle: "Vehicle: say open vehicle and max money mode to protect your all-in cost floor.",
  tax: "Tax Center: say open tax center, then open reports when you need exportable records.",
  reports: "Reports: say open reports, then export report from the report panel.",
  maintenance: "Maintenance: say open maintenance to review reminders and service windows.",
  directory: "Find Drivers: say open find drivers or search hub for a city or ZIP.",
  settings: "Settings: say open settings to adjust GPS, privacy, and driving preferences.",
};

function teachReply(topic) {
  if (topic === "delivery") {
    return "Delivery training: start delivery double. Then say arrived restaurant, depart restaurant, arrived customer, and order delivered. Say cancel delivery only if needed.";
  }
  if (topic === "hub") {
    return "Hub training: open analytics, open tax center, open reports, search hub for 75201, clear hub search, and refresh driver hub.";
  }
  if (topic === "offers") {
    return "Offer training: say decide fourteen fifty, four miles, eighteen minutes. Then use max money mode, keep busy, or high roller.";
  }
  return "Training: say start driving, decide fourteen fifty four miles eighteen minutes, open analytics, and what is next.";
}

/**
 * Hands-free voice coach for Driver Hub — speak offers & commands, hear ACCEPT/DENY.
 */
export default function DriverVoiceCoach({
  userId,
  mpg = 22,
  gasUsd = 3.5,
  defaultZip = "",
  history = [],
  drivingActive = false,
  sessionPaused = false,
  dash = null,
  onStartDriving,
  onStopDriving,
  onPause,
  onResume,
  onDecision,
}) {
  const navigate = useNavigate();
  const supported = isVoiceSupported();
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState("");
  const recogRef = useRef(null);
  const handsFreeRef = useRef(false);
  const lastDecisionRef = useRef(null);
  const pendingActionRef = useRef(null);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  const stopRecog = useCallback(() => {
    try {
      recogRef.current?.stop();
    } catch {
      /* ignore */
    }
    recogRef.current = null;
    setListening(false);
  }, []);

  const runIntent = useCallback(
    async (cmd) => {
      const settings = readAutopilotSettings(userId);
      let reply = cmd.reply;
      let decision = null;

      switch (cmd.intent) {
        case "help":
        case "clarify_offer":
        case "unknown":
        case "empty":
        case "export_report":
          break;
        case "teach_mode":
          reply = teachReply(cmd.payload?.topic);
          break;
        case "hub_folder_help": {
          const folderId = cmd.payload?.folderId;
          reply = FOLDER_VOICE_GUIDE[folderId] || "Say open analytics, open reports, open tax center, or open settings.";
          break;
        }
        case "what_next": {
          const activeDelivery = userId ? readActiveDelivery(userId) : null;
          if (activeDelivery?.status === "active") {
            reply =
              activeDelivery.stage === "to_pickup"
                ? "You are on an active delivery. Next say arrived restaurant when you reach pickup."
                : activeDelivery.stage === "at_pickup"
                  ? "You are at pickup. Next say depart restaurant once food is loaded."
                  : activeDelivery.stage === "to_dropoff"
                    ? "You are heading to customer. Next say arrived customer at dropoff."
                    : activeDelivery.stage === "at_dropoff"
                      ? "You are at dropoff. Next say order delivered to close this trip."
                      : "You have an active delivery. Continue with delivery stage commands.";
            break;
          }
          if (!drivingActive) {
            reply = "Next: say start driving, then speak an offer like decide fourteen fifty, four miles, eighteen minutes.";
            break;
          }
          reply =
            "Next: keep driving and either ask me to decide your next offer, or say open analytics for performance.";
          break;
        }
        case "confirm_action": {
          const pending = pendingActionRef.current;
          if (!pending?.intent) {
            reply = "Nothing is waiting for confirmation.";
            break;
          }
          if (Date.now() - Number(pending.createdAt || 0) > 20000) {
            pendingActionRef.current = null;
            reply = "That confirmation expired. Say the command again.";
            break;
          }
          pendingActionRef.current = null;
          return runIntent({
            ...pending,
            payload: { ...(pending.payload || {}), confirmed: true },
          });
        }
        case "cancel_action":
          pendingActionRef.current = null;
          reply = "Canceled. I did not change anything.";
          break;
        case "autopilot_on":
          if (userId) saveAutopilotSettings(userId, { enabled: true });
          break;
        case "autopilot_off":
          if (userId) saveAutopilotSettings(userId, { enabled: false });
          break;
        case "set_profile":
          if (userId && cmd.payload?.profileId) {
            saveAutopilotSettings(userId, {
              enabled: true,
              profileId: cmd.payload.profileId,
            });
          }
          break;
        case "start_driving":
          if (!drivingActive) await onStartDriving?.();
          else reply = "You're already driving.";
          break;
        case "stop_driving":
          if (!cmd.payload?.confirmed) {
            pendingActionRef.current = {
              intent: "stop_driving",
              payload: {},
              createdAt: Date.now(),
            };
            reply = "Confirm stop shift to end driving, or say never mind.";
            break;
          }
          if (drivingActive) await onStopDriving?.();
          else reply = "No active drive session.";
          break;
        case "pause":
          if (drivingActive && !sessionPaused) onPause?.();
          else reply = sessionPaused ? "Already paused." : "Start driving first.";
          break;
        case "resume":
          if (drivingActive && sessionPaused) onResume?.();
          else reply = "Nothing to resume.";
          break;
        case "start_delivery": {
          if (!userId) {
            reply = "Sign in first so I can save delivery state.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (active?.status === "active") {
            reply = "A delivery is already active. Say cancel delivery or order delivered first.";
            break;
          }
          const created = createDelivery({
            orderTypeId: cmd.payload?.orderTypeId || "single",
            gps: lastKnownGps(),
          });
          saveDeliverySnapshot(userId, created);
          break;
        }
        case "accept_delivery_addon": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const count = Math.max(1, Number(cmd.payload?.count || 1));
          let next = active;
          for (let i = 0; i < count; i += 1) {
            next = acceptNewOrder(next, { gps: lastKnownGps() });
          }
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "reject_delivery_addon": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const next = rejectNewOrder(active, { gps: lastKnownGps(), reason: "voice_reject" });
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "arrive_restaurant": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const next = arriveAtRestaurant(active, { gps: lastKnownGps() });
          if (next === active) {
            reply = "You can mark restaurant arrival only while driving to pickup.";
            break;
          }
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "depart_restaurant": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const next = departRestaurant(active, { gps: lastKnownGps(), auto: false });
          if (next === active) {
            reply = "You can depart only after restaurant arrival.";
            break;
          }
          saveDeliverySnapshot(userId, next, { departed: true });
          break;
        }
        case "arrive_customer": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const next = arriveAtCustomer(active, { gps: lastKnownGps() });
          if (next === active) {
            reply = "You can mark customer arrival only while driving to customer.";
            break;
          }
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "complete_delivery": {
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery. Say start delivery first.";
            break;
          }
          const next = completeDelivery(active, { gps: lastKnownGps() });
          if (next === active) {
            reply = "You can complete only after arriving at customer.";
            break;
          }
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "cancel_delivery": {
          if (!cmd.payload?.confirmed) {
            pendingActionRef.current = {
              intent: "cancel_delivery",
              payload: {},
              createdAt: Date.now(),
            };
            reply = "Confirm cancel delivery to stop this active order, or say never mind.";
            break;
          }
          if (!userId) {
            reply = "Sign in first so I can update this delivery.";
            break;
          }
          const active = readActiveDelivery(userId);
          if (!active || active.status !== "active") {
            reply = "No active delivery to cancel.";
            break;
          }
          const next = cancelDelivery(active, { gps: lastKnownGps() });
          saveDeliverySnapshot(userId, next);
          break;
        }
        case "navigate_hub":
          navigate("/driver");
          break;
        case "navigate_hub_folder": {
          const folderId = cmd.payload?.folderId;
          if (!folderId) {
            reply = "Say which Driver Hub folder to open.";
            break;
          }
          navigate(`/driver?folder=${encodeURIComponent(folderId)}`);
          break;
        }
        case "navigate_hub_search": {
          const query = String(cmd.payload?.query || "").trim();
          if (query.length < 2) {
            reply = "Say search hub for, then at least two words.";
            break;
          }
          navigate(`/driver?folder=directory&q=${encodeURIComponent(query)}`);
          break;
        }
        case "clear_hub_search":
          navigate("/driver?folder=directory");
          break;
        case "refresh_hub":
          navigate("/driver");
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("focus"));
          }
          break;
        case "navigate":
          if (cmd.payload?.tab) {
            navigate(`/driver?tab=${encodeURIComponent(cmd.payload.tab)}`);
          }
          break;
        case "navigate_path":
          if (cmd.payload?.path) navigate(cmd.payload.path);
          break;
        case "read_status": {
          const drive = formatDuration(dash?.driveSec || 0);
          const idle = formatDuration(dash?.idleSec || 0);
          const miles = dash?.miles != null ? dash.miles : "unknown";
          reply = drivingActive
            ? `Drive timer ${drive}. Idle timer ${idle}. About ${miles} miles. ${
                sessionPaused ? "Paused." : "Active."
              }`
            : "Driving is off. Say start driving when you're ready.";
          break;
        }
        case "repeat_decision":
          reply = formatDecisionSpeech(lastDecisionRef.current);
          break;
        case "decide_offer": {
          const nextSettings = {
            ...settings,
            enabled: true,
          };
          if (userId && !settings.enabled) {
            saveAutopilotSettings(userId, { enabled: true });
          }
          const journal = userId ? listTripJournal(userId) : [];
          const benchmarks = buildZipBenchmarks({
            journal,
            sessions: history,
            fallbackZip: defaultZip,
          });
          decision = decideOfferSetForget(
            {
              ...cmd.payload,
              zip: cmd.payload.zip || defaultZip,
              mpg,
              gasUsd,
            },
            {
              userId,
              settings: nextSettings,
              benchmarks,
              zip: defaultZip,
              mpg,
              gasUsd,
              rush: classifyRushWindow(new Date()),
            }
          );
          lastDecisionRef.current = decision;
          if (userId) logAutopilotDecision(userId, decision, cmd.payload);
          onDecision?.(decision, cmd.payload);
          reply = formatDecisionSpeech(decision);
          break;
        }
        default:
          reply = reply || "I couldn't do that yet.";
      }

      const spoken = reply || "Done.";
      setLastReply(spoken);
      speakText(spoken);
      return { reply: spoken, decision };
    },
    [
      userId,
      drivingActive,
      sessionPaused,
      dash,
      history,
      defaultZip,
      mpg,
      gasUsd,
      onStartDriving,
      onStopDriving,
      onPause,
      onResume,
      onDecision,
      navigate,
    ]
  );

  const handleResult = useCallback(
    async (transcript) => {
      const heard = String(transcript || "").trim();
      if (!heard) return;
      setLastHeard(heard);
      setError("");
      const cmd = parseVoiceCommand(heard);
      await runIntent(cmd);
    },
    [runIntent]
  );

  const startListen = useCallback(
    (continuous = false) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError("Voice isn’t supported in this browser. Try Chrome or Edge.");
        return;
      }
      stopRecog();
      const recog = new Ctor();
      recog.lang = "en-US";
      recog.continuous = continuous;
      recog.interimResults = false;
      recog.maxAlternatives = 1;

      recog.onstart = () => setListening(true);
      recog.onerror = (ev) => {
        const err = ev?.error || "error";
        if (err === "not-allowed") {
          setError("Microphone blocked — allow mic access for voice commands.");
          setHandsFree(false);
        } else if (err !== "aborted" && err !== "no-speech") {
          setError(`Voice error: ${err}`);
        }
        setListening(false);
      };
      recog.onend = () => {
        setListening(false);
        recogRef.current = null;
        // Restart hands-free loop
        if (handsFreeRef.current) {
          setTimeout(() => {
            if (handsFreeRef.current) startListen(true);
          }, 350);
        }
      };
      recog.onresult = (event) => {
        const result = event.results?.[event.results.length - 1];
        const transcript = result?.[0]?.transcript;
        if (transcript) handleResult(transcript);
      };

      recogRef.current = recog;
      try {
        recog.start();
      } catch (e) {
        setError(e?.message || "Couldn’t start microphone.");
        setListening(false);
      }
    },
    [handleResult, stopRecog]
  );

  useEffect(() => {
    return () => {
      handsFreeRef.current = false;
      stopRecog();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [stopRecog]);

  const toggleHandsFree = () => {
    if (!supported) {
      setError("Voice isn’t supported in this browser. Try Chrome or Edge on Android/desktop.");
      return;
    }
    if (handsFree) {
      setHandsFree(false);
      handsFreeRef.current = false;
      stopRecog();
      speakText("Voice commands off.");
      return;
    }
    setHandsFree(true);
    handsFreeRef.current = true;
    speakText("Voice on. Say help, or decide an offer.");
    startListen(true);
  };

  const pushToTalk = () => {
    if (!supported) {
      setError("Voice isn’t supported here. Use Chrome or Edge.");
      return;
    }
    if (listening && !handsFree) {
      stopRecog();
      return;
    }
    startListen(false);
  };

  return (
    <section
      className={cn(
        "mt-4 rounded-2xl border p-4 space-y-3",
        handsFree || listening
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-border bg-card/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5" /> Voice commands
          </p>
          <p className="text-sm font-semibold text-foreground mt-0.5">
            {handsFree ? "Listening — ask me anything for your shift" : "Hands-free driver coach"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Decide offers, run delivery stages, and open Hub folders like analytics, tax, reports,
            and settings by voice. I speak ACCEPT or DENY with $/mi vs your all-in floor; you
            still tap the gig app.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className={cn(
            "min-h-[48px] gap-2 flex-1",
            listening && "bg-emerald-500 text-black hover:bg-emerald-400"
          )}
          onClick={pushToTalk}
          disabled={!supported && !listening}
        >
          {listening ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
          {listening && !handsFree ? "Listening…" : "Push to talk"}
        </Button>
        <Button
          type="button"
          variant={handsFree ? "default" : "outline"}
          className="min-h-[48px] gap-2"
          onClick={toggleHandsFree}
        >
          {handsFree ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {handsFree ? "Voice ON" : "Hands-free"}
        </Button>
      </div>

      <details className="rounded-xl border border-border/70 bg-background/30 px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Voice command quick sheet
        </summary>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Keep it short while driving. Example phrases:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "start driving",
            "start delivery double",
            "add double",
            "reject order",
            "arrived restaurant",
            "arrived customer",
            "order delivered",
            "open analytics",
            "open tax center",
            "search hub for 75201",
            "clear hub search",
            "what is next",
            "teach me delivery",
            "confirm stop shift",
          ].map((sample) => (
            <span
              key={sample}
              className="rounded-full border border-border/70 bg-muted/30 px-2 py-1 text-[10px] text-foreground"
            >
              {sample}
            </span>
          ))}
        </div>
      </details>

      {!supported ? (
        <p className="text-xs text-titan-amber">
          This browser doesn’t support speech recognition. Use Chrome or Edge for voice.
        </p>
      ) : null}
      {error ? <p className="text-xs text-titan-amber">{error}</p> : null}

      {lastHeard ? (
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
          <p>
            <span className="text-muted-foreground">You: </span>
            {lastHeard}
          </p>
          {lastReply ? (
            <p>
              <span className="text-muted-foreground">Titan: </span>
              {lastReply}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Try: “Decide fourteen fifty, four miles, eighteen minutes” · “Start driving” · “Max money
          mode” · “Read timers” · “Help”
        </p>
      )}
    </section>
  );
}
