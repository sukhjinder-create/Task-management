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
      toast.success(`Scores recalculated for ${month}`);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold theme-text">Organization Intelligence</h1>
          <p className="text-sm theme-text-muted mt-1">{month} · Workspace scoring overview</p>
        </div>
        <button
          onClick={recalculate}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "Recalculating…" : "Recalculate Scores"}
        </button>
      </div>

      {loading && (
        <div className="theme-surface border theme-border rounded-xl p-8 text-center">
          <p className="theme-text-muted text-sm">Loading intelligence data…</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && !data && (
        <div className="theme-surface border theme-border rounded-xl p-8 text-center">
          <BarChart2 className="w-10 h-10 mx-auto mb-3 text-indigo-300" />
          <p className="theme-text font-medium">No intelligence data yet</p>
          <p className="text-sm theme-text-muted mt-1">Click "Recalculate Scores" to run the monthly evaluation.</p>
        </div>
      )}

      {data && (
        <div className="space-y-5">

          {/* Org Score Overview */}
          {data.orgScore && (
            <div className="theme-surface border theme-border rounded-xl p-5">
              <h2 className="text-sm font-semibold theme-text mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-indigo-500" /> Score Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Avg Score",       value: data.orgScore.averageScore,   icon: <TrendingUp className="w-4 h-4" />,    color: "text-indigo-500",  bg: "bg-indigo-500/10"  },
                  { label: "Total Members",   value: data.orgScore.userCount,      icon: <Users className="w-4 h-4" />,         color: "text-blue-500",   bg: "bg-blue-500/10"   },
                  { label: "High Performers", value: data.orgScore.highPerformers, icon: <CheckCircle className="w-4 h-4" />,   color: "text-emerald-500",bg: "bg-emerald-500/10"},
                  { label: "At Risk",         value: data.orgScore.atRiskUsers,    icon: <AlertTriangle className="w-4 h-4" />, color: data.orgScore.atRiskUsers > 0 ? "text-red-500" : "text-emerald-500", bg: data.orgScore.atRiskUsers > 0 ? "bg-red-500/10" : "bg-emerald-500/10" },
                ].map(tile => (
                  <div key={tile.label} className={`rounded-xl border p-4 ${tile.bg} border-[var(--border)]`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${tile.bg} ${tile.color}`}>
                      {tile.icon}
                    </div>
                    <p className={`text-2xl font-bold ${tile.color}`}>{tile.value ?? "—"}</p>
                    <p className="text-xs theme-text-muted mt-0.5">{tile.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Distribution */}
          {data.riskDistribution && (
            <div className="theme-surface border theme-border rounded-xl p-5">
              <h2 className="text-sm font-semibold theme-text mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-500" /> Risk Distribution
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Low Risk",    value: data.riskDistribution.low_risk    ?? data.riskDistribution.lowRisk,    color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                  { label: "Medium Risk", value: data.riskDistribution.medium_risk ?? data.riskDistribution.mediumRisk, color: "text-amber-500",   bg: "bg-amber-500/10",   border: "border-amber-500/20"  },
                  { label: "High Risk",   value: data.riskDistribution.high_risk   ?? data.riskDistribution.highRisk,   color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/20"    },
                ].map(r => (
                  <div key={r.label} className={`rounded-xl border p-4 text-center ${r.bg} ${r.border}`}>
                    <p className={`text-3xl font-bold ${r.color}`}>{r.value ?? 0}</p>
                    <p className="text-xs theme-text-muted mt-1">{r.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Effectiveness */}
          {data.coachingEffectiveness && Object.keys(data.coachingEffectiveness).length > 0 && (
            <div className="theme-surface border theme-border rounded-xl p-5">
              <h2 className="text-sm font-semibold theme-text mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Coaching Effectiveness
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(data.coachingEffectiveness).map(([key, value]) => (
                  <div key={key} className="theme-surface border theme-border rounded-lg p-3">
                    <p className="text-xs theme-text-muted capitalize">{key.replace(/_/g, " ")}</p>
                    <p className="text-lg font-bold theme-text mt-0.5">{typeof value === "number" ? value.toFixed(1) : value}</p>
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
