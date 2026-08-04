// src/components/InlineWorkspaceSignup.jsx
// =============================================================================
// Create a workspace without leaving the page you are on.
//
// "New to Asystence? Create a workspace" navigated to /signup, which is a full
// route change away from a form the visitor had already started thinking about.
// Expanding in place keeps them where they are, and because the account exists
// by the time this resolves, they are signed straight in rather than being
// handed back to a login form.
//
// Deliberately reuses the same endpoints and the same Razorpay handshake as the
// standalone /signup route -- this is a second entry point to one flow, not a
// second implementation of it.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { getGrowthContextHeaders } from "../services/growthTelemetry";
import { formatMinor, planCurrency, planPriceMinor } from "../utils/currency";

const RAZORPAY_SDK = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${RAZORPAY_SDK}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function InlineWorkspaceSignup({ onClose, onAuthenticated }) {
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState("");
  const [interval, setBillingInterval] = useState("monthly");
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  const isFree = plan
    ? planPriceMinor(plan, "monthly") === 0 && planPriceMinor(plan, "yearly") === 0
    : false;
  const trialDays = Number(plan?.trial_days) || 0;
  const currency = plan ? planCurrency(plan) : "USD";
  const chargedInterval = interval === "yearly" && planPriceMinor(plan, "yearly") > 0 ? "yearly" : "monthly";

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    firstFieldRef.current?.focus({ preventScroll: true });
  }, []);

  // The signup form has to know which plan it is selling before it can quote a
  // price, so the catalog is fetched rather than assumed.
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE_URL}/public/billing/plans`)
      .then(({ data }) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const eligible = list.filter((p) => !p.is_custom && Number(p.trial_days) > 0);
        const chosen =
          eligible.find((p) => p.is_popular) ||
          eligible.sort((a, b) => (Number(a.price_monthly) || 0) - (Number(b.price_monthly) || 0))[0] ||
          list[0] ||
          null;
        if (!chosen) setPlanError("No plans are available right now.");
        setPlan(chosen);
      })
      .catch(() => {
        if (!cancelled) setPlanError("Could not load plans. Please try again shortly.");
      });
    return () => { cancelled = true; };
  }, []);

  const completeRazorpay = async (checkout, response) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/auth/signup/workspace/complete/razorpay`,
      {
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_subscription_id: response.razorpay_subscription_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature,
        pendingSignupId: checkout.notes?.pending_signup_id || null,
      },
      { headers: getGrowthContextHeaders() }
    );
    return data;
  };

  const openRazorpay = (checkout) =>
    new Promise((resolve, reject) => {
      const options = {
        key: checkout.keyId,
        name: "Asystence",
        description: `${checkout.planName || plan?.name} — ${chargedInterval}`,
        prefill: { name: name.trim(), email: email.trim() },
        theme: { color: "#f97316" },
        modal: { ondismiss: () => reject(new Error("dismissed")) },
        handler: async (response) => {
          try { resolve(await completeRazorpay(checkout, response)); }
          catch (err) { reject(err); }
        },
      };
      if (checkout.orderId) {
        options.order_id = checkout.orderId;
        options.amount = checkout.amount || checkout.verificationAmount;
        options.currency = String(checkout.currency || currency).toUpperCase();
      } else {
        options.subscription_id = checkout.subscriptionId;
      }
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp) =>
        reject(new Error(resp.error?.description || "Payment failed. Please try another card."))
      );
      rzp.open();
    });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!plan) return setError("Plans are still loading. Please wait a moment.");
    if (!workspaceName.trim()) return setError("Please give your workspace a name.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your work email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (!isFree && !consent) return setError("Please accept the billing terms to continue.");

    setBusy(true);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/signup/workspace`,
        {
          workspaceName: workspaceName.trim(),
          name: name.trim(),
          email: email.trim(),
          password,
          plan: plan.slug,
          interval: chargedInterval,
          currency,
          consentAccepted: true,
        },
        { headers: getGrowthContextHeaders() }
      );

      if (data?.token && data?.user) return onAuthenticated(data);

      if (data?.provider === "razorpay") {
        const ready = await loadRazorpay();
        if (!ready) throw new Error("Could not load the payment window. Check your connection.");
        return onAuthenticated(await openRazorpay(data));
      }

      if (data?.url) return window.location.assign(data.url);
      throw new Error("Could not start checkout. Please try again.");
    } catch (err) {
      if (err?.message === "dismissed") {
        toast("Payment cancelled. Your workspace was not created.", { icon: "ℹ️" });
      } else {
        setError(err?.response?.data?.error || err.message || "Could not create workspace.");
      }
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[color:var(--text)] outline-none focus:border-[color:var(--primary)]";
  const label = "mb-1.5 block text-xs font-semibold text-[color:var(--text-muted)]";

  return (
    <div ref={panelRef} className="mt-6 rounded-2xl border border-[color:var(--border)] p-5 text-left">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[color:var(--text)]">
            {plan ? (isFree ? `Start on ${plan.name}` : `Start your ${trialDays}-day ${plan.name} trial`) : "Create a workspace"}
          </p>
          {plan && !isFree && (
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">
              Free for {trialDays} days, then {formatMinor(planPriceMinor(plan, chargedInterval), currency)} per user
              /{chargedInterval === "yearly" ? "year" : "month"}.
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} disabled={busy}
          className="shrink-0 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)] disabled:opacity-50">
          Cancel
        </button>
      </div>

      {planError && <p className="mb-4 text-sm text-red-400">{planError}</p>}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={label} htmlFor="iw-workspace">Workspace name</label>
          <input id="iw-workspace" ref={firstFieldRef} className={field} value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Inc" autoComplete="organization" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="iw-name">Your name</label>
            <input id="iw-name" className={field} value={name}
              onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
          </div>
          <div>
            <label className={label} htmlFor="iw-email">Work email</label>
            <input id="iw-email" type="email" className={field} value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="iw-password">Password</label>
          <input id="iw-password" type="password" className={field} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
        </div>

        {plan && !isFree && (
          <div className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] p-1">
            {["monthly", "yearly"].map((v) => (
              <button key={v} type="button" onClick={() => setBillingInterval(v)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  interval === v ? "bg-[var(--primary)] text-white" : "text-[color:var(--text-muted)]"
                }`}>
                {v}
              </button>
            ))}
          </div>
        )}

        {plan?.charge_currency_differs && !isFree && (
          <p className="rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
            Shown in {plan.currency}; your card is charged the equivalent in {plan.charge_currency}.
          </p>
        )}

        {plan && !isFree && (
          <label className="flex items-start gap-2.5 rounded-lg border border-[color:var(--border)] p-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
            <span className="text-xs leading-5 text-[color:var(--text-muted)]">
              I authorize automatic billing after the {trialDays}-day trial unless I cancel first. A small
              card-verification charge may be made now and refunded automatically.
            </span>
          </label>
        )}

        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

        <button type="submit" disabled={busy || !plan}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50">
          {busy ? "Working…" : plan && !isFree ? `Start ${trialDays}-day trial` : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
