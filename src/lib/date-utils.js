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

export const formatMonthDay = (date) =>
  format(new Date(date), "MMM d");

export const formatMonthDayYear = (date) =>
  format(new Date(date), "MMM d, yyyy");

export const formatShortDay = (date) => format(date, "EEE");

export const formatDayNum = (date) => format(date, "d");

export const formatISO = (date) => format(date, "yyyy-MM-dd");

export const formatMonthShort = (date) => format(date, "MMM");

export const relativeTime = (date) =>
  formatDistanceToNow(new Date(date), { addSuffix: true });

export const getDateYear = (date) => getYear(new Date(date));

export const getDateMonth = (date) => getMonth(new Date(date));

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
