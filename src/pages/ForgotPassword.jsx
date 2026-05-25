import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { Mail, ArrowRight, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error("Please enter your email"); return; }

    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Something went wrong");
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
            Reset your password.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]">
              <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
              <p className="text-sm text-[color:var(--text-muted)] leading-relaxed">
                If an account exists for <span className="text-[color:var(--text)]">{email}</span>,
                a reset link has been sent. It expires in 1 hour.
              </p>
            </div>
            <Link
              to="/login"
              className="block text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
            >
              ← Back to login
            </Link>
          </div>
        ) : (
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
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-[8px] text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending…" : (<>Send reset link <ArrowRight className="w-4 h-4" /></>)}
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
