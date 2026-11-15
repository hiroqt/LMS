import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./shared/styles/fonts.css";
import "./shared/styles/tailwind.css";
import "./index.css";
import { AppProviders } from "./app/providers/AppProviders";
import { AppRouter } from "./app/router/AppRouter";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
);
