// src/main.jsx (or index.jsx)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
// Load mobile-specific styles only when running in Capacitor (iOS/Android)
if (typeof window !== "undefined" && window.Capacitor) {
  import("./mobile.css");
}
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { HuddleProvider } from "./context/HuddleContext.jsx";
import { SuperadminAuthProvider } from "./context/SuperadminAuthContext.jsx";
import { PlanProvider } from "./context/PlanContext.jsx";
import { Toaster } from "react-hot-toast";
import "react-quill/dist/quill.snow.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PlanProvider>
          <SuperadminAuthProvider>
            <HuddleProvider>
              <App />
              <Toaster
                position={typeof window !== "undefined" && window.Capacitor ? "top-center" : "top-right"}
                toastOptions={{ style: { maxWidth: "90vw" } }}
              />
            </HuddleProvider>
          </SuperadminAuthProvider>
          </PlanProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
