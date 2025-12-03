import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { AuthProvider } from "./context/AuthContext.jsx";
import { HuddleProvider } from "./context/HuddleContext.jsx";   // ⭐ ADD THIS
import { Toaster } from "react-hot-toast";
import "react-quill/dist/quill.snow.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <HuddleProvider>      {/* ⭐ WRAP APP IN HERE */}
          <App />
          <Toaster position="top-right" />
        </HuddleProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
