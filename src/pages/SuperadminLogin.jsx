import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";

export default function SuperadminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { login } = useSuperadminAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/superadmin/login`, {
        email,
        password,
      });

      const { token, superadmin } = res.data || {};
      if (!token || !superadmin) {
        toast.error("Login failed");
        return;
      }

      // ✅ SINGLE SOURCE OF TRUTH
      login(superadmin, token);

      toast.success("Welcome, superadmin");
      navigate("/superadmin/workspaces", { replace: true });
    } catch (err) {
      console.error("Superadmin login error:", err);
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
      <div className="w-full max-w-md theme-surface border theme-border rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4 text-center">
          Superadmin Login
        </h2>

        <form className="space-y-3" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">
              Email
            </label>
            <input
              type="email"
              className="w-full border theme-border theme-surface rounded-lg px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-medium theme-text-muted mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border theme-border theme-surface rounded-lg px-3 py-2 text-sm pr-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 theme-text-muted hover:opacity-70"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full theme-primary rounded-lg py-2 text-sm"
          >
            {loading ? "Signing in..." : "Sign in as Superadmin"}
          </button>
        </form>
      </div>
    </div>
  );
}
