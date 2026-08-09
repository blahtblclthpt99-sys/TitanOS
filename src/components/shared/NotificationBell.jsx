import React from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import NavBadge from "@/components/shared/NavBadge";
import { cn } from "@/lib/utils";

export default function NotificationBell({ className = "" }) {
  const { user } = useAuth();
  const { count } = useUnreadNotificationCount(user?.id);

  return (
    <Link
      to="/notifications"
      aria-label={count ? `${count} unread notifications` : "Notifications"}
      className={cn(
        "relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-fast focus-ring",
        className
      )}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      <NavBadge count={count} className="absolute -right-0.5 -top-0.5" />
    </Link>
  );
}
