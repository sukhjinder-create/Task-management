import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Show error passed back from Google SSO redirect
  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "google_cancelled") return; // silent
    if (err) toast.error(decodeURIComponent(err));
  }, [searchParams]);

  const safePersistAuth = (user, token) => {
    try {
      // keep backward compatible storage shape: { token, user }
      const payload = { token, user };
      localStorage.setItem("auth", JSON.stringify(payload));

      // set window globals used by socket.js and other legacy code
      try {
        window.__AUTH_TOKEN__ = token;
        window.__WORKSPACE_ID__ = user?.workspaceId || user?.workspace_id || "GLOBAL";
      } catch (e) {
        // ignore
      }

      // Notify other parts of app (socket.js listens for this)
      window.dispatchEvent(new Event("auth:updated"));
    } catch (err) {
      console.warn("Failed to persist auth to localStorage:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password,
      });

      // Backend returns: { token, user }
      const { token, user } = res.data;

      // Persist auth locally (safe duplicate if AuthContext also persists)
      safePersistAuth(user, token);

      // ✅ Pass correct arguments to AuthContext (keep behaviour)
      // AuthContext.login may set app-level state
      try {
        login(user, token);
      } catch (err) {
        // If AuthContext.login unexpectedly throws, don't block the flow.
        console.warn("AuthContext.login call threw:", err);
      }

      toast.success(`Logged in as ${user.username}`);

      // navigate to main projects page
      navigate("/projects", { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      const msg = err.response?.data?.error || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center theme-bg p-4">
      <div className="fixed top-4 right-4">
        <ThemeSwitcher compact />
      </div>
      <div className="theme-surface border theme-border rounded-xl shadow p-6 w-full max-w-md">
        <h1 className="text-lg font-semibold mb-4 text-center theme-text">
          Task Management Login
        </h1>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full border theme-border theme-surface theme-text rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">
              Password
            </label>
            <input
              type="password"
              className="w-full border theme-border theme-surface theme-text rounded-lg px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full theme-primary rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* ── Divider ── */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px theme-border border-t" />
          <span className="text-xs theme-text-muted">or</span>
          <div className="flex-1 h-px theme-border border-t" />
        </div>

        {/* ── Google SSO ── */}
        <a
          href={`${BACKEND_URL}/auth/google`}
          className="flex items-center justify-center gap-2 w-full border theme-border theme-surface theme-text rounded-lg py-2 text-sm font-medium hover:opacity-80 transition-opacity"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </a>

        <p className="text-center text-xs theme-text-muted mt-3">
          Imported via Slack or another tool?{" "}
          <span className="text-indigo-500">Check your email for your access link.</span>
        </p>
      </div>
    </div>
  );
}
