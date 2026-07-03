import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../api";
import {
  buildWorkspaceRedirectUrl,
  isConfiguredWorkspaceDomainHost,
} from "../config/runtime";
import ThemeSwitcher from "../components/ThemeSwitcher";
import { getGrowthContextHeaders } from "../services/growthTelemetry";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";

const BACKEND_URL = API_BASE_URL;

function loadRazorpayCheckout() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedPlanSlug = String(searchParams.get("plan") || "").trim().toLowerCase();

  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [interval, setBillingInterval] = useState(() =>
    searchParams.get("interval") === "yearly" ? "yearly" : "monthly"
  );
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(!!selectedPlanSlug);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const isFreePlan = !!selectedPlan &&
    (Number(selectedPlan.price_monthly) || 0) === 0 &&
    (Number(selectedPlan.price_yearly) || 0) === 0;
  const selectedPlanName = selectedPlan?.name || "Pro";
  const selectedTrialDays = Number(selectedPlan?.trial_days) || 7;

  useEffect(() => {
    if (!selectedPlanSlug) {
      setPlanLoading(false);
      return;
    }

    let cancelled = false;
    setPlanLoading(true);
    axios.get(`${API_BASE_URL}/public/billing/plans`)
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
    const err = searchParams.get("error");
    const cancelled = searchParams.get("cancelled");
    if (cancelled) toast("Signup cancelled. Your workspace was not created.");
    if (!err || err === "google_cancelled") return;
    const message =
      err === "workspace_required"
        ? "Name your workspace before continuing with Google."
        : err === "billing_consent_required"
          ? "Accept the trial billing consent before continuing with Google."
          : decodeURIComponent(err);
    toast.error(message);
  }, [searchParams]);

  const googleSignupUrl = useMemo(() => {
    const params = new URLSearchParams({
      mode: "signup",
      workspaceName: workspaceName.trim(),
      trialBillingConsent: consentAccepted ? "1" : "0",
      ...(selectedPlanSlug ? { plan: selectedPlanSlug } : {}),
    });
    return `${BACKEND_URL}/auth/google?${params.toString()}`;
  }, [workspaceName, consentAccepted, selectedPlanSlug]);

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

  const completeSignup = (data) => {
    const token = data?.token;
    const user = data?.user;
    if (!token || !user) throw new Error("Signup completed but the login token was missing.");

    safePersistAuth(user, token, data.refreshToken || null);
    toast.success(
      isFreePlan
        ? "Workspace created. Welcome to Asystence."
        : "Workspace created. Your verification charge refund has been started."
    );
    const slug = user?.workspace_slug;
    if (slug && isConfiguredWorkspaceDomainHost(window.location.hostname)) {
      const targetUrl = buildWorkspaceRedirectUrl(slug, "/projects", {
        _t: token,
        ...(data.refreshToken ? { _r: data.refreshToken } : {}),
      });
      if (targetUrl) {
        window.location.href = targetUrl;
        return;
      }
    }
    navigate("/projects", { replace: true });
  };

  const openRazorpaySignupCheckout = async (checkout) => {
    const loaded = await loadRazorpayCheckout();
    if (!loaded) throw new Error("Razorpay checkout could not be loaded. Please check your connection.");
    if (!checkout?.keyId || (!checkout?.subscriptionId && !checkout?.orderId)) {
      throw new Error("Razorpay checkout could not be started. Please try again.");
    }

    const pendingSignupId = checkout.notes?.pending_signup_id || checkout.pendingSignupId || null;
    await new Promise((resolve, reject) => {
      const options = {
        key: checkout.keyId,
        name: "Asystence",
        description: `${checkout.trialDays || selectedTrialDays}-day ${checkout.planName || selectedPlanName} trial with refundable card verification`,
        image: "/asystence-logo.png",
        prefill: checkout.prefill || { name, email },
        notes: {
          pending_signup_id: pendingSignupId || "",
          billing_plan: checkout.plan || selectedPlanSlug || "pro",
          billing_interval: checkout.interval || interval,
        },
        theme: { color: "#f97316" },
        modal: {
          ondismiss: () => reject(new Error("dismissed")),
        },
        handler: async (response) => {
          try {
            const { data } = await axios.post(`${API_BASE_URL}/auth/signup/workspace/complete/razorpay`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              pendingSignupId,
            }, { headers: getGrowthContextHeaders() });
            completeSignup(data);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      };
      if (checkout.orderId) {
        options.order_id = checkout.orderId;
        options.amount = checkout.amount || checkout.verificationAmount;
        options.currency = String(checkout.currency || "INR").toUpperCase();
      } else {
        options.subscription_id = checkout.subscriptionId;
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response) => {
        reject(new Error(response.error?.description || "Payment failed. Please try another card."));
      });
      rzp.open();
    });
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
    if (!isFreePlan && !consentAccepted) {
      toast.error("Please accept the trial billing consent to continue.");
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
        interval,
        consentAccepted,
        ...(selectedPlanSlug ? { plan: selectedPlanSlug } : {}),
      }, { headers: getGrowthContextHeaders() });
      if (res.data?.token && res.data?.user) {
        completeSignup(res.data);
        return;
      }
      if (res.data?.provider === "razorpay") {
        await openRazorpaySignupCheckout(res.data);
        return;
      }
      if (res.data?.url) {
        window.location.assign(res.data.url);
        return;
      }
      toast.error("Payment checkout could not be started. Please try again.");
    } catch (err) {
      if (err?.message === "dismissed") {
        toast("Signup payment cancelled. Your workspace was not created.");
      } else {
        toast.error(err.response?.data?.error || err.message || "Could not create workspace");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name is required before Google signup");
      return;
    }
    if (!isFreePlan && !consentAccepted) {
      toast.error("Please accept the trial billing consent to continue.");
      return;
    }
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
                {isFreePlan ? `${selectedPlanName} workspace` : "Card-required trial workspace"}
              </p>
              <h1 className="max-w-3xl text-[34px] sm:text-[44px] xl:text-[54px] font-semibold tracking-tight leading-[1.05] text-[color:var(--text)]">
                {isFreePlan
                  ? `Create your ${selectedPlanName} workspace.`
                  : "Create your workspace after Razorpay verifies the card."}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--text-muted)]">
                {isFreePlan
                  ? `Start with one admin account on the ${selectedPlanName} plan. No card or payment setup is required.`
                  : `Start with one admin account, a ${selectedTrialDays}-day ${selectedPlanName} trial, and clear consent for automatic billing after the trial unless cancelled first.`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {(isFreePlan ? [
                [selectedPlan?.member_limit ? `${selectedPlan.member_limit} members` : "Flexible", "Plan capacity"],
                ["Free", "No recurring charge"],
                ["No card", "Create directly"],
              ] : [
                [`${selectedTrialDays} days`, "Full feature trial"],
                ["INR 1", "Refunded verification"],
                ["Razorpay", "Card billing consent"],
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
                    {isFreePlan ? "No payment required" : "Razorpay-secured checkout"}
                  </p>
                  <p className="text-xs text-[color:var(--text-muted)]">
                    {isFreePlan
                      ? "Your workspace is created directly on the selected free plan."
                      : "The card verification charge is refunded automatically after confirmation, and billing can be cancelled before renewal."}
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
                  {isFreePlan ? `Start ${selectedPlanName}` : "Start card trial"}
                </p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  {isFreePlan ? "No checkout required" : "Razorpay checkout"}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border brand-orange-border">
                <CreditCard className="h-4 w-4 brand-orange-text" />
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

              {!isFreePlan && <div>
                <label className="block text-sm font-medium text-[color:var(--text-muted)] mb-2 tracking-tight">
                  Billing interval
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-1">
                  {["monthly", "yearly"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBillingInterval(value)}
                      className={`h-11 rounded-md text-sm font-semibold transition-colors ${
                        interval === value
                          ? "bg-[var(--primary)] text-[color:var(--primary-contrast)]"
                          : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                      }`}
                    >
                      {value === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>}

              {!isFreePlan && <label className="flex items-start gap-3 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="text-sm leading-6 text-[color:var(--text-muted)]">
                  I authorize automatic billing after the free trial unless I cancel before it ends. I agree that Razorpay may charge INR 1.00 now to verify my card and refund it automatically after confirmation.
                </span>
              </label>}

              <button
                type="submit"
                disabled={loading || planLoading}
                className="w-full h-16 inline-flex items-center justify-center gap-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-[17px] font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
              >
                {planLoading
                  ? "Loading plan..."
                  : loading
                    ? (isFreePlan ? "Creating workspace..." : "Opening Razorpay...")
                    : (<>{isFreePlan ? "Create workspace" : "Continue to Razorpay"} <ArrowRight className="w-4 h-4" /></>)}
              </button>
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
