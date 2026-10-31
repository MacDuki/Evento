import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import "./styles/global.css";
import "./styles/layout.css";
import "./styles/soul.css";
import "./styles/redesign.css";
import { api } from "./services/api.js";
import { flush, type QueuedRequest } from "./offline.js";

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
window.addEventListener("online", () => { void flush(async (request: QueuedRequest) => { await api(request.path, request.options); }); });
