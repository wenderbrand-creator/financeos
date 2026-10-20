import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/features.css";
import "./styles/import.css";
import "./styles/cards.css";
import "./styles/responsive.css";
import "./styles/onboarding.css";
import { Root } from "./Root";
import { applyPrefs, normPrefs, loadUI } from "./services/prefs";

// apply theme, accent and density before the first paint (no flash)
applyPrefs(normPrefs(loadUI().prefs));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Root />
    </BrowserRouter>
  </StrictMode>
);
