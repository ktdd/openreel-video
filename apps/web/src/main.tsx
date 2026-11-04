import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./index.css";
import { AstryxProvider } from "./components/astryx/AstryxProvider";
import { registerServiceWorker } from "./services/service-worker";
import { initCustomFonts } from "./components/editor/inspector/font-options";

void registerServiceWorker();
void initCustomFonts();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AstryxProvider><App /></AstryxProvider>
  </React.StrictMode>,
);
