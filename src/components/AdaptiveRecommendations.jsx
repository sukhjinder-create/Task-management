import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Check, Info, RefreshCw, Sparkles, X } from "lucide-react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Badge, Button, Card, Skeleton } from "./ui";

const DECISION_ROLES = new Set(["admin", "owner", "manager"]);

function riskColor(risk) {
  if (risk === "critical" || risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "neutral";
}

function actionLabel(type) {
  return String(type || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confidenceLabel(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `${Math.round(number * 100)}% ${label}`;
}

export default function AdaptiveRecommendations({
  projectId = null,
  taskId = null,
  limit = 3,
  compact = false,
  title = "Recommended actions",
  subtitle = "Evidence-backed suggestions from current workspace activity.",
}) {
  const api = useApi();
  const { auth } = useAuth();
  const canDecide = DECISION_ROLES.has(auth?.user?.role);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const params = useMemo(() => ({
    status: "pending",
    limit,
    ...(projectId ? { projectId } : {}),
    ...(taskId ? { taskId } : {}),
  }), [limit, projectId, taskId]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get("/adaptive/recommendations", { params });
      setItems(res.data?.recommendations || []);
      setUnavailable(false);
    } catch (error) {
      const status = error?.response?.status;
      if (![401, 403].includes(status)) {
        console.warn("Adaptive recommendations unavailable", error?.message || error);
      }
      setItems([]);
      setUnavailable(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, params]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id, action) => {
    setBusyId(`${id}:${action}`);
    try {
      if (action === "ignore") {
        await api.post(`/adaptive/recommendations/${id}/feedback`, { feedback: "ignored" });
        toast.success("Recommendation muted");
      } else if (action === "approve_execute") {
        await api.post(`/adaptive/recommendations/${id}/approve`, { execute: true });
        toast.success("Action approved and executed");
      } else {
        await api.post(`/adaptive/recommendations/${id}/${action}`, {});
        toast.success(action === "reject" ? "Recommendation rejected" : "Recommendation updated");
      }
      await load({ silent: true });
    } catch (error) {
      toast.error(error?.response?.data?.error || "Could not update recommendation");
    } finally {
      setBusyId(null);
    }
  };

  if (unavailable || (!loading && items.length === 0)) return null;

  return (
    <Card className={compact ? "p-3" : "p-4"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
            {!loading && items.length > 0 && (
              <Badge color="primary" variant="subtle">{items.length}</Badge>
            )}
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-[color:var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => load()}
          disabled={loading}
          leftIcon={<RefreshCw className="h-3 w-3" />}
        >
          Refresh
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            {!compact && <Skeleton className="h-20 rounded-lg" />}
          </>
        ) : items.map((item) => {
          const confidenceModel = item.payload?.confidenceModel || {};
          const ruleConfidence = confidenceLabel(item.rule_confidence ?? confidenceModel.ruleConfidence ?? item.confidence, "rule confidence");
          const outcomeConfidence = confidenceLabel(item.outcome_confidence ?? confidenceModel.outcomeConfidence, "outcome confidence");
          const acceptanceProbability = confidenceLabel(item.acceptance_probability ?? confidenceModel.acceptanceProbability, "acceptance probability");
          const evidence = Array.isArray(item.evidence) ? item.evidence : [];
          return (
            <div key={item.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-[color:var(--text)]">{item.title}</h3>
                    <Badge color={riskColor(item.risk_level)} variant="subtle">{item.risk_level || "medium"} risk</Badge>
                    {ruleConfidence && <Badge color="neutral" variant="subtle">{ruleConfidence}</Badge>}
                    {outcomeConfidence && <Badge color="primary" variant="subtle">{outcomeConfidence}</Badge>}
                    {acceptanceProbability && <Badge color="neutral" variant="subtle">{acceptanceProbability}</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">{item.summary}</p>
                  {item.explanation && (
                    <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-[color:var(--text-soft)]">
                      <Info className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{item.explanation}</span>
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[color:var(--text-soft)]">
                    <span>{actionLabel(item.action_type)}</span>
                    {item.project_name && <span>Project: {item.project_name}</span>}
                    {item.task_title && <span>Task: {item.task_title}</span>}
                    {evidence.slice(0, 2).map((entry, index) => (
                      <span key={`${entry.type || "evidence"}-${index}`}>{entry.source || "evidence"}: {entry.fact || entry.type}</span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  {canDecide && (
                    <>
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => handleAction(item.id, "approve_execute")}
                        loading={busyId === `${item.id}:approve_execute`}
                        leftIcon={<Check className="h-3 w-3" />}
                      >
                        Approve &amp; run
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleAction(item.id, "reject")}
                        loading={busyId === `${item.id}:reject`}
                        leftIcon={<X className="h-3 w-3" />}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleAction(item.id, "ignore")}
                    loading={busyId === `${item.id}:ignore`}
                  >
                    Ignore
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
