import React from "react";

const shapes = {
  AlarmClock: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M5 3 2 6m17-3 3 3M12 5v2" /></>,
  ArrowLeft: <><path d="m14 18-6-6 6-6M8 12h12" /></>,
  ArrowRight: <><path d="m10 18 6-6-6-6m6 6H4" /></>,
  Bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12h4" /></>,
  BookOpen: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v17H5.5A2.5 2.5 0 0 0 3 22zm18 0A2.5 2.5 0 0 0 18.5 3H12v17h6.5a2.5 2.5 0 0 1 2.5 2z" /></>,
  CalendarDays: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18m-13 4h2m4 0h2m-8 4h2m4 0h2" /></>,
  Check: <path d="m5 12 4 4L19 6" />,
  ChevronDown: <path d="m6 9 6 6 6-6" />,
  ChevronLeft: <path d="m15 18-6-6 6-6" />,
  ChevronRight: <path d="m9 18 6-6-6-6" />,
  CircleHelp: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.6 2.6 0 1 1 4.4 1.9c-1.2 1.1-1.9 1.4-1.9 3m0 3h.01" /></>,
  ClipboardCheck: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8 11h8m-8 4 2 2 5-5" /></>,
  Clock3: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  FileText: <><path d="M6 2h8l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 0v6h5M8 13h8m-8 4h8" /></>,
  GraduationCap: <><path d="m2 10 10-6 10 6-10 6zm4 3v5c4 3 8 3 12 0v-5m4-3v7" /></>,
  LayoutDashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="10" width="8" height="11" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /></>,
  ListChecks: <><path d="m3 6 1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2M10 6h11M10 13h11m-11 7h11" /></>,
  Menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  MoreHorizontal: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  Search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  Settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7 15a8 8 0 0 1 0-2l-1.4-1.1L7 9.5l1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 .2 2Z" /></>,
  ShieldCheck: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  UsersRound: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 8m2 3a4 4 0 0 1 4 4v2" /></>,
  X: <path d="m18 6-12 12M6 6l12 12" />,
};

export function Icon({ name, size = 16, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{shapes[name]}</svg>;
}

export const AlarmClock = (props) => <Icon name="AlarmClock" {...props} />;
export const ArrowLeft = (props) => <Icon name="ArrowLeft" {...props} />;
export const ArrowRight = (props) => <Icon name="ArrowRight" {...props} />;
export const Bell = (props) => <Icon name="Bell" {...props} />;
export const BookOpen = (props) => <Icon name="BookOpen" {...props} />;
export const CalendarDays = (props) => <Icon name="CalendarDays" {...props} />;
export const Check = (props) => <Icon name="Check" {...props} />;
export const ChevronDown = (props) => <Icon name="ChevronDown" {...props} />;
export const ChevronLeft = (props) => <Icon name="ChevronLeft" {...props} />;
export const ChevronRight = (props) => <Icon name="ChevronRight" {...props} />;
export const CircleHelp = (props) => <Icon name="CircleHelp" {...props} />;
export const ClipboardCheck = (props) => <Icon name="ClipboardCheck" {...props} />;
export const Clock3 = (props) => <Icon name="Clock3" {...props} />;
export const FileText = (props) => <Icon name="FileText" {...props} />;
export const GraduationCap = (props) => <Icon name="GraduationCap" {...props} />;
export const LayoutDashboard = (props) => <Icon name="LayoutDashboard" {...props} />;
export const ListChecks = (props) => <Icon name="ListChecks" {...props} />;
export const Menu = (props) => <Icon name="Menu" {...props} />;
export const MoreHorizontal = (props) => <Icon name="MoreHorizontal" {...props} />;
export const Search = (props) => <Icon name="Search" {...props} />;
export const Settings = (props) => <Icon name="Settings" {...props} />;
export const ShieldCheck = (props) => <Icon name="ShieldCheck" {...props} />;
export const UsersRound = (props) => <Icon name="UsersRound" {...props} />;
export const X = (props) => <Icon name="X" {...props} />;
