import { useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, FileText, GraduationCap, LayoutDashboard, ListChecks, Menu, Settings, ShieldCheck, UsersRound, X } from "../../icons";
import Avatar from "../../components/shared/Avatar";
import Breadcrumbs from "../../components/shared/Breadcrumbs";
import GlobalSearch from "../../components/shared/GlobalSearch";
import NotificationMenu from "../../components/shared/NotificationMenu";
import "./RoleWorkspace.css";

const icons = { Overview: LayoutDashboard, Classes: BookOpen, Gradebook: GraduationCap, Users: UsersRound, Subjects: BookOpen, Classrooms: LayoutDashboard, Enrollments: ListChecks, Reports: FileText, "System Configuration": Settings, "Academic Term Configuration": CalendarDays, "User Management": UsersRound, "Role Management": ShieldCheck, "Course Management": BookOpen, "Audit Logs": ClipboardCheck, "System Reports": FileText };
const categoryIcons = { "People & Access": UsersRound, Courses: BookOpen, Oversight: ClipboardCheck };

export default function RoleWorkspace({ role, user, sections, navigationGroups = [], page, onNavigate, title, subtitle, searchItems = [], notifications = [], onNotificationSelect, showHeading = true, searchInSidebar = false, classrooms = [], selectedClassId, onClassSelect, onCreateClass, onNavigateRole, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [classesExpanded, setClassesExpanded] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const results = useMemo(() => { const term = query.trim().toLowerCase(); return term ? searchItems.filter((item) => `${item.kind} ${item.title}`.toLowerCase().includes(term)).slice(0, 6) : []; }, [query, searchItems]);
  const search = <GlobalSearch value={query} onChange={setQuery} open={searchOpen} onOpen={() => { setSearchOpen(true); if (searchInSidebar) setCollapsed(false); }} items={results} label={`Search ${role} workspace`} placeholder="Search workspace..." className="role-global-search" onSelect={(item) => { setQuery(""); setSearchOpen(false); setDrawer(false); item.onSelect?.(); }} />;
  // A route selected elsewhere in the workspace should reveal its sidebar category.
  useEffect(() => {
    const selectedGroup = navigationGroups.flatMap((group) => group.groups || []).find((group) => group.items.includes(page));
    // oxlint-disable-next-line react/set-state-in-effect
    if (selectedGroup?.items.length > 1) setExpandedGroups((current) => ({ ...current, [selectedGroup.label]: true }));
  }, [navigationGroups, page]);
  const navButton = (item) => {
      const Icon = icons[item] || LayoutDashboard;
      return <button type="button" className={page === item ? "active" : ""} key={item} onClick={() => { onNavigate(item); setDrawer(false); }}><Icon size={18} /><span>{item}</span></button>;
  };
  const navigation = <nav className="role-nav" aria-label={`${role} navigation`}>
    {sections.map(navButton)}
    {navigationGroups.flatMap((group) => group.groups || []).map((category) => {
      const CategoryIcon = categoryIcons[category.label] || LayoutDashboard;
      if (category.items.length === 1) return <section className="role-nav-category is-single" key={category.label}>
        <div className="role-nav-category-label"><CategoryIcon size={16} /><span>{category.label}</span></div>
        <div className="role-nav-category-items">{category.items.map(navButton)}</div>
      </section>;
      return <section className="role-nav-category" key={category.label}>
        <button type="button" className={`role-nav-category-toggle ${category.items.includes(page) ? "active" : ""}`} aria-expanded={Boolean(expandedGroups[category.label])} onClick={() => setExpandedGroups((current) => ({ ...current, [category.label]: !current[category.label] }))}><CategoryIcon size={16} /><span>{category.label}</span><ChevronRight className={expandedGroups[category.label] ? "expanded" : ""} size={14} /></button>
        {expandedGroups[category.label] && <div className="role-nav-category-items">{category.items.map(navButton)}</div>}
      </section>;
    })}
  </nav>;
  const settingsNavigation = navigationGroups.length > 0 && <button type="button" className={`role-settings-link ${page === "System Configuration" ? "active" : ""}`} onClick={() => { onNavigate("System Configuration"); setDrawer(false); }}><Settings size={16} /><span>Settings</span></button>;
  return <div className={`role-shell ${collapsed ? "is-collapsed" : ""}`}>
    <aside className={`role-sidebar ${drawer ? "is-open" : ""}`}>
      <a className="role-brand" href="/student" onClick={(event) => { if (onNavigateRole) { event.preventDefault(); onNavigateRole("student"); } }}><span className="role-brand-mark"><GraduationCap size={21} /></span><span>TMCC LMS<i>.</i></span></a>
      {searchInSidebar && <div className="role-sidebar-search">{search}</div>}
      <div className="role-side-caption"><span>WORKSPACE</span><button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
      {navigation}
      {(classrooms.length > 0 || onCreateClass) && <section className={`role-class-list ${page === "Classes" ? "active" : ""}`}><button className="role-class-toggle" type="button" aria-expanded={classesExpanded} onClick={() => setClassesExpanded((expanded) => !expanded)}><BookOpen size={18} /><span>My classes</span><b>{classrooms.length}</b><ChevronRight className={classesExpanded ? "expanded" : ""} size={15} /></button>{classesExpanded && <div className="role-class-items" aria-label="My classes">{classrooms.map((room, index) => <button type="button" key={room.id} className={`role-class-item card-${index % 4} ${selectedClassId === room.id && page === "Classes" ? "selected" : ""}`} data-symbol={room.code?.slice(-2) || "CL"} title={`${room.title} · ${room.section}`} onClick={() => { onClassSelect?.(room); setDrawer(false); }}><span>{room.code?.slice(-2) || room.title?.slice(0, 2)}</span><span><strong>{room.title}</strong><small>{room.section}</small></span></button>)}{onCreateClass && <button type="button" className="role-create-class" onClick={() => { onCreateClass(); setDrawer(false); }}>+ Create class</button>}</div>}</section>}
      <div className="role-side-footer"><ShieldCheck size={15} /><span>{role} workspace</span><i /></div>
      {settingsNavigation}
    </aside>
    {drawer && <button className="role-backdrop" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
    <div className="role-main">
      <header className="role-topbar">
        <button className="role-mobile-menu" type="button" aria-label={drawer ? "Close menu" : "Open menu"} onClick={() => setDrawer((value) => !value)}>{drawer ? <X size={19} /> : <Menu size={19} />}</button>
        <div className="role-top-left"><Breadcrumbs current={page} onHome={() => onNavigate(sections[0])} className="role-location" /></div>
        <div className="role-top-actions">{!searchInSidebar && search}<NotificationMenu open={notificationsOpen} onToggle={() => setNotificationsOpen((value) => !value)} items={notifications} title={role === "instructor" ? "Needs your attention" : "Setup updates"} onSelect={(item) => { setNotificationsOpen(false); onNotificationSelect?.(item); }} /><div className="role-user"><div className="popover-holder"><button className="profile-button role-profile-button" type="button" aria-expanded={profileOpen} aria-haspopup="menu" aria-label={`${role} profile`} onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }}><Avatar name={`${user.firstName} ${user.lastName}`} tone={1} small /><span><strong>{user.firstName} {user.lastName}</strong><small>{role} · Demo</small></span><ChevronDown size={14} /></button>{profileOpen && <div className="popover profile-menu role-profile-menu" role="menu"><div className="profile-head"><Avatar name={`${user.firstName} ${user.lastName}`} tone={1} /><span><strong>{user.firstName} {user.lastName}</strong><small>{role === "instructor" ? "Faculty · Instructor" : "Administrator · Demo"}</small></span></div><div className="profile-role-section" role="group" aria-label="Switch workspace"><span className="profile-role-title">Switch workspace</span><button type="button" className={`profile-role-link ${role === "student" ? "is-current" : ""}`} onClick={() => { setProfileOpen(false); if (onNavigateRole) onNavigateRole("student"); else window.location.href = "/student"; }}><LayoutDashboard size={15} /><span>Student workspace</span></button><button type="button" className={`profile-role-link ${role === "instructor" ? "is-current" : ""}`} onClick={() => { setProfileOpen(false); if (onNavigateRole) onNavigateRole("instructor"); else window.location.href = "/instructor"; }}><GraduationCap size={15} /><span>Instructor workspace</span></button><button type="button" className={`profile-role-link ${role === "admin" ? "is-current" : ""}`} onClick={() => { setProfileOpen(false); if (onNavigateRole) onNavigateRole("admin"); else window.location.href = "/admin"; }}><ShieldCheck size={15} /><span>Admin workspace</span></button></div></div>}</div></div></div>
      </header>
      {searchOpen && query && <button aria-label="Close search" className="role-search-dismiss" type="button" onClick={() => setSearchOpen(false)} />}
      {profileOpen && <button aria-label="Close profile menu" className="role-search-dismiss" type="button" onClick={() => setProfileOpen(false)} />}
      <main className="role-content">{showHeading && <div className="role-page-heading"><div><span className="eyebrow">{role.toUpperCase()} WORKSPACE</span><h1>{title}</h1><p>{subtitle}</p></div><span className="role-date">Fall 2026 <i>·</i> TMCC</span></div>}{children}</main>
    </div>
  </div>;
}
