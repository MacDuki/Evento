import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/soul.css";
import "./styles/redesign.css";

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) {
  const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI);
  void navigator.serviceWorker.register(serviceWorkerUrl);
}
