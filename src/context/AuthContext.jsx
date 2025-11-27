// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";

// We no longer need setApiToken from api.js because
// api.js now reads token directly from localStorage via an interceptor.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    user: null,
    token: null,
    isReady: false,
  });

  // On first load, restore auth from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAuth({
          user: parsed.user || null,
          token: parsed.token || null,
          isReady: true,
        });
      } else {
        setAuth((prev) => ({ ...prev, isReady: true }));
      }
    } catch (e) {
      console.warn("Failed to read auth from localStorage", e);
      setAuth((prev) => ({ ...prev, isReady: true }));
    }
  }, []);

  // Called from Login page when backend returns user + token
  const login = (user, token) => {
    const data = { user, token };
    localStorage.setItem("auth", JSON.stringify(data));
    setAuth({
      user,
      token,
      isReady: true,
    });
    // No need to manually set token on axios:
    // api.js interceptor reads it from localStorage on every request.
  };

  const logout = () => {
    localStorage.removeItem("auth");
    setAuth({
      user: null,
      token: null,
      isReady: true,
    });
  };

  const value = {
    auth,
    login,
    logout,
  };

  // Optional: you can show a loader instead of null while auth is restoring
  if (!auth.isReady) {
    return null;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
