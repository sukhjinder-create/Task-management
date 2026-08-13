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
// Deliberately reuses the same no-card endpoint as the standalone /signup route:
// this is a second entry point to one flow, not a second implementation of it.
// =============================================================================
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../api";
import { getGrowthContextHeaders } from "../services/growthTelemetry";

const SELF_SERVE_TRIAL_DAYS = 7;

export default function InlineWorkspaceSignup({ onClose, onAuthenticated }) {
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const firstFieldRef = useRef(null);

  const isFree = plan
    ? (Number(plan.price_monthly_minor) || 0) === 0 &&
      (Number(plan.price_yearly_minor) || 0) === 0
    : false;
  const trialDays = SELF_SERVE_TRIAL_DAYS;

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
        const eligible = list.filter((p) => {
          const isPaid = (Number(p.price_monthly_minor) || 0) > 0 ||
            (Number(p.price_yearly_minor) || 0) > 0;
          return !p.is_custom && isPaid;
        });
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

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!plan) return setError("Plans are still loading. Please wait a moment.");
    if (!workspaceName.trim()) return setError("Please give your workspace a name.");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim()) return setError("Please enter your work email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

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
          interval: "monthly",
          currency: plan.currency,
        },
        { headers: getGrowthContextHeaders() }
      );

      if (data?.token && data?.user) return onAuthenticated(data);
      throw new Error("Workspace creation completed without a usable session.");
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Could not create workspace.");
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
              Full access for {trialDays} days with no card. Afterward, choose a paid plan or continue on Starter.
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
          <p className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[color:var(--text-muted)]">
            No payment details are collected during signup. Your workspace is created immediately.
          </p>
        )}

        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

        <button type="submit" disabled={busy || !plan}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--primary-contrast)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50">
          {busy ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
