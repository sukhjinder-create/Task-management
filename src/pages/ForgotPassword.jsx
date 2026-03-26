import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";

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
    <div className="min-h-screen flex items-center justify-center theme-bg p-4">
      <div className="fixed top-4 right-4">
        <ThemeSwitcher compact />
      </div>
      <div className="theme-surface border theme-border rounded-xl shadow p-6 w-full max-w-md">
        <h1 className="text-lg font-semibold mb-1 text-center theme-text">Reset your password</h1>
        <p className="text-sm theme-text-muted text-center mb-5">
          Enter your email and we'll send you a reset link.
        </p>

        {sent ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 text-center">
              ✅ Check your inbox — if an account exists for <strong>{email}</strong>,
              a reset link has been sent. It expires in 1 hour.
            </div>
            <Link
              to="/login"
              className="block text-center text-sm text-indigo-500 hover:text-indigo-600"
            >
              ← Back to login
            </Link>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-medium theme-text-muted mb-1">Email</label>
              <input
                type="email"
                className="w-full border theme-border theme-surface theme-text rounded-lg px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full theme-primary rounded-lg py-2 text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send reset link"}
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
