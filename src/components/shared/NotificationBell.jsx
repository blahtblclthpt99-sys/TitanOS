import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { unreadCount } from "@/lib/notificationsApi";
import NavBadge from "@/components/shared/NavBadge";

export default function NotificationBell({ className = "" }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.id) { setCount(0); return undefined; }
    let active = true;
    const load = async () => {
      try { const next = await unreadCount(user.id); if (active) setCount(next); }
      catch { if (active) setCount(0); }
    };
    load();
    const poll = setInterval(load, 30000);
    return () => { active = false; clearInterval(poll); };
  }, [user?.id]);

  return <Link to="/notifications" aria-label={count ? `${count} unread notifications` : "Notifications"} className={`relative inline-flex w-10 h-10 items-center justify-center rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors ${className}`}><Bell className="w-5 h-5" /><NavBadge count={count} className="absolute -right-1 -top-1" /></Link>;
}
