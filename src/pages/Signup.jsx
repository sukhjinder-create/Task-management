import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { API_BASE_URL } from "../api";
import ThemeSwitcher from "../components/ThemeSwitcher";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { isCapacitor } from "../utils/native";

const BACKEND_URL = API_BASE_URL;

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");
    if (!err || err === "google_cancelled") return;
    const message = err === "workspace_required"
      ? "Name your workspace before continuing with Google."
      : decodeURIComponent(err);
    toast.error(message);
  }, [searchParams]);

  const googleSignupUrl = useMemo(() => {
    const params = new URLSearchParams({
      mode: "signup",
      workspaceName: workspaceName.trim(),
    });
    return `${BACKEND_URL}/auth/google?${params.toString()}`;
  }, [workspaceName]);

  const safePersistAuth = (user, token, refreshToken = null) => {
    const payload = { token, user, refreshToken };
    localStorage.setItem("auth", JSON.stringify(payload));
    try {
      window.__AUTH_TOKEN__ = token;
      window.__WORKSPACE_ID__ = user?.workspaceId || user?.workspace_id || "GLOBAL";
    } catch {}
    window.dispatchEvent(new Event("auth:updated"));
  };

  const redirectToWorkspace = (user, token, refreshToken = null) => {
    const slug = user?.workspace_slug;
    const isProduction = window.location.hostname.endsWith("asystence.com");
    if (slug && isProduction) {
      const refreshParam = refreshToken ? `&_r=${encodeURIComponent(refreshToken)}` : "";
      window.location.href = `https://${slug}.asystence.com/projects?_t=${encodeURIComponent(token)}${refreshParam}`;
    } else {
      navigate("/projects", { replace: true });
    }
  };

  const completeSignup = (token, user, refreshToken = null) => {
    safePersistAuth(user, token, refreshToken);
    login(user, token, refreshToken);
    toast.success("Workspace created. Your free trial is active.");
    redirectToWorkspace(user, token, refreshToken);
  };

  const validateRequired = () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required");
      return false;
    }
    if (!name.trim()) {
      toast.error("Your name is required");
      return false;
    }
    if (!email.trim()) {
      toast.error("Email is required");
      return false;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateRequired()) return;

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/signup/workspace`, {
        workspaceName,
        name,
        email,
        password,
      });
      completeSignup(res.data.token, res.data.user, res.data.refreshToken || null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not create workspace");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required before Google signup");
      return;
    }
    setGoogleLoading(true);
    window.location.href = googleSignupUrl;
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--text)] relative overflow-hidden">
      <div className="fixed top-4 right-4 z-20">
        <ThemeSwitcher compact />
      </div>

      <main className="min-h-screen grid lg:grid-cols-2 gap-10 lg:gap-12 xl:gap-14 px-6 py-8 sm:px-10 lg:px-12 xl:px-14">
        <section className="relative min-h-[42vh] lg:min-h-[calc(100vh-4rem)] flex">
          <div className="w-full flex flex-col justify-between gap-8">
            <div>
              <div className="mb-7 flex items-center gap-2.5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center -ml-1">
                  <img src="/asystence-logo.png" alt="Asystence" className="h-16 w-16 object-contain" />
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

              <p className="text-[10px] uppercase tracking-[0.18em] brand-orange-text font-semibold mb-3">
                Free trial workspace
              </p>
              <h1 className="max-w-3xl text-[34px] sm:text-[44px] xl:text-[54px] font-semibold tracking-tight leading-[1.05] text-[color:var(--text)]">
                Create the workspace your team will run from.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">
                Start with one admin account, then invite managers and users from inside the app when you are ready.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {[
                ["7 days", "Full feature trial"],
                ["1 admin", "You own the workspace"],
                ["Stripe", "International billing ready"],
              ].map(([value, label]) => (
                <div key={label} className="border border-[color:var(--border)] rounded-lg p-4">
                  <p className="text-lg font-semibold brand-orange-text">{value}</p>
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">{label}</p>
                </div>
              ))}
            </div>

            <div className="border border-[color:var(--border)] rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg brand-orange-bg text-[#0a0a0b]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text)]">Trial billing rules stay intact</p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    The first admin is counted as a trial seat and your workspace follows the same upgrade flow.
                  </p>
                </div>
                <CheckCircle2 className="ml-auto hidden sm:block h-5 w-5 brand-orange-text" />
              </div>
            </div>
          </div>
        </section>

        <aside className="min-h-[46vh] lg:min-h-[calc(100vh-4rem)] flex items-center">
          <div className="w-full">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)] font-semibold">
                  Start free trial
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">Create workspace</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border brand-orange-border">
                <Building2 className="h-4 w-4 brand-orange-text" />
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
                  Workspace name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-soft)] pointer-events-none" />
                  <input
                    className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg pl-12 pr-4 text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    autoComplete="organization"
                    placeholder="Acme Operations"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
                  Your name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-soft)] pointer-events-none" />
                  <input
                    className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg pl-12 pr-4 text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Sukhjinder Singh"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
                  Work email
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
                <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[color:var(--text-soft)] pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full h-16 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg pl-12 pr-12 text-[17px] text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
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
                {loading ? "Creating workspace..." : (<>Create free trial <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </form>

            {!isCapacitor && (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-[color:var(--border)]" />
                  <span className="text-xs uppercase tracking-[0.16em] text-[color:var(--text-soft)] font-semibold">
                    or
                  </span>
                  <div className="flex-1 h-px bg-[color:var(--border)]" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignup}
                  disabled={googleLoading}
                  className="flex items-center justify-center gap-2.5 w-full h-16 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text)] rounded-lg text-[17px] font-medium transition-colors disabled:opacity-50"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  {googleLoading ? "Opening Google..." : "Sign up with Google"}
                </button>
              </>
            )}

            <p className="text-center text-sm text-[color:var(--text-muted)] mt-6 leading-6">
              Already have an account?{" "}
              <Link to="/login" className="brand-orange-text hover:opacity-80 transition-opacity">
                Sign in
              </Link>
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
