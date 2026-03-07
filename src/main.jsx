// src/main.jsx (or index.jsx)
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { HuddleProvider } from "./context/HuddleContext.jsx";
import { SuperadminAuthProvider } from "./context/SuperadminAuthContext.jsx";
import { Toaster } from "react-hot-toast";
import "react-quill/dist/quill.snow.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SuperadminAuthProvider>
            <HuddleProvider>
              <App />
              <Toaster position="top-right" />
            </HuddleProvider>
          </SuperadminAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
