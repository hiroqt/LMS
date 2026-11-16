import { GraduationCap, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { usePersistentState } from "../hooks/usePersistentState";
import { cn } from "../lib/cn";
import { NetworkBanner } from "./NetworkBanner";
import { SkipLink } from "./SkipLink";

export interface NavItem {
  id: string;
  label: string;
  /** Shorter label for the phone bottom bar, e.g. "Tasks" for "Tasks & Assessments". */
  shortLabel?: string;
  icon: ReactNode;
  /** Badge count shown next to the label, e.g. pending reviews. */
  count?: number;
}

/** Sidebar content. A function receives whether the desktop sidebar is collapsed to icons. */
export type SidebarSlot = ReactNode | ((collapsed: boolean) => ReactNode);

const renderSlot = (slot: SidebarSlot, collapsed: boolean) => (typeof slot === "function" ? slot(collapsed) : slot);

export interface AppShellProps {
  /** Used in landmark names: "Student navigation". */
  roleLabel: string;
  /** Overrides the navigation landmark name (default "<roleLabel> navigation"). */
  navLabel?: string;
  nav: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  /**
   * Phone navigation: "bottom" (Student, 4–5 destinations, thumb-reachable) or
   * "drawer" (Instructor, more destinations plus the class list).
   */
  mobileNav: "bottom" | "drawer";
  /** Extra sidebar content under the main navigation, e.g. "My classes". */
  sidebarExtra?: SidebarSlot;
  /** Pinned to the bottom of the sidebar and drawer, e.g. Help & Support. */
  sidebarFooter?: SidebarSlot;
  /** Left side of the top bar after the brand, e.g. breadcrumbs. */
  topbarStart?: ReactNode;
  /** Right side of the top bar: search, notifications, profile. */
  topbarActions?: ReactNode;
  /** Changes on every page change; focus then moves to the page's h1. */
  pageKey: string;
  children: ReactNode;
}

function NavList({ nav, activeId, onNavigate, label, layout, collapsed = false }: Pick<AppShellProps, "nav" | "activeId" | "onNavigate"> & { label: string; layout: "column" | "bar"; collapsed?: boolean }) {
  return (
    <nav aria-label={label}>
      <ul className={cn("m-0 list-none p-0", layout === "column" ? "flex flex-col gap-1" : "grid auto-cols-fr grid-flow-col")}>
        {nav.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "relative flex w-full items-center rounded-control border-0 font-sans font-medium focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus [&_svg]:shrink-0",
                  layout === "column"
                    ? cn("min-h-touch gap-3 text-body [&_svg]:size-5", collapsed ? "justify-center px-0" : "px-3")
                    : "min-h-16 flex-col justify-center gap-0.5 px-1 text-body [&_svg]:size-6",
                  layout === "column"
                    ? active
                      ? "bg-primary-700 font-semibold text-white shadow-card"
                      : "bg-transparent text-ink hover:bg-primary-50"
                    : active
                      ? "bg-primary-100 font-semibold text-primary-800"
                      : "bg-transparent text-muted hover:bg-primary-50 hover:text-ink",
                )}
              >
                <span aria-hidden className="inline-flex">{item.icon}</span>
                <span className={layout === "column" ? (collapsed ? "sr-only" : "flex-1 text-left") : ""}>{layout === "bar" ? (item.shortLabel ?? item.label) : item.label}</span>
                {item.count ? (
                  <span className={cn("rounded-full bg-primary-600 px-2 text-body font-semibold text-white", collapsed && "absolute -top-1 -right-1 ring-2 ring-surface")}>
                    {item.count}
                    <span className="sr-only"> pending</span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** College seal and name. The full form (with the college name) sits in the sidebar. */
function Brand({ full = false, sealOnly = false }: { full?: boolean; sealOnly?: boolean }) {
  return (
    <span className="flex items-center gap-3 font-sans text-ink">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-700 text-white">
        <GraduationCap className="size-5" />
      </span>
      <span className={sealOnly ? "sr-only" : "flex flex-col leading-tight"}>
        {/* Collapses to the seal on very narrow phones so the top bar fits 320px. */}
        <span className="text-section font-bold tracking-tight max-[379px]:sr-only">TMCC LMS</span>
        {full && <span className="text-body text-muted">Trece Martires City College</span>}
      </span>
    </span>
  );
}

/**
 * Responsive workspace frame for the rebuilt Student and Instructor UIs
 * (Admin keeps RoleWorkspace, D-001). Desktop (lg+): fixed sidebar. Phones and
 * tablets: a bottom bar or a drawer. Includes the skip link, landmarks,
 * connection banner, and focus management on page change (C-004).
 */
export function AppShell({ roleLabel, navLabel: navLabelOverride, nav, activeId, onNavigate, mobileNav, sidebarExtra, sidebarFooter, topbarStart, topbarActions, pageKey, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // The drawer only exists below lg. If the viewport grows while it is open
  // (tablet rotation, window resize), it must close: Radix would otherwise keep
  // pointer-events off the page and focus trapped in a hidden dialog.
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const drawerVisible = drawerOpen && !isDesktop;
  // Desktop only: the sidebar narrows to icons to give the page more room.
  const [collapsed, setCollapsed] = usePersistentState<boolean>("tmcc-sidebar-collapsed", false);
  const mainRef = useRef<HTMLElement>(null);
  // Compare with the previous key instead of skipping the "first render":
  // StrictMode runs effects twice on mount, which would steal initial focus.
  const previousPage = useRef(pageKey);
  const navigatedFromDrawer = useRef(false);

  useEffect(() => {
    if (previousPage.current === pageKey) return;
    previousPage.current = pageKey;
    if (drawerVisible) {
      // Any navigation from inside the drawer (nav items, class links, search)
      // closes it; onCloseAutoFocus then moves focus to the new page's h1.
      navigatedFromDrawer.current = true;
      // oxlint-disable-next-line react/set-state-in-effect -- closing the drawer is the response to a route change
      setDrawerOpen(false);
      return;
    }
    // Announce the new page to screen readers and give keyboard users a fresh start.
    (mainRef.current?.querySelector("h1") ?? mainRef.current)?.focus();
  }, [pageKey, drawerVisible]);

  const navigate = (id: string) => {
    if (drawerVisible) navigatedFromDrawer.current = true;
    setDrawerOpen(false);
    onNavigate(id);
  };
  const navLabel = navLabelOverride ?? `${roleLabel} navigation`;

  return (
    <div className="min-h-dvh bg-canvas font-sans text-ink">
      <SkipLink />

      <aside
        id="workspace-sidebar"
        aria-label="Workspace"
        className={cn("fixed inset-y-0 left-0 hidden flex-col gap-6 border-r border-line bg-surface py-5 lg:flex", collapsed ? "w-20 px-3" : "w-72 px-4")}
      >
        <span className={collapsed ? "flex justify-center" : "px-1"}><Brand full sealOnly={collapsed} /></span>
        <NavList nav={nav} activeId={activeId} onNavigate={navigate} label={navLabel} layout="column" collapsed={collapsed} />
        {sidebarExtra && <div className="min-h-0 flex-1 overflow-y-auto">{renderSlot(sidebarExtra, collapsed)}</div>}
        {/* The collapse control is the last row of the sidebar it controls. */}
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
          {renderSlot(sidebarFooter, collapsed)}
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-controls="workspace-sidebar"
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : undefined}
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent text-left font-sans text-body font-medium text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus",
              collapsed ? "justify-center px-0" : "px-3",
            )}
          >
            {collapsed ? <PanelLeftOpen aria-hidden className="size-5 shrink-0 text-muted" /> : <PanelLeftClose aria-hidden className="size-5 shrink-0 text-muted" />}
            {!collapsed && <span aria-hidden>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      <div className={cn("flex min-h-dvh flex-col", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 sm:min-h-16 border-b border-line bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
          {mobileNav === "drawer" && (
            <Dialog.Root open={drawerVisible} onOpenChange={setDrawerOpen}>
              <Dialog.Trigger
                aria-label="Open menu"
                className="-ml-2 grid size-touch place-items-center rounded-control border-0 bg-transparent text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus lg:hidden"
              >
                <MenuIcon aria-hidden className="size-6" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 lg:hidden" />
                <Dialog.Content
                  aria-describedby={undefined}
                  onCloseAutoFocus={(event) => {
                    // After choosing a page, focus belongs on the new page's h1, not the menu button.
                    if (!navigatedFromDrawer.current) return;
                    navigatedFromDrawer.current = false;
                    event.preventDefault();
                    mainRef.current?.querySelector("h1")?.focus();
                  }}
                  className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,85vw)] flex-col gap-6 overflow-y-auto bg-surface px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-5 font-sans text-ink shadow-popover lg:hidden"
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title asChild><span><Brand full /></span></Dialog.Title>
                    <Dialog.Close aria-label="Close menu" className="grid size-touch place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus">
                      <X aria-hidden className="size-5" />
                    </Dialog.Close>
                  </div>
                  {/* On phones the drawer is the sidebar, so it keeps the sidebar landmark. */}
                  <aside aria-label="Workspace" className="flex flex-col gap-6">
                    <NavList nav={nav} activeId={activeId} onNavigate={navigate} label={navLabel} layout="column" />
                    {renderSlot(sidebarExtra, false)}
                    {sidebarFooter && <div className="border-t border-line pt-4">{renderSlot(sidebarFooter, false)}</div>}
                  </aside>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
          <span className="lg:hidden"><Brand /></span>
          {topbarStart}
          <div className="ml-auto flex items-center gap-1 sm:gap-2">{topbarActions}</div>
        </header>

        <NetworkBanner />

        {/* Fills the space beside the sidebar. It is a size container, so pages lay
            out by the room they actually have (@4xl:, @7xl:), which also changes
            when the sidebar collapses. Capped only on very wide monitors. */}
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className={cn("@container mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-5 px-4 py-5 outline-none sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-8", mobileNav === "bottom" && "pb-28 lg:pb-8")}
        >
          {children}
        </main>
      </div>

      {mobileNav === "bottom" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <NavList nav={nav} activeId={activeId} onNavigate={navigate} label={navLabel} layout="bar" />
        </div>
      )}
    </div>
  );
}
