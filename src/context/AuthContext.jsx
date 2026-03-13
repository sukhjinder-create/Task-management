// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    token: null,
    isReady: false,
  });

  /* ---------------------------------------------
     1. Restore from localStorage on page load
  --------------------------------------------- */
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auth");
      if (stored) {
        const parsed = JSON.parse(stored);

        // 🔥 Global token so axios & socket use it automatically
        window.__AUTH_TOKEN__ = parsed?.token || null;

        setAuth({
          user: parsed?.user || null,
          token: parsed?.token || null,
          isReady: true,
        });
      } else {
        setAuth((prev) => ({ ...prev, isReady: true }));
      }
    } catch (e) {
      console.warn("Unable to restore auth", e);
      setAuth((prev) => ({ ...prev, isReady: true }));
    }
  }, []);

  /* ---------------------------------------------
     2. Login handler → stores auth everywhere
  --------------------------------------------- */
  const login = (user, token) => {
    if (!token) return console.error("Login missing token!");

    const data = { user, token };

    // Store in browser
    localStorage.setItem("auth", JSON.stringify(data));

    // 🔥 Set runtime global token so axios uses it instantly
    window.__AUTH_TOKEN__ = token;

    setAuth({
      user,
      token,
      isReady: true,
    });

    // OPTIONAL: If socket already connected → re-authenticate
    window.dispatchEvent(
      new CustomEvent("auth:updated", { detail: { user, token } })
    );
  };

  /* ---------------------------------------------
     3. Logout → clear everything
  --------------------------------------------- */
  const logout = () => {
    localStorage.removeItem("auth");
    window.__AUTH_TOKEN__ = null;

    setAuth({
      user: null,
      token: null,
      isReady: true,
    });

    window.dispatchEvent(new CustomEvent("auth:logout"));
  };

  const updateUser = (patch) => {
    setAuth((prev) => {
      const updated = { ...prev, user: { ...prev.user, ...patch } };
      localStorage.setItem("auth", JSON.stringify({ user: updated.user, token: updated.token }));
      return updated;
    });
  };

  const value = {
    auth,
    login,
    logout,
    updateUser,
  };

  if (!auth.isReady) return null;

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
