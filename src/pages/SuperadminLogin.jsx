import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useSuperadminAuth } from "../context/SuperadminAuthContext";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Eye, EyeOff, ArrowRight, Mail, Lock } from "lucide-react";

export default function SuperadminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

      const { token, refreshToken, superadmin } = res.data || {};
      if (!token || !refreshToken || !superadmin) {
        toast.error("Login failed");
        return;
      }

      // SINGLE SOURCE OF TRUTH
      login(superadmin, token, refreshToken);

      toast.success("Welcome, superadmin");
      const destination = String(location.state?.from || "/superadmin/workspaces");
      navigate(destination.startsWith("/superadmin") ? destination : "/superadmin/workspaces", { replace: true });
    } catch (err) {
      console.error("Superadmin login error:", err);
      const msg = err.response?.data?.error || "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center p-4 relative">
      <div className="fixed top-4 right-4 z-10">
        <ThemeSwitcher compact />
      </div>

      <div className="border border-[color:var(--border)] rounded-xl p-8 w-full max-w-sm">
        {/* Heading */}
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-2">
            Superadmin
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            Sign in.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
            Platform administration access.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-soft)] pointer-events-none" />
              <input
                type="email"
                className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] pl-10 pr-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="admin@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-soft)] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] pl-10 pr-10 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)] hover:text-[color:var(--text)] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-white rounded-[8px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? "Signing in…" : (<>Sign in as Superadmin <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      </div>
    </div>
  );
}
