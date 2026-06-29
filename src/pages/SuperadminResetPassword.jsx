import { useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowRight, CheckCircle, Eye, EyeOff } from "lucide-react";
import { API_BASE_URL } from "../api";
import ThemeSwitcher from "../components/ThemeSwitcher";

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

export default function SuperadminResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!STRONG_PASSWORD.test(password)) {
      toast.error("Use 12+ characters with upper, lower, number, and symbol");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/superadmin/reset-password`, { token, password });
      setDone(true);
      toast.success("Super Admin password updated");
      setTimeout(() => navigate("/superadmin/login", { replace: true }), 1800);
    } catch (error) {
      toast.error(error.response?.data?.error || "Password reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex items-center justify-center p-4 relative">
      <div className="fixed top-4 right-4 z-10"><ThemeSwitcher compact /></div>
      <div className="border border-[color:var(--border)] rounded-xl p-8 w-full max-w-sm">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-2">Super Admin recovery</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Set a new password.</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">Use a strong password that is unique to platform administration.</p>
        </div>

        {!token ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
              <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">This reset link is missing or invalid. Request a new link.</p>
            </div>
            <Link to="/superadmin/forgot-password" className="block text-center text-xs text-[color:var(--primary)] hover:text-[color:var(--primary-hover)] transition-colors">Request a new link</Link>
          </div>
        ) : done ? (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
            <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">Password updated. All existing Super Admin sessions were signed out. Redirecting to login...</p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="superadmin-new-password" className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">New password</label>
              <div className="relative">
                <input
                  id="superadmin-new-password"
                  type={showPassword ? "text" : "password"}
                  className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 pr-10 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder="12+ strong characters"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)] hover:text-[color:var(--text)]" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[color:var(--text-soft)]">Uppercase, lowercase, number, and symbol required.</p>
            </div>
            <div>
              <label htmlFor="superadmin-confirm-password" className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">Confirm password</label>
              <input
                id="superadmin-confirm-password"
                type={showPassword ? "text" : "password"}
                className="w-full h-10 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-3 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat the new password"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-white rounded-[8px] text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {loading ? "Saving..." : <>Set new password <ArrowRight className="w-4 h-4" /></>}
            </button>
            <Link to="/superadmin/login" className="block text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">Back to Super Admin login</Link>
          </form>
        )}
      </div>
    </div>
  );
}
