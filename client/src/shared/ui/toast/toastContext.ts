import { createContext } from "react";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milliseconds; defaults to 5000. Errors stay until dismissed. */
  duration?: number;
}

export interface ToastApi {
  show: (toast: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
