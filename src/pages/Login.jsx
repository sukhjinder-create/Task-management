import { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import ThemeSwitcher from "../components/ThemeSwitcher";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  Lock,
  Mail,
  ClipboardCheck,
  MessageSquare,
  Brain,
  Activity,
  Users,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { isCapacitor } from "../utils/native";

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const PRODUCT_FEATURES = [
  {
    icon: ClipboardCheck,
    title: "Project execution",
    description: "Track projects, tasks, subtasks, owners, blockers, and due dates from one operational workspace.",
  },
  {
    icon: MessageSquare,
    title: "Team chat",
    description: "Keep project conversations, huddles, mentions, and workspace updates close to the work.",
  },
  {
    icon: Brain,
    title: "AI intelligence",
    description: "Use workspace signals, executive summaries, and AI-assisted views to spot risk earlier.",
  },
  {
    icon: CalendarClock,
    title: "Attendance and reviews",
    description: "Connect daily presence, leave, performance reviews, and reporting into the same execution layer.",
  },
];

const PRODUCT_SIGNALS = [
  { label: "Task health", value: "Live" },
  { label: "Workspace memory", value: "AI" },
  { label: "Admin controls", value: "Built in" },
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

  const authForm = (
    <>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] brand-orange-text font-semibold mb-2.5">
          {mfaRequired ? "Two-factor authentication" : "Sign in"}
        </p>
        <h1 className="text-[38px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
          {mfaRequired ? "Verify it's you." : "Welcome back."}
        </h1>
        <p className="mt-3 text-[17px] text-[color:var(--text-muted)] leading-8">
          {mfaRequired
            ? "Enter the 6-digit code from your authenticator app to continue."
            : "Sign in to your workspace to access projects, chat, and operational intelligence."}
        </p>
      </div>

      {mfaRequired ? (
        <form className="space-y-5" onSubmit={handleMfaSubmit}>
          <div className="flex items-start gap-2.5 p-3 rounded-lg border brand-orange-border">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 brand-orange-text" />
            <p className="text-sm text-[color:var(--text-muted)] leading-6">
              Two-factor authentication is enabled on this account.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
              Authenticator code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              autoFocus
              className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg px-4 text-center tracking-[0.5em] text-2xl text-[color:var(--text)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-[17px] font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying..." : (<>Verify and continue <ArrowRight className="w-4 h-4" /></>)}
          </button>

          <button
            type="button"
            onClick={() => { setMfaRequired(false); setMfaToken(""); setMfaCode(""); }}
            className="w-full text-center text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors"
          >
            Back to sign-in
          </button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-soft)] pointer-events-none" />
              <input
                type="email"
                className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg pl-12 pr-4 text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[color:var(--text-muted)] tracking-tight">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-sm brand-orange-text hover:opacity-80 transition-opacity"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-soft)] pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg pl-12 pr-12 text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)] hover:text-[color:var(--text)] transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-16 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-[17px] font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in..." : (<>Sign in <ArrowRight className="w-4 h-4" /></>)}
          </button>
        </form>
      )}

      {!mfaRequired && !isCapacitor && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[color:var(--border)]" />
            <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)] font-semibold">or continue with</span>
            <div className="flex-1 h-px bg-[color:var(--border)]" />
          </div>

          <a
            href={`${BACKEND_URL}/auth/google`}
            className="flex items-center justify-center gap-2.5 w-full h-16 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text)] rounded-lg text-[17px] font-medium transition-colors"
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
        <p className="text-center text-sm text-[color:var(--text-muted)] mt-6 leading-6">
          Imported via Slack or another tool?{" "}
          <span className="brand-orange-text">Check your email for your access link.</span>
        </p>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--text)] relative overflow-hidden">
      <div className="fixed top-4 right-4 z-20">
        <ThemeSwitcher compact />
      </div>

      <main className="min-h-screen grid lg:grid-cols-2 gap-10 lg:gap-12 xl:gap-14 px-6 py-8 sm:px-10 lg:px-12 xl:px-14">
        <section className="relative min-h-[46vh] lg:min-h-[calc(100vh-4rem)] flex">
          <div className="w-full flex flex-col">
            <div className="mb-7 flex items-center gap-2.5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center -ml-1">
                <img
                  src="/asystence-logo.png"
                  alt="Asystence"
                  className="h-16 w-16 object-contain"
                />
              </div>
              <div>
                <p className="text-[32px] font-semibold tracking-tight leading-none text-[color:var(--text)]">
                  Asystence
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-[color:var(--text-soft)]">
                  System Intelligence
                </p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-7">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] brand-orange-text font-semibold mb-3">
                  Workspace command center
                </p>
                <h2 className="max-w-3xl text-[34px] sm:text-[44px] xl:text-[54px] font-semibold tracking-tight leading-[1.05] text-[color:var(--text)]">
                  Run projects, people, and intelligence from one focused workspace.
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">
                  Asystence brings task execution, team communication, AI insights, attendance, reviews, and admin control into a single operational surface.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {PRODUCT_SIGNALS.map((signal) => (
                  <div key={signal.label} className="border border-[color:var(--border)] rounded-lg p-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-soft)] font-semibold">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold brand-orange-text">{signal.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {PRODUCT_FEATURES.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="border border-[color:var(--border)] rounded-lg p-4 flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border brand-orange-border">
                      <Icon className="h-4 w-4 brand-orange-text" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-[color:var(--text)]">{title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-[color:var(--border)] rounded-lg p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg brand-orange-bg text-[#0a0a0b]">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--text)]">Live operational pulse</p>
                      <p className="text-xs text-[color:var(--text-muted)]">Tasks, blockers, people, and workspace health stay connected.</p>
                    </div>
                  </div>
                  <CheckCircle2 className="hidden sm:block h-5 w-5 brand-orange-text" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="min-h-[46vh] lg:min-h-[calc(100vh-4rem)] flex items-center">
          <div className="w-full">
            <div className="w-full">
              <div className="mb-7 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)] font-semibold">Secure access</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">Workspace login</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border brand-orange-border">
                  <Users className="h-4 w-4 brand-orange-text" />
                </div>
              </div>

              {authForm}

              <div className="mt-8 pt-6 border-t border-[color:var(--border)] text-xs text-[color:var(--text-soft)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src="/asystence-logo.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain shrink-0"
                  />
                  <span>{new Date().getFullYear()} Asystence</span>
                </div>
                <Link to="/sla" className="hover:text-[color:var(--text-muted)] transition-colors">SLA</Link>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
