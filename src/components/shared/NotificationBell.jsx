import React from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import NavBadge from "@/components/shared/NavBadge";

export default function NotificationBell({ className = "" }) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationCount(user?.id);

  return (
    <Link
      to="/notifications"
      aria-label={count ? `${count} unread notifications` : "Notifications"}
      className={`relative inline-flex w-10 h-10 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ${className}`}
    >
      <Bell className="w-5 h-5" />
      <NavBadge count={count} className="absolute -right-1 -top-1" />
    </Link>
  );
}
