import { useEffect, useState } from "react";
import { getAdminInsights } from "../../services/intelligence.api";
import { useApi } from "../../api";
import toast from "react-hot-toast";
import {
  RefreshCw, Users, TrendingUp, AlertTriangle, Shield,
  BarChart2, CheckCircle, Clock,
} from "lucide-react";

export default function AdminIntelligence() {
  const api   = useApi();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [running, setRunning]   = useState(false);

  const month = new Date().toISOString().slice(0, 7);

  const loadData = () => {
    setLoading(true);
    setError(null);
    getAdminInsights(month)
      .then((res) => setData(res.data || null))
      .catch(() => setError("Unable to load admin intelligence data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [month]);

  const recalculate = async () => {
    setRunning(true);
    try {
      await api.post("/intelligence/admin/run-monthly-scoring", { month });
      toast.success(`Enterprise intelligence refreshed for ${month}`);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Recalculation failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Intelligence
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            Organization Intelligence
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            {month} · Workspace intelligence overview
          </p>
        </div>
        <button
          onClick={recalculate}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Refreshing…" : "Refresh Intelligence"}
        </button>
      </header>

      {loading && (
        <div className="border border-[color:var(--border)] rounded-lg p-8 text-center">
          <p className="text-sm text-[color:var(--text-muted)] animate-pulse">
            Loading intelligence data…
          </p>
        </div>
      )}

      {error && (
        <div className="border border-[color:var(--score-danger)] rounded-lg p-4 text-sm text-[color:var(--score-danger)]">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="border border-[color:var(--border)] rounded-lg p-8 text-center">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-[color:var(--text-soft)]" />
          <p className="text-[color:var(--text)] font-medium">No intelligence data yet</p>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            Click "Refresh Intelligence" to run a canonical enterprise intelligence refresh.
          </p>
        </div>
      )}

      {data && (
        <div className="space-y-5">

          {/* Org Score Overview */}
          {data.orgScore && (
            <div className="border border-[color:var(--border)] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-[color:var(--text)] mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[color:var(--primary)]" /> Score Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Avg Score",
                    value: data.orgScore.averageScore,
                    icon: <TrendingUp className="w-4 h-4" />,
                    colorClass: "text-[color:var(--primary)]",
                  },
                  {
                    label: "Total Members",
                    value: data.orgScore.userCount,
                    icon: <Users className="w-4 h-4" />,
                    colorClass: "text-[color:var(--text)]",
                  },
                  {
                    label: "High Performers",
                    value: data.orgScore.highPerformers,
                    icon: <CheckCircle className="w-4 h-4" />,
                    colorClass: "text-[color:var(--primary)]",
                  },
                  {
                    label: "At Risk",
                    value: data.orgScore.atRiskUsers,
                    icon: <AlertTriangle className="w-4 h-4" />,
                    colorClass: data.orgScore.atRiskUsers > 0
                      ? "text-[color:var(--score-danger)]"
                      : "text-[color:var(--text-muted)]",
                  },
                ].map((tile) => (
                  <div key={tile.label} className="border border-[color:var(--border)] rounded-lg p-4">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 bg-[var(--surface-soft)] ${tile.colorClass}`}>
                      {tile.icon}
                    </div>
                    <p className={`text-2xl font-bold ${tile.colorClass}`}>
                      {tile.value ?? "—"}
                    </p>
                    <p className="text-xs text-[color:var(--text-muted)] mt-0.5">{tile.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Distribution */}
          {data.riskDistribution && (
            <div className="border border-[color:var(--border)] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-[color:var(--text)] mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-[color:var(--score-warning)]" /> Risk Distribution
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Low Risk",
                    value: data.riskDistribution.low_risk ?? data.riskDistribution.lowRisk,
                    colorClass: "text-[color:var(--primary)]",
                  },
                  {
                    label: "Medium Risk",
                    value: data.riskDistribution.medium_risk ?? data.riskDistribution.mediumRisk,
                    colorClass: "text-[color:var(--score-warning)]",
                  },
                  {
                    label: "High Risk",
                    value: data.riskDistribution.high_risk ?? data.riskDistribution.highRisk,
                    colorClass: "text-[color:var(--score-danger)]",
                  },
                ].map((r) => (
                  <div key={r.label} className="border border-[color:var(--border)] rounded-lg p-4 text-center">
                    <p className={`text-3xl font-bold ${r.colorClass}`}>{r.value ?? 0}</p>
                    <p className="text-xs text-[color:var(--text-muted)] mt-1">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Effectiveness */}
          {data.coachingEffectiveness && Object.keys(data.coachingEffectiveness).length > 0 && (
            <div className="border border-[color:var(--border)] rounded-lg p-5">
              <h2 className="text-sm font-semibold text-[color:var(--text)] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[color:var(--primary)]" /> Coaching Effectiveness
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(data.coachingEffectiveness).map(([key, value]) => (
                  <div key={key} className="border border-[color:var(--border)] rounded-lg p-3">
                    <p className="text-xs text-[color:var(--text-muted)] capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-lg font-bold text-[color:var(--text)] mt-0.5">
                      {typeof value === "number" ? value.toFixed(1) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
