const dueFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const longDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const fullDateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const toDate = (value: string | number | Date) => (value instanceof Date ? value : new Date(value));

/** "Oct 24, 2026, 11:59 PM", the classic due-date format. */
/** "" means the instructor set no due date. */
export const formatDue = (value: string | number | Date) => (value === "" ? "no due date" : dueFormat.format(toDate(value)));
/** "October 2026" */
export const formatMonth = (value: Date) => monthFormat.format(value);
/** "Nov 3" */
export const formatDay = (value: string | number | Date) => dayFormat.format(toDate(value));
/** "Tue, Nov 3" */
export const formatWeekday = (value: Date) => weekdayFormat.format(value);
/** "Tuesday, November 3" */
export const formatLongDay = (value: Date) => longDayFormat.format(value);
/** "Friday, October 23, 2026" */
export const formatFullDate = (value: number | Date) => fullDateFormat.format(toDate(value));
/** "11:59 PM" */
export const formatTime = (value: Date) => timeFormat.format(value);
/** "01:00" */
export const formatCountdown = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
/** "01" */
export const pad2 = (value: number) => String(value).padStart(2, "0");
