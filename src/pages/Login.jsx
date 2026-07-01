import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import {
  AUTH_DEV_MODE_ENABLED,
  buildWorkspaceRedirectUrl,
  isConfiguredWorkspaceDomainHost,
} from "../config/runtime";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { getGrowthContextHeaders } from "../services/growthTelemetry";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";

const BACKEND_URL = API_BASE_URL;

const WORKSPACE_BENEFITS = [
  "Projects, tasks, and decisions stay connected.",
  "Workspace access remains role and tenant isolated.",
  "MFA and secure session recovery are built in.",
];

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
      } catch {
        // Runtime globals are an optional compatibility bridge.
      }
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
    if (slug && isConfiguredWorkspaceDomainHost(window.location.hostname)) {
      const targetUrl = buildWorkspaceRedirectUrl(slug, "/projects", {
        _t: token,
        ...(refreshToken ? { _r: refreshToken } : {}),
      });
      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }
    navigate("/projects", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/login`, { email, password }, { headers: getGrowthContextHeaders() });
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
      }, { headers: getGrowthContextHeaders() });
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

  const handleDevLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/dev-login`, {}, { headers: getGrowthContextHeaders() });
      completeLogin(res.data.token, res.data.user, res.data.refreshToken || null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Developer login is not available");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page relative min-h-screen overflow-hidden bg-[var(--app-bg)] text-[color:var(--text)]">
      <div className="login-page-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-32 top-[-12rem] h-[32rem] w-[32rem] rounded-full bg-[color:var(--primary)] opacity-[0.06] blur-[120px]" />

      <header className="relative z-10 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10 lg:py-7">
        <Link to="/" className="group flex items-center gap-3" aria-label="Asystence home">
          <img src="/asystence-logo.png" alt="" className="h-10 w-10 object-contain sm:h-11 sm:w-11" />
          <div>
            <p className="text-lg font-semibold leading-none tracking-[-0.03em]">Asystence</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
              System Intelligence
            </p>
          </div>
        </Link>
        <ThemeSwitcher compact />
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-[1280px] items-center gap-12 px-5 pb-10 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:px-10 lg:pb-16">
        <section className="hidden max-w-[640px] lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)]/75 px-3 py-1.5 text-xs font-medium text-[color:var(--text-muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
            Secure workspace access
          </div>

          <h1 className="mt-8 max-w-[620px] text-[clamp(2.75rem,5vw,4.8rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[color:var(--text)]">
            Get back to the work that matters.
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-8 text-[color:var(--text-muted)]">
            One workspace for execution, communication, and operational intelligence—without losing context between them.
          </p>

          <div className="mt-10 space-y-4">
            {WORKSPACE_BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm text-[color:var(--text-muted)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--surface)]">
                  <Check className="h-3.5 w-3.5 text-[color:var(--primary)]" strokeWidth={2.5} />
                </span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-14 flex items-center gap-3 border-t border-[color:var(--border)] pt-6 text-xs text-[color:var(--text-soft)]">
            <ShieldCheck className="h-4 w-4 text-[color:var(--primary)]" />
            <span>Encrypted sessions</span>
            <span aria-hidden="true">•</span>
            <span>Workspace isolation</span>
            <span aria-hidden="true">•</span>
            <span>MFA ready</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[480px]">
          <div className="login-card rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-8 lg:p-9">
            <div className="mb-7 flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">
                  {mfaRequired ? "Identity verification" : "Workspace sign in"}
                </p>
                <h2 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.04em] text-[color:var(--text)] sm:text-[34px]">
                  {mfaRequired ? "Enter your security code" : "Welcome back"}
                </h2>
                <p className="mt-2.5 text-sm leading-6 text-[color:var(--text-muted)]">
                  {mfaRequired
                    ? "Use the 6-digit code from your authenticator app."
                    : "Sign in with your work account to continue."}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)]">
                {mfaRequired
                  ? <KeyRound className="h-5 w-5 text-[color:var(--primary)]" />
                  : <Lock className="h-5 w-5 text-[color:var(--primary)]" />}
              </span>
            </div>

            {mfaRequired ? (
              <form className="space-y-5" onSubmit={handleMfaSubmit}>
                <div>
                  <label htmlFor="mfa-code" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                    Authenticator code
                  </label>
                  <input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoFocus
                    autoComplete="one-time-code"
                    className="login-input h-14 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--app-bg)] px-4 text-center text-xl tracking-[0.42em] text-[color:var(--text)] outline-none transition"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[color:var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {loading ? "Verifying…" : <>Verify and continue <ArrowRight className="h-4 w-4" /></>}
                </button>

                <button
                  type="button"
                  onClick={() => { setMfaRequired(false); setMfaToken(""); setMfaCode(""); }}
                  className="w-full text-center text-sm font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--text)]"
                >
                  Back to sign in
                </button>
              </form>
            ) : (
              <>
                <>
                    <a
                      href={`${BACKEND_URL}/auth/google`}
                      className="flex h-13 min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--app-bg)] px-4 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-soft)]"
                    >
                      <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      Continue with Google
                    </a>

                    {AUTH_DEV_MODE_ENABLED && (
                      <button
                        type="button"
                        onClick={handleDevLogin}
                        disabled={loading}
                        className="mt-3 flex h-13 min-h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-soft)] px-4 text-sm font-semibold text-[color:var(--text)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface)] disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        Developer sign in
                      </button>
                    )}

                    <div className="my-6 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[color:var(--border)]" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-soft)]">
                        or use email
                      </span>
                      <div className="h-px flex-1 bg-[color:var(--border)]" />
                    </div>
                </>

                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-[color:var(--text)]">
                      Work email
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[color:var(--text-soft)]" />
                      <input
                        id="email"
                        type="email"
                        className="login-input h-13 min-h-[52px] w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--app-bg)] pl-11 pr-4 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)]"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        autoFocus
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <label htmlFor="password" className="text-sm font-medium text-[color:var(--text)]">
                        Password
                      </label>
                      <Link to="/forgot-password" className="text-xs font-semibold text-[color:var(--primary)] transition hover:opacity-75">
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[color:var(--text-soft)]" />
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        className="login-input h-13 min-h-[52px] w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--app-bg)] pl-11 pr-12 text-sm text-[color:var(--text)] outline-none transition placeholder:text-[color:var(--text-soft)]"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[color:var(--text-soft)] transition hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text)]"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="mt-1 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[color:var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {loading ? "Signing in…" : <>Sign in to workspace <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>

                <div className="mt-7 border-t border-[color:var(--border)] pt-6 text-center">
                  <p className="text-sm text-[color:var(--text-muted)]">
                    New to Asystence?{" "}
                    <Link to="/signup" className="font-semibold text-[color:var(--primary)] transition hover:opacity-75">
                      Create a workspace
                    </Link>
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--text-soft)]">
                    Invited or imported? Use the email address that received your access link.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-3 text-xs text-[color:var(--text-soft)]">
            <span>© {new Date().getFullYear()} Asystence</span>
            <span aria-hidden="true">•</span>
            <Link to="/sla" className="transition hover:text-[color:var(--text-muted)]">SLA</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
