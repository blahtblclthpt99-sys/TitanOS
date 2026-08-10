import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { SpeechRecognition as NativeSpeechRecognition } from "@capgo/capacitor-speech-recognition";
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
  recordAutopilotAction,
} from "@/lib/driverActivity/autopilot";
import { acceptDenyMileStats } from "@/lib/driverActivity/trueCostPerMile";
import { buildZipBenchmarks } from "@/lib/driverActivity/zipBenchmarks";
import { listTripJournal } from "@/lib/driverActivity/tripJournal";
import { classifyRushWindow } from "@/lib/driverActivity/intelligence";
import { formatDuration } from "@/lib/driverHubApi";

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
  const [, setParams] = useSearchParams();
  const nativeVoice = Capacitor.isNativePlatform();
  const supported = nativeVoice || isVoiceSupported();
  const [listening, setListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [lastReply, setLastReply] = useState("");
  const [error, setError] = useState("");
  const recogRef = useRef(null);
  const handsFreeRef = useRef(false);
  const lastDecisionRef = useRef(null);
  const lastOfferInputRef = useRef(null);
  const restartTimerRef = useRef(null);
  const nativeListeningRef = useRef(false);

  useEffect(() => {
    handsFreeRef.current = handsFree;
  }, [handsFree]);

  const stopRecog = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recogRef.current?.stop();
    } catch {
      /* ignore */
    }
    recogRef.current = null;
    if (nativeVoice && nativeListeningRef.current) {
      nativeListeningRef.current = false;
      NativeSpeechRecognition.forceStop({ timeout: 1000 }).catch(() => {});
    }
    setListening(false);
  }, [nativeVoice]);

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
        case "navigate":
          if (cmd.payload?.tab) {
            setParams(
              (prev) => {
                const next = new URLSearchParams(prev);
                next.set("tab", cmd.payload.tab);
                return next;
              },
              { replace: true }
            );
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
        case "record_offer_action": {
          const action = cmd.payload?.action;
          if (!lastDecisionRef.current || !lastOfferInputRef.current) {
            reply = "Decide an offer first, then say I accepted or I declined.";
            break;
          }
          const saved = recordAutopilotAction(
            userId,
            lastDecisionRef.current,
            lastOfferInputRef.current,
            action
          );
          if (!saved) {
            reply = "I couldn't save that choice. Try the buttons on the offer card.";
            break;
          }
          const learned = acceptDenyMileStats(userId);
          onDecision?.(lastDecisionRef.current, lastOfferInputRef.current, action);
          reply = learned.personal_floor_per_mile != null
            ? `${action === "ACCEPT" ? "Accepted" : "Declined"} saved. Your learned minimum is now ${learned.personal_floor_per_mile.toFixed(2)} dollars per mile.`
            : `${action === "ACCEPT" ? "Accepted" : "Declined"} saved. Keep recording choices so I can learn your minimum.`;
          break;
        }
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
          lastOfferInputRef.current = cmd.payload;
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
      setParams,
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
    async (continuous = false) => {
      if (nativeVoice) {
        stopRecog();
        setError("");
        try {
          const permission = await NativeSpeechRecognition.requestPermissions();
          if (permission.speechRecognition !== "granted") {
            handsFreeRef.current = false;
            setHandsFree(false);
            setError("Microphone blocked — allow microphone access in TitanOS app settings.");
            return;
          }
          const availability = await NativeSpeechRecognition.available();
          if (!availability.available) {
            handsFreeRef.current = false;
            setHandsFree(false);
            setError("Speech recognition is not installed or enabled on this Android device.");
            return;
          }
          let useOnDeviceRecognition = false;
          try {
            const onDevice = await NativeSpeechRecognition.isOnDeviceRecognitionAvailable({
              language: "en-US",
            });
            useOnDeviceRecognition = Boolean(onDevice.available);
          } catch {
            // The standard Android recognizer remains available as a fallback.
          }

          nativeListeningRef.current = true;
          setListening(true);
          const result = await NativeSpeechRecognition.start({
            language: "en-US",
            maxResults: 3,
            popup: false,
            partialResults: false,
            allowForSilence: 1200,
            useOnDeviceRecognition,
            contextualStrings: [
              "TitanOS",
              "TitanCom",
              "accept",
              "decline",
              "miles",
              "minutes",
              "start driving",
              "read timers",
            ],
          });
          const transcript = result.matches?.find((match) => String(match || "").trim());
          if (transcript) await handleResult(transcript);
        } catch (err) {
          const message = String(err?.message || err || "Native speech recognition failed.");
          const blocked = /permission|not.?allowed|denied/i.test(message);
          if (blocked) {
            handsFreeRef.current = false;
            setHandsFree(false);
          }
          if (!/cancel|abort|no.?match|no.?speech/i.test(message)) {
            setError(blocked
              ? "Microphone blocked — allow microphone access in TitanOS app settings."
              : `Voice error: ${message}`);
          }
        } finally {
          nativeListeningRef.current = false;
          setListening(false);
          if (continuous && handsFreeRef.current) {
            restartTimerRef.current = window.setTimeout(() => {
              restartTimerRef.current = null;
              if (handsFreeRef.current) startListen(true);
            }, 350);
          }
        }
        return;
      }

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
        if (err === "not-allowed" || err === "service-not-allowed") {
          handsFreeRef.current = false;
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
          restartTimerRef.current = window.setTimeout(() => {
            restartTimerRef.current = null;
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
        handsFreeRef.current = false;
        setHandsFree(false);
        setError(e?.message || "Couldn’t start microphone.");
        setListening(false);
      }
    },
    [handleResult, nativeVoice, stopRecog]
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
            Decide offers, start/end drive, pause, money mode, open logbook — just talk. I speak
            ACCEPT or DENY with $/mi vs your all-in floor; you still tap the gig app.
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
