// src/pages/WorkspaceBilling.jsx
// =============================================================================
// Workspace admin billing page — Razorpay subscriptions
// Flow: Pick plan → POST /payments/subscribe → Razorpay Checkout (UPI/Card/NACH)
//       → ₹1 mandate verification → 7-day free trial → monthly auto-debit
// =============================================================================
import { useEffect, useState, useCallback } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  CheckCircle, Zap, Crown, CreditCard, RefreshCw,
  AlertCircle, Shield, Clock, Users, ChevronRight,
  BadgeCheck, Smartphone, Building,
} from "lucide-react";

// ── Load Razorpay script once ─────────────────────────────────────────────────
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rupees(paise) {
  if (!paise) return "₹0";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(paise / 100);
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function daysLeft(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso) - Date.now()) / 86400000);
  return d > 0 ? d : 0;
}

const SUPPORT_BADGE = {
  community: { label: "Community", color: "text-gray-500" },
  email:     { label: "Email Support", color: "text-blue-500" },
  priority:  { label: "Priority Support", color: "text-indigo-500" },
  dedicated: { label: "Dedicated Manager", color: "text-purple-500" },
};

// ── Payment method icons/labels ───────────────────────────────────────────────
const PAYMENT_METHODS = [
  { icon: <Smartphone className="w-4 h-4 text-green-500" />, label: "UPI AutoPay",       sub: "PhonePe, GPay, Paytm, BHIM" },
  { icon: <CreditCard className="w-4 h-4 text-blue-500"  />, label: "Debit / Credit Card", sub: "Visa, Mastercard, RuPay" },
  { icon: <Building   className="w-4 h-4 text-amber-500" />, label: "NACH / Net Banking", sub: "Direct bank mandate" },
];

// ── Interval toggle ───────────────────────────────────────────────────────────
function IntervalToggle({ value, onChange }) {
  return (
    <div className="inline-flex items-center rounded-xl border theme-border theme-surface p-1 gap-1">
      {["monthly", "yearly"].map(v => (
        <button key={v} onClick={() => onChange(v)}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
            value === v
              ? "bg-indigo-500 text-white"
              : "theme-text-muted hover:theme-text"
          }`}>
          {v === "monthly" ? "Monthly" : "Yearly"}
          {v === "yearly" && <span className="ml-1.5 text-[10px] font-bold text-green-400">SAVE 17%</span>}
        </button>
      ))}
    </div>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, interval, isCurrent, isLoading, onSelect }) {
  const pricePaise = interval === "yearly" ? plan.price_yearly_paise : plan.price_monthly_paise;
  const isFree  = !pricePaise;
  const features = Array.isArray(plan.features) ? plan.features : [];

  return (
    <div className={`relative flex flex-col rounded-2xl border transition-all ${
      plan.is_popular
        ? "border-indigo-500/50 ring-2 ring-indigo-500/20"
        : isCurrent
        ? "border-green-500/40"
        : "theme-border"
    } theme-surface`}>

      {plan.is_popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-500 text-white uppercase tracking-wider shadow">
            Most Popular
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green-500 text-white uppercase tracking-wider shadow">
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6 flex-1 flex flex-col gap-5">
        {/* Plan identity */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider theme-text-muted">{plan.name}</p>
          <p className="text-xs theme-text-muted mt-0.5">{plan.tagline}</p>

          <div className="mt-3">
            {isFree ? (
              <p className="text-3xl font-black theme-text">Free</p>
            ) : (
              <>
                <p className="text-3xl font-black theme-text">
                  {rupees(pricePaise)}
                  <span className="text-sm font-normal theme-text-muted">/{interval === "yearly" ? "yr" : "mo"}</span>
                </p>
                {interval === "yearly" && plan.price_monthly_paise > 0 && (
                  <p className="text-xs text-green-500 font-semibold mt-0.5">
                    Save {rupees(plan.price_monthly_paise * 12 - plan.price_yearly_paise)}/year
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs theme-text-muted">
              <Users className="w-3 h-3" /> {plan.member_limit} members
            </span>
            {plan.trial_days > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-indigo-500 font-medium">
                <Zap className="w-3 h-3" /> {plan.trial_days}-day free trial
              </span>
            )}
            {SUPPORT_BADGE[plan.support_level] && (
              <span className={`text-xs font-medium ${SUPPORT_BADGE[plan.support_level].color}`}>
                {SUPPORT_BADGE[plan.support_level].label}
              </span>
            )}
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-2 flex-1">
          {features.map(f => (
            <li key={f} className="flex items-start gap-2 text-xs theme-text-muted">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {isCurrent ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-green-500/10 text-green-600 flex items-center justify-center gap-1.5">
            <BadgeCheck className="w-4 h-4" /> Active Plan
          </div>
        ) : isFree ? (
          <div className="w-full py-2.5 rounded-xl text-sm font-semibold text-center theme-text-muted opacity-50 border theme-border">
            Downgrade via cancellation
          </div>
        ) : (
          <button onClick={() => onSelect(plan)} disabled={isLoading}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${
              plan.is_popular
                ? "bg-indigo-500 hover:bg-indigo-600 text-white"
                : "bg-[var(--surface-soft)] hover:bg-indigo-500/10 theme-text hover:text-indigo-500 border theme-border"
            }`}>
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {plan.trial_days > 0 ? `Start ${plan.trial_days}-day Free Trial` : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkspaceBilling() {
  const api        = useApi();
  const { auth }   = useAuth();
  const user       = auth?.user;

  const [plans,    setPlans]    = useState([]);
  const [summary,  setSummary]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [interval, setInterval] = useState("monthly");
  const [checking, setChecking] = useState(null); // planId being checked out
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, summaryRes] = await Promise.all([
        api.get("/payments/plans"),
        api.get("/payments/summary").catch(() => ({ data: null })),
      ]);
      setPlans(plansRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── Razorpay checkout ──────────────────────────────────────────────────────
  async function handleSelectPlan(plan) {
    setChecking(plan.id);
    try {
      // 1. Load Razorpay SDK
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error("Failed to load Razorpay. Check your internet connection.");

      // 2. Create subscription on backend → get subscription_id + key_id
      const { data } = await api.post("/payments/subscribe", {
        planId: plan.id,
        interval,
      });

      // 3. Open Razorpay Checkout
      await new Promise((resolve, reject) => {
        const options = {
          key:             data.keyId,
          subscription_id: data.subscriptionId,
          name:            "Proxima",
          description:     `${data.planName} — ${interval === "yearly" ? "Yearly" : "Monthly"}`,
          image:           "/logo.png",
          currency:        "INR",
          prefill: {
            name:  data.prefill?.name  || user?.username || "",
            email: data.prefill?.email || user?.email    || "",
          },
          notes: { plan: data.planSlug, interval },
          theme: { color: "#6366f1" },
          modal: {
            ondismiss: () => {
              toast("Checkout cancelled. You can try again anytime.", { icon: "ℹ️" });
              reject(new Error("dismissed"));
            },
          },
          handler: async (response) => {
            try {
              // 4. Verify signature on backend
              await api.post("/payments/verify", {
                razorpay_payment_id:      response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature:       response.razorpay_signature,
                planSlug:                 data.planSlug,
              });

              toast.success(
                data.trialDays > 0
                  ? `🎉 ${data.trialDays}-day free trial started! Your ₹1 verification will be refunded within 3–5 days.`
                  : `🎉 Subscribed to ${data.planName}! Welcome to Proxima.`,
                { duration: 6000 }
              );
              await load();
              resolve();
            } catch (verifyErr) {
              reject(verifyErr);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (resp) => {
          toast.error(`Payment failed: ${resp.error?.description || "Unknown error"}`);
          reject(new Error(resp.error?.description));
        });
        rzp.open();
      });

    } catch (err) {
      if (err?.message !== "dismissed") {
        toast.error(err?.response?.data?.error || err.message || "Checkout failed");
      }
    } finally {
      setChecking(null);
    }
  }

  async function handleCancel() {
    if (!window.confirm("Cancel subscription? You'll keep access until the end of the billing period.")) return;
    setCancelling(true);
    try {
      const { data } = await api.post("/payments/cancel");
      toast.success(`Subscription cancelled. Access continues until ${fmtDate(data.effectiveDate)}.`);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentPlan  = summary?.workspace?.billing_plan || summary?.workspace?.plan || "starter";
  const billingStatus = summary?.workspace?.billing_status;
  const sub          = summary?.subscription;
  const trialLeft    = sub?.trial_ends_at ? daysLeft(sub.trial_ends_at) : null;
  const nextBilling  = sub?.next_billing_at || sub?.current_period_end;
  const razorpayEnabled = summary?.config?.enabled;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-5 h-5 animate-spin theme-text-muted" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold theme-text">Billing &amp; Subscription</h1>
          <p className="text-sm theme-text-muted mt-1">Manage your workspace plan. Cancel anytime.</p>
        </div>
        <IntervalToggle value={interval} onChange={setInterval} />
      </div>

      {/* Current plan status banner */}
      {summary && (
        <div className={`rounded-2xl border p-5 flex items-start gap-4 ${
          billingStatus === "active" ? "border-green-500/30 bg-green-500/5"
          : billingStatus === "suspended" ? "border-amber-500/30 bg-amber-500/5"
          : "theme-border theme-surface"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            billingStatus === "active" ? "bg-green-500/10" : "bg-indigo-500/10"
          }`}>
            <Crown className={`w-5 h-5 ${billingStatus === "active" ? "text-green-500" : "text-indigo-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold theme-text capitalize">{currentPlan} Plan</p>
              {billingStatus === "active" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-600">Active</span>
              )}
              {billingStatus === "suspended" && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600">Suspended</span>
              )}
              {sub?.cancel_at_period_end && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-500">Cancels at period end</span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs theme-text-muted">
              {trialLeft !== null && trialLeft > 0 && (
                <span className="flex items-center gap-1 text-indigo-500 font-medium">
                  <Clock className="w-3.5 h-3.5" /> {trialLeft} days of free trial remaining
                </span>
              )}
              {trialLeft === 0 && nextBilling && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Next billing: {fmtDate(nextBilling)}
                </span>
              )}
              {sub?.billing_interval && (
                <span className="capitalize">{sub.billing_interval} billing</span>
              )}
              {summary.workspace?.max_members && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Up to {summary.workspace.max_members} members
                </span>
              )}
            </div>
          </div>

          {sub && !sub.cancel_at_period_end && currentPlan !== "starter" && (
            <button onClick={handleCancel} disabled={cancelling}
              className="shrink-0 px-3 py-2 rounded-xl text-xs font-medium text-red-500 hover:bg-red-500/10 border border-red-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50">
              {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              Cancel plan
            </button>
          )}
        </div>
      )}

      {/* No Razorpay notice */}
      {!razorpayEnabled && (
        <div className="theme-surface border theme-border rounded-2xl px-5 py-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold theme-text">Payments not yet configured</p>
            <p className="text-xs theme-text-muted mt-0.5">
              Contact your platform administrator to set up Razorpay. Once configured, you can upgrade directly from this page.
            </p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            interval={interval}
            isCurrent={plan.slug === currentPlan}
            isLoading={checking === plan.id}
            onSelect={handleSelectPlan}
          />
        ))}
      </div>

      {/* How it works */}
      <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b theme-border">
          <p className="text-sm font-bold theme-text">How billing works</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[
            {
              icon: <Shield className="w-4 h-4 text-indigo-500" />,
              title: "₹1 mandate verification",
              desc: "When you subscribe, ₹1 is charged to verify your payment method. This amount is automatically refunded within 3–5 business days.",
            },
            {
              icon: <Zap className="w-4 h-4 text-green-500" />,
              title: "Free trial period",
              desc: "Paid plans include a free trial. Your first real charge happens only after the trial ends — no surprises.",
            },
            {
              icon: <RefreshCw className="w-4 h-4 text-blue-500" />,
              title: "Automatic monthly renewal",
              desc: "After your trial, billing happens automatically each month (or year). You'll receive an email reminder 3 days before each charge.",
            },
            {
              icon: <BadgeCheck className="w-4 h-4 text-purple-500" />,
              title: "Cancel anytime",
              desc: "Cancel at any time from this page. You keep full access until the end of your current billing period.",
            },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-4 px-6 py-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">{item.title}</p>
                <p className="text-xs theme-text-muted mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Accepted payment methods */}
      <div className="theme-surface border theme-border rounded-2xl px-6 py-5">
        <p className="text-sm font-bold theme-text mb-4">Accepted payment methods</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PAYMENT_METHODS.map(m => (
            <div key={m.label} className="flex items-center gap-3 px-4 py-3 rounded-xl border theme-border">
              <div className="w-8 h-8 rounded-lg bg-[var(--surface-soft)] flex items-center justify-center shrink-0">
                {m.icon}
              </div>
              <div>
                <p className="text-sm font-semibold theme-text">{m.label}</p>
                <p className="text-xs theme-text-muted">{m.sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs theme-text-muted mt-3 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          Payments are processed securely by Razorpay. Proxima never stores your card or bank details.
        </p>
      </div>

      {/* Need help */}
      <div className="flex items-center justify-between px-5 py-4 theme-surface border theme-border rounded-xl">
        <div>
          <p className="text-sm font-semibold theme-text">Need a custom plan?</p>
          <p className="text-xs theme-text-muted mt-0.5">Contact us for enterprise pricing, volume discounts, or custom contracts.</p>
        </div>
        <a href="mailto:billing@proxima.app"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold theme-surface border theme-border theme-text hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-colors">
          Contact sales <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>

    </div>
  );
}
