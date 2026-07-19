import React, { useEffect, useState } from "react";
import { Bell, CheckCheck, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import PageHeader from "@/components/shared/PageHeader";
import PageLoader from "@/components/shared/PageLoader";
import { useAuth } from "@/lib/AuthContext";
import { timeAgo } from "@/lib/platformConstants";
import { listNotifications, markAllRead, markRead, deleteNotification } from "@/lib/notificationsApi";
import DeleteButton from "@/components/shared/DeleteButton";
import { betaBadgeLabel } from "@/lib/plan";

export default function Notifications() {
  const { user, isLoadingAuth, authChecked } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (silent = false) => {
    if (!user?.id) return;
    if (!silent) setLoading(true);
    try { setNotifications(await listNotifications(user.id)); }
    catch { if (!silent) toast({ variant: "destructive", title: "Couldn't load notifications" }); }
    finally { if (!silent) setLoading(false); }
  };
  useEffect(() => { if (authChecked && user?.id) load(); }, [authChecked, user?.id]);
  useEffect(() => {
    if (!user?.id) return undefined;
    const poll = setInterval(() => load(true), 30000);
    return () => clearInterval(poll);
  }, [user?.id]);

  const openNotification = async (notification) => {
    if (!notification.read_at) {
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
      try { await markRead(user.id, notification.id); } catch { toast({ variant: "destructive", title: "Couldn't mark notification read" }); }
    }
    if (notification.link) navigate(notification.link);
  };
  const readAll = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await markAllRead(user.id);
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() })));
      toast({ title: "All caught up" });
    } catch { toast({ variant: "destructive", title: "Couldn't mark notifications read" }); }
    finally { setSaving(false); }
  };

  if (!authChecked || isLoadingAuth) return <PageLoader variant="list" label="Loading notifications" />;
  const hasUnread = notifications.some((notification) => !notification.read_at);
  return <div className="relative p-4 md:p-8 max-w-3xl mx-auto pb-32">
    <div className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-titan-cyan/8 blur-[100px]" /></div>
    <div className="relative"><div className="flex items-start justify-between gap-4"><PageHeader title="Notifications" subtitle="Stay on top of your TitanOS activity" /><Button onClick={readAll} disabled={!hasUnread || saving} variant="outline" className="border-border text-foreground hover:bg-muted rounded-xl shrink-0">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCheck className="w-4 h-4 mr-2" />Mark all read</>}</Button></div>{betaBadgeLabel() && <div className="glass rounded-2xl mb-5 px-4 py-2 border border-titan-cyan/20 text-xs font-semibold text-titan-cyan">{betaBadgeLabel()}</div>}
      {loading ? <PageLoader variant="list" label="Loading notifications" /> : notifications.length ? <div className="glass rounded-2xl border border-border overflow-hidden">{notifications.map((notification) => <div key={notification.id} className={`w-full text-left p-5 flex gap-4 border-b border-border last:border-0 transition-colors hover:bg-muted/60 ${notification.read_at ? "opacity-60" : "bg-titan-cyan/[0.035]"}`}><button type="button" onClick={() => openNotification(notification)} className="flex gap-4 flex-1 min-w-0 text-left"><div className={`mt-1 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${notification.read_at ? "bg-muted text-muted-foreground" : "bg-titan-cyan/15 text-titan-cyan"}`}><Bell className="w-4 h-4" /></div><div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-3"><p className="font-medium text-foreground">{notification.title}</p><span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(notification.created_at || notification.created_date)}</span></div>{notification.body && <p className="text-sm text-foreground/45 mt-1">{notification.body}</p>}</div><ChevronRight className="w-4 h-4 text-muted-foreground self-center shrink-0" /></button><DeleteButton label={notification.title || "notification"} onDelete={async () => { await deleteNotification(user.id, notification.id); setNotifications((current) => current.filter((item) => item.id !== notification.id)); }} /></div>)}</div> : <div className="glass rounded-3xl p-12 text-center border border-border"><Bell className="w-9 h-9 text-titan-cyan mx-auto mb-3" /><p className="font-semibold text-foreground">You're all caught up</p><p className="text-sm text-muted-foreground mt-1">New activity and updates will appear here.</p></div>}
    </div>
  </div>;
}
