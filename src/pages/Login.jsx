import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import AppBrand from "../components/AppBrand";
import { Eye, EyeOff, ShieldCheck, ArrowRight, Lock, Mail } from "lucide-react";
import { isCapacitor } from "../utils/native";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // MFA second step
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    const err = searchParams.get("error");
    if (err === "google_cancelled") return;
    if (err) toast.error(decodeURIComponent(err));
  }, [searchParams]);

  const safePersistAuth = (user, token, refreshToken = null) => {
    try {
      const payload = { token, user, refreshToken };
      localStorage.setItem("auth", JSON.stringify(payload));
      try {
        window.__AUTH_TOKEN__ = token;
        window.__WORKSPACE_ID__ = user?.workspaceId || user?.workspace_id || "GLOBAL";
      } catch {}
      window.dispatchEvent(new Event("auth:updated"));
    } catch (err) {
      console.warn("Failed to persist auth to localStorage:", err);
    }
  };

  const completeLogin = (token, user, refreshToken = null) => {
    safePersistAuth(user, token, refreshToken);
    try { login(user, token, refreshToken); } catch (err) { console.warn("AuthContext.login threw:", err); }
    toast.success(`Logged in as ${user.username}`);
    const slug = user?.workspace_slug;
    const isProduction = window.location.hostname.endsWith("asystence.com");
    if (slug && isProduction) {
      window.location.href = `https://${slug}.asystence.com/projects?_t=${token}`;
    } else {
      navigate("/projects", { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
      if (res.data.mfa_required) {
        setMfaToken(res.data.mfa_session_token);
        setMfaRequired(true);
        return;
      }
      completeLogin(res.data.token, res.data.user, res.data.refreshToken || null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaCode) { toast.error("Enter your 6-digit code"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/mfa/verify`, {
        mfa_session_token: mfaToken,
        code: mfaCode,
      });
      completeLogin(res.data.token, res.data.user, res.data.refreshToken || null);
    } catch (err) {
      const msg = err.response?.data?.error || "Invalid code";
      toast.error(msg);
      if (msg.includes("expired")) {
        setMfaRequired(false);
        setMfaToken("");
        setMfaCode("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex theme-bg theme-text relative">
      {/* Top-right utility */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeSwitcher compact />
      </div>

      {/* Left: form */}
      <div className="flex-1 flex flex-col px-6 sm:px-10 md:px-16 lg:px-20 py-8 max-w-[640px] w-full mx-auto lg:mx-0">
        <div className="mb-12">
          <AppBrand />
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-[420px] w-full">
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-2">
              {mfaRequired ? "Two-factor authentication" : "Sign in"}
            </p>
            <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
              {mfaRequired ? "Verify it's you." : "Welcome back."}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--text-muted)] leading-relaxed">
              {mfaRequired
                ? "Enter the 6-digit code from your authenticator app to continue."
                : "Sign in to your workspace to access projects, chat, and operational intelligence."}
            </p>
          </div>

          {mfaRequired ? (
            <form className="space-y-4" onSubmit={handleMfaSubmit}>
              <div className="flex items-start gap-2.5 p-3 rounded-[8px] border border-[color:color-mix(in_srgb,var(--primary)_28%,var(--border))] bg-[var(--primary-soft)]">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-[color:var(--primary)]" />
                <p className="text-xs text-[color:var(--text-muted)] leading-relaxed">
                  Two-factor authentication is enabled on this account.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight">
                  Authenticator code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoFocus
                  className="w-full h-12 bg-[var(--surface)] border border-[color:var(--border)] rounded-[8px] px-4 text-center tracking-[0.5em] text-xl font-mono text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-[8px] text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {loading ? "Verifying…" : (<>Verify & continue <ArrowRight className="w-4 h-4" /></>)}
              </button>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaToken(""); setMfaCode(""); }}
                className="w-full text-center text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
              >
                ← Back to sign-in
              </button>
            </form>
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
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[color:var(--text-muted)] tracking-tight">
                    Password
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-[color:var(--primary)] hover:text-[color:var(--primary-hover)] transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
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
                className="w-full h-10 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-[8px] text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {loading ? "Signing in…" : (<>Sign in <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>
          )}

          {!mfaRequired && !isCapacitor && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[color:var(--border)]" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--text-soft)] font-semibold">or continue with</span>
                <div className="flex-1 h-px bg-[color:var(--border)]" />
              </div>

              <a
                href={`${BACKEND_URL}/auth/google`}
                className="flex items-center justify-center gap-2.5 w-full h-10 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text)] rounded-[8px] text-sm font-medium transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </a>
            </>
          )}

          {!mfaRequired && (
            <p className="text-center text-xs text-[color:var(--text-muted)] mt-6 leading-relaxed">
              Imported via Slack or another tool?{" "}
              <span className="text-[color:var(--primary)]">Check your email for your access link.</span>
            </p>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[color:var(--border)] text-[11px] text-[color:var(--text-soft)] flex items-center justify-between">
          <span>© {new Date().getFullYear()} Asystence</span>
          <Link to="/sla" className="hover:text-[color:var(--text-muted)] transition-colors">Service Level Agreement</Link>
        </div>
      </div>

      {/* Right: brand panel — visible on lg+ only */}
      <div className="hidden lg:flex flex-1 relative border-l border-[color:var(--border)] overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--primary) 22%, transparent) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 55%), var(--app-bg)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--text) 1px, transparent 1px), linear-gradient(to bottom, var(--text) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse at center, black 0%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at center, black 0%, transparent 75%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 max-w-[560px]">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--primary)] font-semibold mb-4">
            A System Intelligence
          </p>
          <h2 className="text-4xl font-semibold tracking-tight text-[color:var(--text)] leading-[1.1]">
            Your operational
            <br />
            command center.
          </h2>
          <p className="mt-5 text-[15px] text-[color:var(--text-muted)] leading-relaxed">
            Projects, people, performance, and AI-driven intelligence — unified in a
            single, deeply integrated workspace.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-y-4 gap-x-8 max-w-[420px]">
            {[
              ["Realtime", "Sub-second sync across teams"],
              ["Native AI", "Workspace-aware intelligence"],
              ["Audit-ready", "Compliance baked-in"],
              ["Single pane", "Tasks, chat, docs, OKRs"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] uppercase tracking-[0.14em] text-[color:var(--primary)] font-semibold">{k}</p>
                <p className="text-[13px] text-[color:var(--text-muted)] mt-1 leading-snug">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
