// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { initSocket } from "../socket";
import toast from "react-hot-toast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    token: null,
    user: null,
  });

  // Load from localStorage on first mount
  useEffect(() => {
    const stored = localStorage.getItem("auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user) {
          setAuth(parsed);
          // init socket as well
          initSocket(parsed.token);
        }
      } catch (err) {
        console.error("Failed to parse stored auth", err);
      }
    }
  }, []);

  const login = ({ token, user }) => {
    const data = { token, user };
    setAuth(data);
    localStorage.setItem("auth", JSON.stringify(data));

    try {
      initSocket(token);
    } catch (err) {
      console.error("Socket init error on login:", err);
    }

    toast.success(`Welcome ${user.username}`);
  };

  const logout = () => {
    setAuth({ token: null, user: null });
    localStorage.removeItem("auth");
    toast("Logged out");
    // (optional) could disconnect socket here
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
