import {
  addDays,
  addWeeks,
  format,
  formatDistanceToNow,
  getMonth,
  getYear,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const currentMonthKey = () => format(new Date(), "yyyy-MM");

export const thisWeekRange = () => {
  const start = startOfWeek(new Date(), { weekStartsOn: 0 });
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(addDays(start, 6), "yyyy-MM-dd"),
  };
};

export const addDaysISO = (days, from = new Date()) =>
  format(addDays(from, days), "yyyy-MM-dd");

export const formatMonthDay = (date) => {
  const d = safeDate(date);
  return d ? format(d, "MMM d") : "—";
};

export const formatMonthDayYear = (date) => {
  const d = safeDate(date);
  return d ? format(d, "MMM d, yyyy") : "—";
};

export const formatShortDay = (date) => {
  const d = safeDate(date) || (date instanceof Date ? date : null);
  return d ? format(d, "EEE") : "—";
};

export const formatDayNum = (date) => {
  const d = safeDate(date) || (date instanceof Date ? date : null);
  return d ? format(d, "d") : "—";
};

export const formatISO = (date) => format(date instanceof Date ? date : new Date(date), "yyyy-MM-dd");

export const formatMonthShort = (date) => format(date instanceof Date ? date : new Date(date), "MMM");

export const relativeTime = (date) => {
  const d = safeDate(date);
  if (!d) return "soon";
  return formatDistanceToNow(d, { addSuffix: true });
};

function safeDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const getDateYear = (date) => {
  const d = safeDate(date);
  return d ? getYear(d) : null;
};

export const getDateMonth = (date) => {
  const d = safeDate(date);
  return d ? getMonth(d) : null;
};

export const isToday = (date) => isSameDay(date, new Date());

export const prevMonthRange = () => {
  const prev = subMonths(new Date(), 1);
  return {
    start: format(startOfMonth(prev), "yyyy-MM-dd"),
    end: format(endOfMonth(prev), "yyyy-MM-dd"),
  };
};

export function getWeekDays(anchorDate = new Date()) {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function addWeeksToDate(date, weeks) {
  return addWeeks(date, weeks);
}

export function lastNMonthKeys(count = 6) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    months.push({
      key: format(d, "yyyy-MM"),
      label: format(d, "MMM"),
    });
  }
  return months;
}
