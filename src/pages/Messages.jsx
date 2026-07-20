import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import EmptyState from "@/components/shared/EmptyState";
import { useAuth } from "@/lib/AuthContext";
import { timeAgo } from "@/lib/platformConstants";
import {
  clearTyping,
  ensureDemoInbox,
  ensureThread,
  fileToAttachment,
  getTyping,
  listConversations,
  listMessages,
  markThreadRead,
  sendMessage,
  setTyping,
} from "@/lib/messagesApi";
import { getMessagePushPermission, requestMessagePushPermission } from "@/lib/messagePush";
import { listDrivers } from "@/lib/driverDirectoryApi";
import ReportBlockMenu from "@/components/shared/ReportBlockMenu";
import { isBlocked } from "@/lib/trustSafetyApi";

function Receipt({ message, isMine }) {
  if (!isMine) return null;
  if (message.read_at) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-primary" title={`Read ${timeAgo(message.read_at)}`}>
        <CheckCheck className="w-3 h-3" /> Read
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
      <Check className="w-3 h-3" /> Sent
    </span>
  );
}

function Bubble({ message, isMine }) {
  const att = message.attachment;
  return (
    <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isMine ? "items-end ml-auto" : "items-start"}`}>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isMine
            ? "bg-titan-cyan text-black rounded-br-md"
            : "bg-muted text-foreground rounded-bl-md border border-border"
        }`}
      >
        {message.type === "image" && att?.url && (
          <a href={att.url} target="_blank" rel="noreferrer" className="block mb-1.5">
            <img src={att.url} alt={att.name || "Image"} className="max-h-56 rounded-md object-cover" />
          </a>
        )}
        {message.type === "file" && att?.url && (
          <a
            href={att.url}
            download={att.name || "file"}
            className={`mb-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 ${isMine ? "bg-black/10" : "bg-background/60"}`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate text-xs font-medium">{att.name || "File"}</span>
          </a>
        )}
        {message.type === "voice" && att?.url && (
          <audio controls src={att.url} className="w-full max-w-[240px] my-1" preload="metadata" />
        )}
        {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
      </div>
      <div className="mt-1 flex items-center gap-2 px-1">
        <span className="text-[10px] text-muted-foreground">{timeAgo(message.created_at)}</span>
        <Receipt message={message} isMine={isMine} />
      </div>
    </div>
  );
}

export default function Messages() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const threadParam = params.get("thread");
  const toParam = params.get("to");
  const toName = params.get("name");

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeId, setActiveId] = useState(threadParam || null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [typingPeer, setTypingPeer] = useState(null);
  const [recording, setRecording] = useState(false);
  const [composerSearch, setComposerSearch] = useState(false);
  const [newPeers, setNewPeers] = useState([]);
  const [pushPerm, setPushPerm] = useState(() => getMessagePushPermission());

  const bottomRef = useRef(null);
  const imageRef = useRef(null);
  const fileRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const typingTimer = useRef(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (user?.id && c.peer_id && isBlocked(user.id, c.peer_id)) return false;
      if (!q) return true;
      return (
        c.peer_name?.toLowerCase().includes(q) ||
        c.last_preview?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
    });
  }, [conversations, search, user?.id]);

  const loadInbox = useCallback(
    async (silent = false) => {
      if (!user?.id) return;
      if (!silent) setLoading(true);
      try {
        await ensureDemoInbox(user);
        const rows = await listConversations(user.id);
        setConversations(rows);
      } catch {
        if (!silent) toast({ variant: "destructive", title: "Couldn't load messages" });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user]
  );

  const loadThread = useCallback(
    async (threadId, silent = false) => {
      if (!user?.id || !threadId) {
        setMessages([]);
        return;
      }
      try {
        const rows = await listMessages(user.id, threadId);
        setMessages(rows);
        await markThreadRead(user.id, threadId);
        setConversations((prev) =>
          prev.map((c) => (c.id === threadId ? { ...c, unread: 0 } : c))
        );
      } catch {
        if (!silent) toast({ variant: "destructive", title: "Couldn't load conversation" });
      }
    },
    [user?.id]
  );

  useEffect(() => {
    if (authChecked && user?.id) loadInbox();
  }, [authChecked, user?.id, loadInbox]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      loadInbox(true);
      if (activeId) loadThread(activeId, true);
      if (activeId) setTypingPeer(getTyping(activeId, user.id));
    };
    const poll = setInterval(tick, 12000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user?.id, activeId, loadInbox, loadThread]);

  useEffect(() => {
    if (threadParam) setActiveId(threadParam);
  }, [threadParam]);

  useEffect(() => {
    if (!user?.id || !toParam) return;
    (async () => {
      try {
        const thread = await ensureThread(user, {
          peerId: toParam,
          peerName: toName || "Contact",
        });
        setActiveId(thread.id);
        setParams({ thread: thread.id }, { replace: true });
        await loadInbox(true);
        await loadThread(thread.id);
      } catch {
        toast({ variant: "destructive", title: "Couldn't open chat" });
      }
    })();
  }, [user, toParam, toName, setParams, loadInbox, loadThread]);

  useEffect(() => {
    if (activeId && user?.id) loadThread(activeId);
  }, [activeId, user?.id, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingPeer]);

  const openThread = (id) => {
    setActiveId(id);
    setParams({ thread: id });
  };

  const onDraftChange = (value) => {
    setDraft(value);
    if (!activeId || !user?.id) return;
    setTyping(activeId, user.id, user.full_name || user.username || "You");
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => clearTyping(activeId, user.id), 2000);
  };

  const submitText = async (event) => {
    event?.preventDefault?.();
    if (!user || !active || sending || !draft.trim()) return;
    setSending(true);
    try {
      await sendMessage(user, {
        threadId: active.id,
        recipientId: active.peer_id,
        recipientName: active.peer_name,
        body: draft,
        type: "text",
        listingId: active.listing_id,
        hireJobId: active.hire_job_id,
      });
      setDraft("");
      clearTyping(active.id, user.id);
      await loadThread(active.id, true);
      await loadInbox(true);
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't send" });
    } finally {
      setSending(false);
    }
  };

  const sendAttachment = async (file, type) => {
    if (!user || !active || !file) return;
    setSending(true);
    try {
      const attachment = await fileToAttachment(file);
      await sendMessage(user, {
        threadId: active.id,
        recipientId: active.peer_id,
        recipientName: active.peer_name,
        body: type === "image" ? "" : attachment.name,
        type,
        attachment,
        listingId: active.listing_id,
        hireJobId: active.hire_job_id,
      });
      await loadThread(active.id, true);
      await loadInbox(true);
      toast({ title: type === "image" ? "Photo sent" : "File sent" });
    } catch (err) {
      toast({ variant: "destructive", title: err?.message || "Couldn't send attachment" });
    } finally {
      setSending(false);
    }
  };

  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({ variant: "destructive", title: "Voice messages not supported here" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await sendAttachment(file, "voice");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast({ variant: "destructive", title: "Microphone permission needed" });
    }
  };

  const enablePush = async () => {
    const result = await requestMessagePushPermission();
    setPushPerm(result);
    if (result === "granted") toast({ title: "Push notifications enabled" });
    else if (result === "denied") toast({ variant: "destructive", title: "Notifications blocked in browser" });
    else toast({ title: "Notifications unavailable" });
  };

  const startNewChat = async () => {
    setComposerSearch(true);
    try {
      const drivers = listDrivers();
      setNewPeers(
        (drivers || []).slice(0, 12).map((d) => ({
          id: d.id,
          name: d.name,
          hint: d.city ? `${d.city}${d.state ? `, ${d.state}` : ""}` : "Driver",
        }))
      );
    } catch {
      setNewPeers([]);
    }
  };

  const pickPeer = async (peer) => {
    try {
      const thread = await ensureThread(user, { peerId: peer.id, peerName: peer.name });
      setComposerSearch(false);
      openThread(thread.id);
      await loadInbox(true);
    } catch {
      toast({ variant: "destructive", title: "Couldn't start chat" });
    }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading messages" />;

  const showThread = Boolean(activeId && active);

  return (
    <div className="relative p-4 md:p-6 max-w-6xl mx-auto pb-28 md:pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-28 -right-20 w-80 h-80 rounded-full bg-titan-cyan/8 blur-[100px]" />
      </div>

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <PageHeader title="Messages" subtitle="Chats with read receipts, media, voice, and search" />
          <div className="flex flex-wrap gap-2 shrink-0">
            {pushPerm !== "granted" && pushPerm !== "unsupported" && (
              <Button type="button" variant="outline" className="rounded-md" onClick={enablePush}>
                Enable push
              </Button>
            )}
            <Button type="button" className="rounded-md bg-titan-cyan text-black hover:bg-titan-cyan/90" onClick={startNewChat}>
              New chat
            </Button>
          </div>
        </div>

        {composerSearch && (
          <div className="mb-4 titan-surface border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Start a conversation</p>
              <Button type="button" variant="ghost" size="icon" className="rounded-md" onClick={() => setComposerSearch(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {newPeers.length ? (
                newPeers.map((peer) => (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => pickPeer(peer)}
                    className="w-full text-left px-3 py-2.5 rounded-md hover:bg-muted flex items-center justify-between gap-3"
                  >
                    <span className="font-medium text-foreground text-sm">{peer.name}</span>
                    <span className="text-xs text-muted-foreground">{peer.hint}</span>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground px-1">No contacts found. Open Driver Hub to message drivers.</p>
              )}
            </div>
          </div>
        )}

        <div className="titan-surface border border-border overflow-hidden min-h-[60vh] grid md:grid-cols-[320px_1fr]">
          {/* Inbox */}
          <aside className={`border-b md:border-b-0 md:border-r border-border flex flex-col ${showThread ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="pl-9 rounded-md bg-background/60"
                  aria-label="Search conversations"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[50vh] md:max-h-[calc(70vh-56px)]">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : filteredConversations.length ? (
                filteredConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openThread(c.id)}
                    className={`w-full text-left px-4 py-3.5 border-b border-border last:border-0 transition-colors hover:bg-muted/70 ${
                      c.id === activeId ? "bg-titan-cyan/[0.08]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm text-foreground truncate">{c.peer_name}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {c.last_message_at ? timeAgo(c.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground truncate">{c.last_preview || "No messages yet"}</p>
                      {c.unread > 0 && (
                        <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-titan-cyan text-black text-[10px] font-bold flex items-center justify-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title={search ? "No matches" : "No conversations"}
                  description={search ? "Try a different search." : "Start a chat with a driver or contact."}
                  onAction={search ? undefined : startNewChat}
                  actionLabel="New chat"
                />
              )}
            </div>
          </aside>

          {/* Thread */}
          <section className={`flex flex-col min-h-[55vh] ${showThread ? "flex" : "hidden md:flex"}`}>
            {!showThread ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <EmptyState
                  icon={MessageSquare}
                  title="Select a conversation"
                  description="Search the inbox or start a new chat to message someone."
                  onAction={startNewChat}
                  actionLabel="New chat"
                />
              </div>
            ) : (
              <>
                <header className="px-3 sm:px-4 py-3 border-b border-border flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:hidden rounded-md"
                    onClick={() => {
                      setActiveId(null);
                      setParams({});
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{active.peer_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {typingPeer ? `${typingPeer.name || "Someone"} is typing…` : "Direct message"}
                    </p>
                  </div>
                  <ReportBlockMenu
                    targetId={active.peer_id}
                    targetName={active.peer_name}
                    link={`/messages?thread=${encodeURIComponent(active.id)}`}
                  />
                  <Button type="button" variant="ghost" size="sm" className="rounded-md text-xs" onClick={() => navigate("/community")}>
                    Community
                  </Button>
                </header>

                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 max-h-[45vh] md:max-h-[calc(70vh-140px)]">
                  {messages.map((m) => (
                    <Bubble key={m.id} message={m} isMine={m.sender_id === user.id} />
                  ))}
                  {typingPeer && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                      <span className="inline-flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:120ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:240ms]" />
                      </span>
                      Typing…
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                <footer className="p-3 border-t border-border">
                  <form onSubmit={submitText} className="flex items-end gap-2">
                    <input
                      ref={imageRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) sendAttachment(f, "image");
                      }}
                    />
                    <input
                      ref={fileRef}
                      type="file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) sendAttachment(f, "file");
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-md shrink-0"
                      title="Attach file"
                      aria-label="Attach file"
                      onClick={() => fileRef.current?.click()}
                      disabled={sending}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-md shrink-0"
                      title="Send image"
                      aria-label="Send image"
                      onClick={() => imageRef.current?.click()}
                      disabled={sending}
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`rounded-md shrink-0 ${recording ? "text-red-500 bg-red-500/10" : ""}`}
                      title={recording ? "Stop recording" : "Voice message"}
                      aria-label={recording ? "Stop recording" : "Voice message"}
                      onClick={toggleRecord}
                      disabled={sending}
                    >
                      {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                    <Input
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      placeholder="Write a message…"
                      className="rounded-md bg-background/60"
                      disabled={sending || recording}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      className="rounded-md shrink-0 bg-titan-cyan text-black hover:bg-titan-cyan/90"
                      aria-label="Send message"
                      disabled={sending || !draft.trim()}
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
