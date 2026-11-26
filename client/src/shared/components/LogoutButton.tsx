import { LogOut } from "lucide-react";
import { cn } from "../lib/cn";

export interface LogoutButtonProps {
  collapsed?: boolean;
  onLogout?: () => void;
  className?: string;
}

/**
 * Sidebar footer button that logs out of the LMS and navigates to the login page.
 */
export function LogoutButton({ collapsed = false, onLogout, className }: LogoutButtonProps) {
  const handleClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = "/login";
    }
  };

  return (
    <button
      type="button"
      aria-label={collapsed ? "Log out" : undefined}
      title={collapsed ? "Log out" : undefined}
      onClick={handleClick}
      className={cn(
        "flex min-h-touch w-full items-center gap-3 rounded-control border-0 bg-transparent text-left font-sans text-body font-medium text-ink hover:bg-primary-50 focus-visible:outline-3 focus-visible:outline-focus",
        collapsed ? "justify-center px-0" : "px-3",
        className,
      )}
    >
      <LogOut aria-hidden className="size-5 shrink-0 text-muted" />
      <span className={collapsed ? "sr-only" : undefined}>Log out</span>
    </button>
  );
}
