import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";
import {
  isConfiguredWorkspaceDomainHost,
} from "../config/runtime";
import { buildWorkspaceHandoffUrl } from "../auth/workspaceHandoff";
import ThemeSwitcher from "../components/ThemeSwitcher";
import Turnstile from "../components/Turnstile";
import { getGrowthContextHeaders } from "../services/growthTelemetry";
import { getStoredCurrency } from "../utils/currency";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

const BACKEND_URL = API_BASE_URL;
const SELF_SERVE_TRIAL_DAYS = 7;
const turnstileEnabled = Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY);

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlanSlug = String(searchParams.get("plan") || "").trim().toLowerCase();

  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const intendedInterval = searchParams.get("interval") === "yearly" ? "yearly" : "monthly";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(!!selectedPlanSlug);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [verificationPending, setVerificationPending] = useState(null);

  const isFreePlan = !!selectedPlan &&
    (Number(selectedPlan.price_monthly_minor) || 0) === 0 &&
    (Number(selectedPlan.price_yearly_minor) || 0) === 0;
  const selectedPlanName = selectedPlan?.name || "Pro";
  const selectedTrialDays = SELF_SERVE_TRIAL_DAYS;
  // The backend prices the catalog in the visitor's own currency; keep whatever
  // it returned so the quote and the charge agree.
  const planCurrencyCode = selectedPlan?.currency || getStoredCurrency() || "USD";

  useEffect(() => {
    if (!selectedPlanSlug) {
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    const stored = getStoredCurrency();
    axios.get(`${API_BASE_URL}/public/billing/plans`, {
      params: stored ? { currency: stored } : undefined,
    })
      .then(({ data }) => {
        if (cancelled) return;
        const match = (Array.isArray(data) ? data : []).find((plan) => plan.slug === selectedPlanSlug);
        setSelectedPlan(match || null);
      })
      .catch(() => {
        if (!cancelled) setSelectedPlan(null);
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedPlanSlug]);

  useEffect(() => {
    if (searchParams.get("verification") === "pending") {
      setVerificationPending({ email: null, delivered: true });
      return;
    }
    const err = searchParams.get("error");
    if (!err || err === "google_cancelled") return;
    const message =
      err === "workspace_required"
        ? "Name your workspace before continuing with Google."
        : decodeURIComponent(err);
    toast.error(message);
  }, [searchParams]);

  const googleSignupUrl = useMemo(() => {
    const params = new URLSearchParams({
      mode: "signup",
      workspaceName: workspaceName.trim(),
      interval: intendedInterval,
      currency: planCurrencyCode,
      ...(selectedPlanSlug ? { plan: selectedPlanSlug } : {}),
    });
    return `${BACKEND_URL}/auth/google?${params.toString()}`;
  }, [workspaceName, intendedInterval, planCurrencyCode, selectedPlanSlug]);

  const safePersistAuth = (user, token, refreshToken = null) => {
    try {
      const payload = { token, user, refreshToken };
      localStorage.setItem("auth", JSON.stringify(payload));
      try {
        window.__AUTH_TOKEN__ = token;
        window.__WORKSPACE_ID__ = user?.workspaceId || user?.workspace_id || "GLOBAL";
      } catch { /* runtime globals are an optional compatibility bridge */ }
      window.dispatchEvent(new Event("auth:updated"));
    } catch (err) {
      console.warn("Failed to persist auth to localStorage:", err);
    }
  };

  const completeSignup = async (data) => {
    const token = data?.token;
    const user = data?.user;
    if (!token || !user) throw new Error("Signup completed but the login token was missing.");

    safePersistAuth(user, token, data.refreshToken || null);
    toast.success(
      isFreePlan
        ? "Workspace created. Welcome to Asystence."
        : `Workspace ready. Your ${selectedTrialDays}-day trial started with no card required.`
    );
    const slug = user?.workspace_slug;
    // The session moves as a single-use code, never as the tokens themselves --
    // see auth/workspaceHandoff.js. A handoff that cannot be arranged leaves
    // the user signed in here rather than failing the flow.
    if (slug && isConfiguredWorkspaceDomainHost(window.location.hostname)) {
      const targetUrl = await buildWorkspaceHandoffUrl(slug, "/projects", token);
      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }
    navigate("/projects", { replace: true });
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
    if (turnstileEnabled && !turnstileToken) {
      toast.error("Please wait a moment for the security check to finish.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/signup/workspace`, {
        workspaceName,
        name,
        email,
        password,
        interval: intendedInterval,
        currency: planCurrencyCode,
        ...(selectedPlanSlug ? { plan: selectedPlanSlug } : {}),
        ...(turnstileToken ? { turnstileToken } : {}),
      }, { headers: getGrowthContextHeaders() });
      if (res.data?.verificationRequired) {
        setVerificationPending({
          email: res.data.email || email.trim(),
          delivered: res.data.emailDelivered !== false,
        });
        return;
      }
      if (res.data?.token && res.data?.user) {
        completeSignup(res.data);
        return;
      }
      throw new Error("Workspace creation completed without a usable session.");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Could not create workspace");
      setTurnstileToken("");
      setTurnstileReset((value) => value + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required before Google signup");
      return;
    }
    window.location.href = googleSignupUrl;
  };

  if (verificationPending) {
    return <VerificationPending {...verificationPending} />;
  }

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
                {isFreePlan ? `${selectedPlanName} workspace` : "No-card team trial"}
              </p>
              <h1 className="max-w-3xl text-[34px] sm:text-[44px] xl:text-[54px] font-semibold tracking-tight leading-[1.05] text-[color:var(--text)]">
                {isFreePlan
                  ? `Create your ${selectedPlanName} workspace.`
                  : "Create your workspace and start working now."}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">
                {isFreePlan
                  ? `Start with one admin account on the ${selectedPlanName} plan. No card or payment setup is required.`
                  : `Your team gets ${selectedTrialDays} days of full access. No credit card, payment form, or checkout redirect is required.`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {(isFreePlan ? [
                [selectedPlan?.member_limit ? `${selectedPlan.member_limit} members` : "Flexible", "Plan capacity"],
                ["Free", "No recurring charge"],
                ["No card", "Create directly"],
              ] : [
                [`${selectedTrialDays} days`, "Full feature trial"],
                ["No card", "Start immediately"],
                ["Starter", "Automatic free fallback"],
              ]).map(([value, label]) => (
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
                  <p className="text-sm font-semibold text-[color:var(--text)]">
                    No payment required today
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {isFreePlan
                      ? "Your workspace is created directly on the selected free plan."
                      : `After ${selectedTrialDays} days, choose a paid plan in Billing or continue automatically on the free Starter plan.`}
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
                  {isFreePlan ? `Start ${selectedPlanName}` : "Start your trial"}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  No checkout required
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border brand-orange-border">
                <ShieldCheck className="h-4 w-4 brand-orange-text" />
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
                disabled={loading || planLoading}
                className="w-full h-16 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-[17px] font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {planLoading
                  ? "Loading plan..."
                  : loading
                    ? "Creating workspace..."
                    : (<>Create workspace <ArrowRight className="w-4 h-4" /></>)}
              </button>
              <Turnstile
                onToken={setTurnstileToken}
                resetKey={turnstileReset}
              />
            </form>

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
                  className="flex items-center justify-center gap-2.5 w-full h-16 bg-[var(--surface)] hover:bg-[var(--surface-soft)] border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text)] rounded-lg text-[17px] font-medium transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 brand-orange-text" />
                  Sign up with Google
                </button>
            </>

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

function VerificationPending({ email, delivered }) {
  const [resending, setResending] = useState(false);

  const resend = async () => {
    setResending(true);
    try {
      await axios.post(`${API_BASE_URL}/auth/email-verification/resend`, { email });
      toast.success("If the account is awaiting verification, a new email has been sent.");
    } catch (err) {
      toast.error(err.response?.data?.error || "Could not resend the verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--text)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--primary)]">
          <Mail className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">
          {delivered
            ? email
              ? <>We sent a secure link to <strong className="text-[color:var(--text)]">{email}</strong>. One click verifies the address and signs you in.</>
              : <>We sent a secure link to your email address. One click verifies the address and signs you in.</>
            : <>Your workspace is reserved, but the email could not be delivered. Retry below or contact support.</>}
        </p>
        {email && (
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="mt-6 w-full rounded-lg border border-[color:var(--border)] px-4 py-3 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        )}
        <Link to="/login" className="mt-5 inline-block text-sm text-[color:var(--primary)] hover:opacity-80">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
