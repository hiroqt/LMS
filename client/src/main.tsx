import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./shared/styles/fonts.css";
import "./shared/styles/tailwind.css";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRouter } from "./app/router/AppRouter";

// After a deploy, the service worker replaces cached chunks. A tab still on
// the previous version would fail to lazy-load a screen whose old chunk is
// gone; reload once to pick up the new version instead of showing an error.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const key = "tmcc-reloaded-for-update";
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  window.location.reload();
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
