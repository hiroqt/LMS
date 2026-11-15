import { useContext } from "react";
import { ToastContext, type ToastApi } from "./toastContext";

/** Shows a brief, screen-reader-announced message. Requires <Toaster> above. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <Toaster>");
  return api;
}
