import { GraduationCap, Menu as MenuIcon, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { NetworkBanner } from "./NetworkBanner";
import { SkipLink } from "./SkipLink";

export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** Badge count shown next to the label, e.g. pending reviews. */
  count?: number;
}

export interface AppShellProps {
  /** Used in landmark names: "Student navigation". */
  roleLabel: string;
  nav: NavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
  /**
   * Phone navigation: "bottom" (Student, 4–5 destinations, thumb-reachable) or
   * "drawer" (Instructor, more destinations plus the class list).
   */
  mobileNav: "bottom" | "drawer";
  /** Extra sidebar content under the main navigation, e.g. "My classes". */
  sidebarExtra?: ReactNode;
  /** Right side of the top bar: search, notifications, profile. */
  topbarActions?: ReactNode;
  /** Changes on every page change; focus then moves to the page's h1. */
  pageKey: string;
  children: ReactNode;
}

function NavList({ nav, activeId, onNavigate, label, layout }: Pick<AppShellProps, "nav" | "activeId" | "onNavigate"> & { label: string; layout: "column" | "bar" }) {
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
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "flex w-full items-center rounded-control border-0 font-sans font-medium focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-focus [&_svg]:shrink-0",
                  layout === "column"
                    ? "min-h-touch gap-3 px-3 text-body [&_svg]:size-5"
                    : "min-h-16 flex-col justify-center gap-0.5 px-1 text-body [&_svg]:size-6",
                  active ? "bg-primary-100 text-primary-700" : "bg-transparent text-muted hover:bg-primary-50 hover:text-ink",
                )}
              >
                <span aria-hidden className="inline-flex">{item.icon}</span>
                <span className={layout === "column" ? "flex-1 text-left" : ""}>{item.label}</span>
                {item.count ? (
                  <span className="rounded-full bg-primary-600 px-2 text-body font-semibold text-white">
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

function Brand() {
  return (
    <span className="flex items-center gap-2.5 font-sans text-section font-bold text-ink">
      <span aria-hidden className="grid size-9 place-items-center rounded-control bg-primary-600 text-white">
        <GraduationCap className="size-5" />
      </span>
      TMCC LMS
    </span>
  );
}

/**
 * Responsive workspace frame for the rebuilt Student and Instructor UIs
 * (Admin keeps RoleWorkspace, D-001). Desktop (lg+): fixed sidebar. Phones and
 * tablets: a bottom bar or a drawer. Includes the skip link, landmarks,
 * connection banner, and focus management on page change (C-004).
 */
export function AppShell({ roleLabel, nav, activeId, onNavigate, mobileNav, sidebarExtra, topbarActions, pageKey, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  // Compare with the previous key instead of skipping the "first render":
  // StrictMode runs effects twice on mount, which would steal initial focus.
  const previousPage = useRef(pageKey);
  const navigatedFromDrawer = useRef(false);

  useEffect(() => {
    if (previousPage.current === pageKey) return;
    previousPage.current = pageKey;
    // Announce the new page to screen readers and give keyboard users a fresh start.
    (mainRef.current?.querySelector("h1") ?? mainRef.current)?.focus();
  }, [pageKey]);

  const navigate = (id: string) => {
    if (drawerOpen) navigatedFromDrawer.current = true;
    setDrawerOpen(false);
    onNavigate(id);
  };
  const navLabel = `${roleLabel} navigation`;

  return (
    <div className="min-h-dvh bg-canvas font-sans text-ink">
      <SkipLink />

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-6 border-r border-line bg-surface px-4 py-5 lg:flex">
        <Brand />
        <NavList nav={nav} activeId={activeId} onNavigate={navigate} label={navLabel} layout="column" />
        {sidebarExtra && <div className="min-h-0 flex-1 overflow-y-auto">{sidebarExtra}</div>}
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-line bg-surface/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
          {mobileNav === "drawer" && (
            <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
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
                    <Dialog.Title asChild><span><Brand /></span></Dialog.Title>
                    <Dialog.Close aria-label="Close menu" className="grid size-touch place-items-center rounded-control border-0 bg-transparent text-muted hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus">
                      <X aria-hidden className="size-5" />
                    </Dialog.Close>
                  </div>
                  <NavList nav={nav} activeId={activeId} onNavigate={navigate} label={navLabel} layout="column" />
                  {sidebarExtra}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          )}
          <span className="lg:hidden"><Brand /></span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">{topbarActions}</div>
        </header>

        <NetworkBanner />

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className={cn("mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 outline-none sm:px-6 lg:py-8", mobileNav === "bottom" && "pb-28 lg:pb-8")}
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
