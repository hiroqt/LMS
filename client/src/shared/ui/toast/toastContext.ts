import { createContext } from "react";

export type ToastTone = "neutral" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /**
   * A later toast in the same group replaces this one, so an error that a retry fixed does not
   * stay on screen (errors stay until dismissed) over the controls it was about.
   */
  group?: string;
  /** Milliseconds; defaults to 5000. Errors stay until dismissed. */
  duration?: number;
}

export interface ToastApi {
  show: (toast: ToastOptions) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);
