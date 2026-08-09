import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, FileText, Receipt, MessageSquare, Image as ImageIcon,
  MapPin, Star, CheckCircle, Calendar, CreditCard, Paperclip, Clock,
} from "lucide-react";
import { formatMonthDayYear } from "@/lib/date-utils";

const ICONS = {
  job: Briefcase,
  appointment: Calendar,
  completed: CheckCircle,
  cancelled: Clock,
  estimate: FileText,
  estimate_accepted: CheckCircle,
  invoice: Receipt,
  payment: CreditCard,
  message: MessageSquare,
  file: Paperclip,
  photo: ImageIcon,
  checkin: MapPin,
  review: Star,
};

const TONE = {
  success: "bg-emerald-400/15 text-emerald-300",
  danger: "bg-red-400/15 text-red-300",
  info: "bg-titan-cyan/15 text-titan-cyan",
  neutral: "bg-muted text-muted-foreground",
};

export default function BusinessTimeline({ events = [], empty = "No timeline events yet.", max = 20 }) {
  const navigate = useNavigate();
  const rows = events.slice(0, max);

  if (!rows.length) {
    return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
  }

  return (
    <ol className="relative space-y-0 border-l border-border ml-3 pl-5">
      {rows.map((event) => {
        const Icon = ICONS[event.type] || Briefcase;
        const tone = TONE[event.tone] || TONE.neutral;
        const clickable = Boolean(event.path);
        return (
          <li key={event.id} className="relative pb-5 last:pb-0">
            <span className={`absolute -left-[1.65rem] top-0 w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}>
              <Icon className="w-3.5 h-3.5" />
            </span>
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && navigate(event.path)}
              className={`w-full text-left ${clickable ? "hover:opacity-90" : "cursor-default"}`}
            >
              <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
              {event.detail && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.detail}</p>}
              <p className="text-[11px] text-muted-foreground/80 mt-1">{formatMonthDayYear(event.at)}</p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
