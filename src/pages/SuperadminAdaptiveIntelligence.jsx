import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, Gauge, Layers3, LockKeyhole, RefreshCw, TrendingUp, Users } from "lucide-react";
import toast from "react-hot-toast";
import superadminApi from "../superadminApi";

function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function count(value) {
  return Number(value || 0).toLocaleString();
}

function MetricCard({ icon, label, value, note }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <span className="text-[color:var(--primary)]">{icon}</span>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text)]">{value}</p>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{label}</p>
      {note && <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">{note}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[color:var(--border)] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RankedList({ rows = [] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">Aggregate evidence appears here as evaluations accumulate.</p>;
  }
  const max = Math.max(0.01, ...rows.map((row) => Number(row.averageEffectiveness || 0)));
  return (
    <div className="space-y-3">
      {rows.slice(0, 10).map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-[color:var(--text-muted)]">{row.label}</span>
            <span className="font-medium text-[color:var(--text)]">{percent(row.averageEffectiveness)} · {count(row.count)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${Math.max(4, (Number(row.averageEffectiveness || 0) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CoachList({ rows = [] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">Platform coach insights appear after aggregate evidence is available.</p>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.slice(0, 6).map((item) => (
        <article key={item.id || item.title} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-[color:var(--text)]">{item.title}</p>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[color:var(--text-soft)]">{item.type}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.summary}</p>
          {item.evidence?.length > 0 && (
            <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">Evidence: {item.evidence.slice(0, 2).join(" ")}</p>
          )}
        </article>
      ))}
    </div>
  );
}

export default function SuperadminAdaptiveIntelligence() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [coach, setCoach] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardRes, coachRes] = await Promise.all([
        superadminApi.get("/superadmin/adaptive-intelligence/dashboard", { params: { days } }),
        superadminApi.get("/superadmin/adaptive-intelligence/coach", { params: { days } }),
      ]);
      setData(dashboardRes.data);
      setCoach(coachRes.data);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load Platform AI Intelligence");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const headline = data?.headline || {};
  const calibration = data?.confidenceCalibration || {};
  const runtime = data?.observability?.runtime || {};

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Platform Intelligence</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[color:var(--text)]">Adaptive Intelligence Evaluation</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--text-muted)]">
            Aggregated platform-level view of adaptive impact. Customer content, workspace names, and workspace identifiers are intentionally excluded.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="h-9 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[color:var(--text)]"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      {loading && !data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[1,2,3,4].map((key) => <div key={key} className="h-32 animate-pulse rounded-xl border border-[color:var(--border)] bg-[var(--surface-soft)]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={<BrainCircuit className="h-4 w-4" />} label="Platform adaptive impact" value={headline.platformAdaptiveImpact || "No evidence yet"} note={`${count(headline.evaluatedRecommendations)} evaluated recommendations`} />
            <MetricCard icon={<Gauge className="h-4 w-4" />} label="Average effectiveness" value={percent(headline.averageEffectiveness)} />
            <MetricCard icon={<Users className="h-4 w-4" />} label="Active workspaces" value={count(data?.activeWorkspaceCount)} note="Aggregated count only" />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Evaluated predictions" value={count(calibration.evaluated)} note={`${count(calibration.falsePositives)} false positives · ${count(calibration.falseNegatives)} false negatives`} />
            <MetricCard icon={<Layers3 className="h-4 w-4" />} label="Runtime runs" value={count(runtime.total_runs)} note={`${count(runtime.failed_runs)} failed · avg ${runtime.average_runtime_ms || 0}ms`} />
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-[color:var(--text)]">Tenant-safe aggregation</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">
                  This view reports platform trends only. It does not include workspace names, workspace identifiers, project names, task titles, messages, meeting content, or customer-specific evidence.
                </p>
              </div>
            </div>
          </div>

          <Panel title="Platform Adaptive Intelligence Coach" subtitle="Aggregate-only guidance for improving platform intelligence quality">
            <CoachList rows={coach?.insights} />
          </Panel>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Recommendation categories" subtitle="Which adaptive strategies produce platform-level value">
              <RankedList rows={data?.strategyEffectiveness} />
            </Panel>
            <Panel title="Capability contribution" subtitle="Business-facing capability impact">
              <RankedList rows={data?.capabilityEffectiveness} />
            </Panel>
            <Panel title="Context contribution" subtitle="Which context sources correlate with better outcomes">
              <RankedList rows={data?.contextEffectiveness} />
            </Panel>
          </div>

          <Panel title="Confidence calibration" subtitle="Aggregate prediction quality across evaluated outcomes">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard icon={<Gauge className="h-4 w-4" />} label="Calibration status" value={calibration.calibrationStatus || "Waiting"} />
              <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Pending predictions" value={count(calibration.pending)} />
              <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Overconfident cases" value={count(calibration.overconfident)} />
              <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Underconfident cases" value={count(calibration.underconfident)} />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
