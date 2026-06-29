/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import superadminApi, {
  clearSuperadminSession,
  readSuperadminSession,
  SUPERADMIN_STORAGE_KEY,
  writeSuperadminSession,
} from "../superadminApi";

const SuperadminAuthContext = createContext(null);

function validSuperadmin(value) {
  return value?.role === "superadmin" && value?.id && value?.email;
}

export function SuperadminAuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    const stored = readSuperadminSession();
    if (stored?.token && stored?.refreshToken && validSuperadmin(stored.superadmin)) {
      window.__SUPERADMIN_TOKEN__ = stored.token;
      return stored;
    }
    window.__SUPERADMIN_TOKEN__ = null;
    return null;
  });
  const ready = true;

  useEffect(() => {
    const apply = (next) => {
      if (next?.token && next?.refreshToken && validSuperadmin(next.superadmin)) setSession(next);
      else setSession(null);
    };
    const onUpdated = (event) => apply(event.detail);
    const onCleared = () => setSession(null);
    const onStorage = (event) => {
      if (event.key !== SUPERADMIN_STORAGE_KEY) return;
      try { apply(event.newValue ? JSON.parse(event.newValue) : null); } catch { apply(null); }
    };
    window.addEventListener("superadmin:session-updated", onUpdated);
    window.addEventListener("superadmin:session-cleared", onCleared);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("superadmin:session-updated", onUpdated);
      window.removeEventListener("superadmin:session-cleared", onCleared);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = useCallback((superadmin, token, refreshToken) => {
    if (!token || !refreshToken || !validSuperadmin(superadmin)) {
      throw new Error("Invalid Super Admin session response");
    }
    const next = { token, refreshToken, superadmin };
    writeSuperadminSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    const current = readSuperadminSession();
    if (current?.token && current?.refreshToken) {
      superadminApi.post(
        "/superadmin/logout",
        { refreshToken: current.refreshToken },
        { headers: { Authorization: `Bearer ${current.token}` } }
      ).catch(() => {});
    }
    clearSuperadminSession("logout");
    setSession(null);
  }, []);

  const value = useMemo(() => ({
    superadmin: session?.superadmin || null,
    token: session?.token || null,
    refreshToken: session?.refreshToken || null,
    ready,
    login,
    logout,
  }), [session, ready, login, logout]);

  return <SuperadminAuthContext.Provider value={value}>{children}</SuperadminAuthContext.Provider>;
}

export function useSuperadminAuth() {
  const value = useContext(SuperadminAuthContext);
  if (!value) throw new Error("useSuperadminAuth must be used inside SuperadminAuthProvider");
  return value;
}
