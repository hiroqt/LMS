import { X } from "lucide-react";
import { Toast } from "radix-ui";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { ToastContext, type ToastOptions } from "./toastContext";

interface ActiveToast extends ToastOptions {
  id: number;
}

const tones = {
  neutral: "border-line",
  success: "border-l-4 border-l-success border-y-line border-r-line",
  danger: "border-l-4 border-l-danger border-y-line border-r-line",
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
            className={cn("flex items-start gap-3 rounded-card border bg-surface p-4 font-sans text-ink shadow-popover", tones[tone])}
          >
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
