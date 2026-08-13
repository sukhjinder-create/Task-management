import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { cn } from "../utils/cn";

export default function TrialStatusBanner({ compact = false }) {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const {
    onTrial,
    trialEndsAt,
    paymentSetupRequired,
    trialPlanName,
    trialPlan,
    fallbackPlan,
  } = usePlan();
  const [renderedAt] = useState(Date.now);

  if (!onTrial && !paymentSetupRequired) return null;

  const daysLeft = trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trialEndsAt) - renderedAt) / 86400000))
    : 0;
  const isBillingAdmin = ["admin", "owner"].includes(auth?.user?.role);
  const intendedPlan = trialPlanName || trialPlan || "paid";
  const fallback = fallbackPlan === "starter" ? "Starter" : fallbackPlan;

  return (
    <div
      className={cn(
        "shrink-0 border-b px-4 py-2 text-xs font-medium",
        paymentSetupRequired
          ? "bg-[color:var(--score-warning-bg)] text-[color:var(--score-warning)] border-[color:var(--score-warning-border)]"
          : "bg-[var(--primary-soft)] text-[color:var(--primary)] border-[color:color-mix(in_srgb,var(--primary)_28%,var(--border))]",
        compact ? "text-[11px]" : "text-[11.5px]"
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 text-center">
        <span className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", paymentSetupRequired ? "bg-[color:var(--score-warning)]" : "bg-[color:var(--primary)]")} />
        <span>
          {paymentSetupRequired
            ? `Trial complete — your workspace is safely on the free ${fallback} plan.`
            : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left in your full-access trial. No payment method is required.`}
        </span>
        {paymentSetupRequired && isBillingAdmin ? (
          <button
            type="button"
            onClick={() => navigate("/admin/billing")}
            className="shrink-0 rounded-md border border-current/30 px-2 py-1 font-semibold hover:bg-black/5"
          >
            Set up {intendedPlan} billing
          </button>
        ) : paymentSetupRequired ? (
          <span className="hidden sm:inline">A workspace admin can restore paid features from Billing.</span>
        ) : null}
      </div>
    </div>
  );
}
