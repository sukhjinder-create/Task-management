// src/context/SuperadminAuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

/**
 * SuperadminAuthContext
 *
 * Stores a separate superadmin session so it doesn't conflict with normal user auth.
 * Key: localStorage.superadmin_auth -> { token, superadmin }
 *
 * Exposes:
 *  - superadmin: { id, email, ... } | null
 *  - token: string | null
 *  - ready: boolean (hydration complete)
 *  - login(superadminObj, token)
 *  - logout()
 *
 * The provider listens for:
 *  - window event 'superadmin:login' (dispatched by login page)
 *  - storage events (multi-tab)
 *
 * This avoids ProtectedSuperadmin redirecting prematurely.
 */

const SuperadminAuthContext = createContext(null);

export function SuperadminAuthProvider({ children }) {
  const [superadmin, setSuperadmin] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("superadmin_auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        const t = parsed?.token || null;
        const sa = parsed?.superadmin || parsed?.user || null; // tolerate backend variations
        setToken(t);
        setSuperadmin(sa);
        // global variable so socket/axios code can reuse if needed
        window.__SUPERADMIN_TOKEN__ = t || null;
        console.log("[SuperadminAuth] hydrated from localStorage:", !!t, sa?.email || sa?.id || null);
      } else {
        window.__SUPERADMIN_TOKEN__ = null;
      }
    } catch (err) {
      console.warn("[SuperadminAuth] hydration failed:", err);
      window.__SUPERADMIN_TOKEN__ = null;
    } finally {
      setReady(true);
    }
  }, []);

  // login helper — call this from SuperadminLogin if you want context-aware login
  const login = useCallback((superadminObj, jwtToken) => {
    if (!jwtToken) {
      console.error("[SuperadminAuth] login missing token");
      return;
    }
    try {
      const data = { token: jwtToken, superadmin: superadminObj };
      localStorage.setItem("superadmin_auth", JSON.stringify(data));
      setToken(jwtToken);
      setSuperadmin(superadminObj);
      window.__SUPERADMIN_TOKEN__ = jwtToken;
      // notify other listeners (pages) that login happened
      window.dispatchEvent(new CustomEvent("superadmin:login", { detail: { id: superadminObj?.id } }));
      console.log("[SuperadminAuth] login saved", superadminObj?.email || superadminObj?.id);
    } catch (err) {
      console.error("[SuperadminAuth] login failed:", err);
    }
  }, []);

  // logout helper
  const logout = useCallback(() => {
    try {
      localStorage.removeItem("superadmin_auth");
      setSuperadmin(null);
      setToken(null);
      window.__SUPERADMIN_TOKEN__ = null;
      window.dispatchEvent(new CustomEvent("superadmin:logout"));
      console.log("[SuperadminAuth] logged out");
    } catch (err) {
      console.error("[SuperadminAuth] logout error:", err);
    }
  }, []);

  // listen for explicit events and storage changes (multi-tab)
  useEffect(() => {
    const onLoginEv = (ev) => {
      try {
        // When a login event fires (e.g. SuperadminLogin saved localStorage),
        // rehydrate state from storage to be safe.
        const raw = localStorage.getItem("superadmin_auth");
        if (raw) {
          const parsed = JSON.parse(raw);
          setToken(parsed?.token || null);
          setSuperadmin(parsed?.superadmin || parsed?.user || null);
          window.__SUPERADMIN_TOKEN__ = parsed?.token || null;
          console.log("[SuperadminAuth] event -> hydrated superadmin");
        }
      } catch (err) {
        console.warn("[SuperadminAuth] event login handler failed", err);
      }
    };

    const onLogoutEv = () => {
      setSuperadmin(null);
      setToken(null);
      window.__SUPERADMIN_TOKEN__ = null;
      console.log("[SuperadminAuth] event -> logout");
    };

    const onStorage = (e) => {
      if (e.key === "superadmin_auth") {
        if (e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            setToken(parsed?.token || null);
            setSuperadmin(parsed?.superadmin || parsed?.user || null);
            window.__SUPERADMIN_TOKEN__ = parsed?.token || null;
            console.log("[SuperadminAuth] storage event -> set superadmin");
          } catch (err) {
            console.warn("[SuperadminAuth] storage parse failed", err);
          }
        } else {
          setSuperadmin(null);
          setToken(null);
          window.__SUPERADMIN_TOKEN__ = null;
          console.log("[SuperadminAuth] storage event -> cleared superadmin");
        }
      }
    };

    window.addEventListener("superadmin:login", onLoginEv);
    window.addEventListener("superadmin:logout", onLogoutEv);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("superadmin:login", onLoginEv);
      window.removeEventListener("superadmin:logout", onLogoutEv);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = {
    superadmin,
    token,
    ready,
    login,
    logout,
  };

  // Wait for hydration to avoid ProtectedSuperadmin redirecting prematurely
  if (!ready) {
    return null;
  }

  return <SuperadminAuthContext.Provider value={value}>{children}</SuperadminAuthContext.Provider>;
}

export function useSuperadminAuth() {
  const ctx = useContext(SuperadminAuthContext);
  if (!ctx) throw new Error("useSuperadminAuth must be used within SuperadminAuthProvider");
  return ctx;
}
