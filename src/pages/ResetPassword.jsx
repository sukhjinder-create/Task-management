import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // If no token in URL, show error immediately
  const hasToken = token.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) { toast.error("Enter a new password"); return; }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (password !== confirm) { toast.error("Passwords do not match"); return; }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/reset-password`, { token, password });
      setDone(true);
      toast.success("Password updated! Redirecting…");
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      toast.error(err.response?.data?.error || "Reset failed");
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
            Password recovery
          </p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            Set new password.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
            Choose a new password for your account.
          </p>
        </div>

        {!hasToken ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
              <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
                Invalid or missing reset link. Please request a new one.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="block text-center text-xs text-[color:var(--primary)] hover:text-[color:var(--primary-hover)] transition-colors"
            >
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
              <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
                Password updated successfully. Redirecting to login…
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
                New password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 pr-10 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  autoFocus
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

            <div>
              <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
                Confirm password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            </div>

            {password && confirm && password !== confirm && (
              <p className="text-xs text-[color:var(--primary)]">Passwords do not match</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-[8px] text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? "Saving…" : (<>Set new password <ArrowRight className="w-4 h-4" /></>)}
            </button>

            <Link
              to="/login"
              className="block text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
            >
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
