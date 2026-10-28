import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, ListChecks, Menu, Settings, ShieldCheck, UsersRound, X } from "../../icons";
import Avatar from "../../components/shared/Avatar";
import Breadcrumbs from "../../components/shared/Breadcrumbs";
import GlobalSearch from "../../components/shared/GlobalSearch";
import NotificationMenu from "../../components/shared/NotificationMenu";
import "./RoleWorkspace.css";

const icons = { Overview: LayoutDashboard, Classes: BookOpen, Gradebook: GraduationCap, Users: UsersRound, Subjects: BookOpen, Classrooms: LayoutDashboard, Enrollments: ListChecks, Reports: FileText, "System Configuration": Settings, "Academic Term Configuration": CalendarDays, "User Management": UsersRound, "Role Management": ShieldCheck, "Course Management": BookOpen, "Audit Logs": ClipboardCheck, "System Reports": FileText };
const categoryIcons = { "System Setup": Settings, "People & Access": UsersRound, Courses: BookOpen, Oversight: ClipboardCheck };

export default function RoleWorkspace({ role, user, sections, navigationGroups = [], page, onNavigate, title, subtitle, searchItems = [], notifications = [], onNotificationSelect, showHeading = true, classrooms = [], selectedClassId, onClassSelect, onCreateClass, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({ "System Administration": true });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const results = useMemo(() => { const term = query.trim().toLowerCase(); return term ? searchItems.filter((item) => `${item.kind} ${item.title}`.toLowerCase().includes(term)).slice(0, 6) : []; }, [query, searchItems]);
  // A route selected elsewhere in the workspace should reveal its sidebar category.
  useEffect(() => {
    const selectedGroup = navigationGroups.flatMap((group) => group.groups || []).find((group) => group.items.includes(page));
    // oxlint-disable-next-line react/set-state-in-effect
    if (selectedGroup) setExpandedGroups((current) => ({ ...current, [selectedGroup.label]: true }));
  }, [navigationGroups, page]);
  const navButton = (item) => {
      const Icon = icons[item] || LayoutDashboard;
      return <button type="button" className={page === item ? "active" : ""} key={item} onClick={() => { onNavigate(item); setDrawer(false); }}><Icon size={18} /><span>{item}</span></button>;
  };
  const navigation = <nav className="role-nav" aria-label={`${role} navigation`}>
    {sections.map(navButton)}
    {navigationGroups.map((group) => <section className="role-nav-group" key={group.label}>
      <button type="button" className={`role-nav-group-toggle ${group.groups.some((category) => category.items.includes(page)) ? "active" : ""}`} aria-expanded={Boolean(expandedGroups[group.label])} onClick={() => setExpandedGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}><ShieldCheck size={18} /><span>{group.label}</span><ChevronRight className={expandedGroups[group.label] ? "expanded" : ""} size={15} /></button>
      {expandedGroups[group.label] && <div className="role-nav-group-items">{group.groups.map((category) => {
        const CategoryIcon = categoryIcons[category.label] || LayoutDashboard;
        return <section className="role-nav-category" key={category.label}>
          <button type="button" className={`role-nav-category-toggle ${category.items.includes(page) ? "active" : ""}`} aria-expanded={Boolean(expandedGroups[category.label])} onClick={() => setExpandedGroups((current) => ({ ...current, [category.label]: !current[category.label] }))}><CategoryIcon size={16} /><span>{category.label}</span><ChevronRight className={expandedGroups[category.label] ? "expanded" : ""} size={14} /></button>
          {expandedGroups[category.label] && <div className="role-nav-category-items">{category.items.map(navButton)}</div>}
        </section>;
      })}</div>}
    </section>)}
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
