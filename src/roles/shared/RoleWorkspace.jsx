import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileText, GraduationCap, LayoutDashboard, ListChecks, Menu, ShieldCheck, UsersRound, X } from "../../icons";
import Avatar from "../../components/shared/Avatar";
import Breadcrumbs from "../../components/shared/Breadcrumbs";
import GlobalSearch from "../../components/shared/GlobalSearch";
import NotificationMenu from "../../components/shared/NotificationMenu";
import "./RoleWorkspace.css";

const icons = { Overview: LayoutDashboard, Classes: BookOpen, Gradebook: GraduationCap, Users: UsersRound, Subjects: BookOpen, Classrooms: LayoutDashboard, Enrollments: ListChecks, Reports: FileText };

export default function RoleWorkspace({ role, user, sections, page, onNavigate, title, subtitle, searchItems = [], notifications = [], onNotificationSelect, showHeading = true, classrooms = [], selectedClassId, onClassSelect, onCreateClass, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const results = useMemo(() => { const term = query.trim().toLowerCase(); return term ? searchItems.filter((item) => `${item.kind} ${item.title}`.toLowerCase().includes(term)).slice(0, 6) : []; }, [query, searchItems]);
  const navigation = <nav className="role-nav" aria-label={`${role} navigation`}>
    {sections.map((item) => {
      const Icon = icons[item] || LayoutDashboard;
      return <button type="button" className={page === item ? "active" : ""} key={item} onClick={() => { onNavigate(item); setDrawer(false); }}><Icon size={18} /><span>{item}</span></button>;
    })}
  </nav>;
  return <div className={`role-shell ${collapsed ? "is-collapsed" : ""}`}>
    <aside className={`role-sidebar ${drawer ? "is-open" : ""}`}>
      <a className="role-brand" href="/student"><span className="role-brand-mark"><GraduationCap size={21} /></span><span>TMCC LMS<i>.</i></span></a>
      <div className="role-side-caption"><span>WORKSPACE</span><button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
      {navigation}
      {(classrooms.length > 0 || onCreateClass) && <section className={`role-class-list ${page === "Classes" ? "active" : ""}`}><button className="role-class-toggle" type="button" aria-expanded={classesExpanded} onClick={() => setClassesExpanded((expanded) => !expanded)}><BookOpen size={18} /><span>My classes</span><b>{classrooms.length}</b><ChevronRight className={classesExpanded ? "expanded" : ""} size={15} /></button>{classesExpanded && <div className="role-class-items" aria-label="My classes">{classrooms.map((room, index) => <button type="button" key={room.id} className={`role-class-item card-${index % 4} ${selectedClassId === room.id && page === "Classes" ? "selected" : ""}`} data-symbol={room.code?.slice(-2) || "CL"} title={`${room.title} · ${room.section}`} onClick={() => { onClassSelect?.(room); setDrawer(false); }}><span>{room.code?.slice(-2) || room.title?.slice(0, 2)}</span><span><strong>{room.title}</strong><small>{room.section}</small></span></button>)}{onCreateClass && <button type="button" className="role-create-class" onClick={() => { onCreateClass(); setDrawer(false); }}>+ Create class</button>}</div>}</section>}
      <div className="role-side-footer"><ShieldCheck size={15} /><span>{role} workspace</span><i /></div>
    </aside>
    {drawer && <button className="role-backdrop" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
    <div className="role-main">
      <header className="role-topbar">
        <button className="role-mobile-menu" type="button" aria-label={drawer ? "Close menu" : "Open menu"} onClick={() => setDrawer((value) => !value)}>{drawer ? <X size={19} /> : <Menu size={19} />}</button>
        <div className="role-top-left"><Breadcrumbs current={page} onHome={() => onNavigate(sections[0])} className="role-location" /></div>
        <div className="role-top-actions"><GlobalSearch value={query} onChange={setQuery} open={searchOpen} onOpen={() => setSearchOpen(true)} items={results} label={`Search ${role} workspace`} placeholder="Search workspace..." className="role-global-search" onSelect={(item) => { setQuery(""); setSearchOpen(false); item.onSelect?.(); }} /><NotificationMenu open={notificationsOpen} onToggle={() => setNotificationsOpen((value) => !value)} items={notifications} title={role === "instructor" ? "Needs your attention" : "Setup updates"} onSelect={(item) => { setNotificationsOpen(false); onNotificationSelect?.(item); }} /><div className="role-user"><Avatar name={`${user.firstName} ${user.lastName}`} tone={1} small /><span><strong>{user.firstName} {user.lastName}</strong><small>{role} · Demo</small></span><label className="role-switch">Switch role<select aria-label="Switch workspace" value={role} onChange={(event) => { window.location.href = `/${event.target.value}`; }}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></select></label></div></div>
      </header>
      {searchOpen && query && <button aria-label="Close search" className="role-search-dismiss" type="button" onClick={() => setSearchOpen(false)} />}
      <main className="role-content">{showHeading && <div className="role-page-heading"><div><span className="eyebrow">{role.toUpperCase()} WORKSPACE</span><h1>{title}</h1><p>{subtitle}</p></div><span className="role-date">Fall 2026 <i>·</i> TMCC</span></div>}{children}</main>
    </div>
  </div>;
}
