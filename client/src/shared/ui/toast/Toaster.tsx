import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Toast } from "radix-ui";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ToastContext, type ToastOptions } from "./toastContext";

interface ActiveToast extends ToastOptions {
  id: number;
}

/** Tone is a soft tint and an icon, never a side stripe (C-019). */
const tones = {
  neutral: { className: "border-line bg-surface", icon: null },
  success: { className: "border-success-soft bg-success-soft", icon: <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" /> },
  danger: { className: "border-danger-soft bg-danger-soft", icon: <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" /> },
} as const;

let nextId = 0;

/**
 * Toast region. Messages are announced politely (errors assertively), pause
 * on hover and focus, can be swiped away, and F8 moves focus to them.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const show = useCallback((toast: ToastOptions) => setToasts((current) => [...current, { ...toast, id: ++nextId }]), []);
  const api = useMemo(() => ({ show }), [show]);
  const remove = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection="down" label="Notifications (F8)">
        {children}
        {toasts.map(({ id, title, description, tone = "neutral", duration }) => (
          <Toast.Root
            key={id}
            type={tone === "danger" ? "foreground" : "background"}
            duration={duration ?? (tone === "danger" ? Number.POSITIVE_INFINITY : 5000)}
            onOpenChange={(open) => !open && remove(id)}
            className={cn("flex items-start gap-3 rounded-card border p-4 font-sans text-ink shadow-popover", tones[tone].className)}
          >
            {tones[tone].icon}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Toast.Title className="text-body font-semibold">{title}</Toast.Title>
              {description && <Toast.Description className="text-body text-muted">{description}</Toast.Description>}
            </div>
            <Toast.Close aria-label="Dismiss" className="-m-2 grid size-touch place-items-center rounded-control border-0 bg-transparent text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-focus">
              <X aria-hidden className="size-4" />
            </Toast.Close>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[60] m-0 flex list-none flex-col gap-2 p-0 outline-none sm:right-6 sm:bottom-6 sm:left-auto sm:w-96" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}
