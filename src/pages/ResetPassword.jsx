import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center theme-bg p-4">
      <div className="fixed top-4 right-4">
        <ThemeSwitcher compact />
      </div>
      <div className="theme-surface border theme-border rounded-xl shadow p-6 w-full max-w-md">
        <h1 className="text-lg font-semibold mb-1 text-center theme-text">Set new password</h1>
        <p className="text-sm theme-text-muted text-center mb-5">
          Choose a new password for your account.
        </p>

        {!hasToken ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800 text-center">
              ⚠️ Invalid or missing reset link. Please request a new one.
            </div>
            <Link to="/forgot-password" className="block text-center text-sm text-indigo-500 hover:text-indigo-600">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 text-center">
              ✅ Password updated successfully. Redirecting to login…
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium theme-text-muted mb-1">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full border theme-border theme-surface theme-text rounded-lg px-3 py-2 pr-10 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 theme-text-muted hover:theme-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium theme-text-muted mb-1">Confirm password</label>
              <input
                type={showPassword ? "text" : "password"}
                className="w-full border theme-border theme-surface theme-text rounded-lg px-3 py-2 text-sm"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
              />
            </div>

            {password && confirm && password !== confirm && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full theme-primary rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>

            <Link
              to="/login"
              className="block text-center text-xs theme-text-muted hover:theme-text"
            >
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
