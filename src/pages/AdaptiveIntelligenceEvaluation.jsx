import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Brain, CheckCircle2, FlaskConical, Gauge, Lightbulb, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { useApi } from "../api";

function percent(value) {
  const number = Number(value || 0);
  return `${Math.round(number * 100)}%`;
}

function count(value) {
  return Number(value || 0).toLocaleString();
}

function MetricCard({ icon, label, value, note }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[color:var(--primary)]">{icon}</span>
      </div>
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

function RankedList({ rows = [], valueLabel = "effectiveness" }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">Evidence appears here as adaptive recommendations mature.</p>;
  }
  const max = Math.max(0.01, ...rows.map((row) => Number(row.averageEffectiveness || 0)));
  return (
    <div className="space-y-3">
      {rows.slice(0, 8).map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-[color:var(--text-muted)]">{row.label}</span>
            <span className="font-medium text-[color:var(--text)]">{percent(row.averageEffectiveness)} · {count(row.count)} uses</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${Math.max(4, (Number(row.averageEffectiveness || 0) / max) * 100)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">{valueLabel}</p>
        </div>
      ))}
    </div>
  );
}

function RecentExplanations({ rows = [] }) {
  if (!rows.length) {
    return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">No evaluated recommendations in this period yet.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((item) => (
        <article key={item.evaluationId} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-start gap-3">
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[color:var(--text)]">{item.recommendation}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.wouldRecommendAgain ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}`}>
                  {item.wouldRecommendAgain ? "Recommend again" : "Needs review"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.whyRecommended}</p>
              <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">{item.outcome}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CoachInsights({ insights = [] }) {
  if (!insights.length) {
    return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">Coach guidance appears after AIEP has measured recommendations.</p>;
  }
  const tone = {
    positive: "bg-emerald-500/10 text-emerald-500",
    attention: "bg-amber-500/10 text-amber-500",
    critical: "bg-red-500/10 text-red-500",
    info: "bg-[var(--surface-soft)] text-[color:var(--text-muted)]",
  };
  return (
    <div className="space-y-3">
      {insights.slice(0, 5).map((item) => (
        <article key={item.id || item.title} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[color:var(--text)]">{item.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone[item.severity] || tone.info}`}>{item.type}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.summary}</p>
              {item.evidence?.length > 0 && (
                <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">Evidence: {item.evidence.slice(0, 2).join(" ")}</p>
              )}
              {item.expectedBusinessImpact && (
                <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">Expected impact: {item.expectedBusinessImpact}</p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ExperimentsPanel({ experiments = [], onEvaluate, onCreate, busy }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
      >
        <FlaskConical className="h-3.5 w-3.5" /> Create strategy experiment
      </button>
      {!experiments.length ? (
        <p className="py-6 text-center text-xs text-[color:var(--text-muted)]">No active experiments yet. Experiments compare strategies only after enough evidence exists.</p>
      ) : experiments.slice(0, 5).map((experiment) => (
        <article key={experiment.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[color:var(--text)]">{experiment.name}</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{experiment.hypothesis}</p>
              <p className="mt-1 text-[11px] text-[color:var(--text-soft)]">{experiment.variants?.length || 0} variants · {experiment.status}</p>
            </div>
            <button
              type="button"
              onClick={() => onEvaluate(experiment.id)}
              disabled={busy}
              className="shrink-0 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-[11px] text-[color:var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-50"
            >
              Evaluate
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function MemoryPatterns({ patterns = [], onDiscover, busy }) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onDiscover}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
      >
        <Brain className="h-3.5 w-3.5" /> Discover patterns
      </button>
      {!patterns.length ? (
        <p className="py-6 text-center text-xs text-[color:var(--text-muted)]">No behavioural patterns discovered yet.</p>
      ) : patterns.slice(0, 6).map((pattern) => (
        <article key={pattern.id || pattern.pattern_key} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-[color:var(--text)]">{pattern.business_label}</p>
            <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[color:var(--text-soft)]">{pattern.direction}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{pattern.pattern_summary}</p>
          {pattern.recommended_use && <p className="mt-1 text-[11px] leading-4 text-[color:var(--text-soft)]">{pattern.recommended_use}</p>}
        </article>
      ))}
    </div>
  );
}

export default function AdaptiveIntelligenceEvaluation() {
  const api = useApi();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [coach, setCoach] = useState(null);
  const [experiments, setExperiments] = useState([]);
  const [memoryPatterns, setMemoryPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIntelligence, setBusyIntelligence] = useState(false);

  const load = useCallback(async ({ refresh = true } = {}) => {
    setLoading(true);
    try {
      const [dashboardRes, coachRes, experimentsRes, memoryRes] = await Promise.all([
        api.get("/adaptive/intelligence/dashboard", { params: { days, refresh } }),
        api.get("/adaptive/intelligence/coach", { params: { days } }),
        api.get("/adaptive/intelligence/experiments"),
        api.get("/adaptive/intelligence/memory-patterns"),
      ]);
      setData(dashboardRes.data);
      setCoach(coachRes.data);
      setExperiments(experimentsRes.data?.experiments || []);
      setMemoryPatterns(memoryRes.data?.patterns || []);
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load AI Impact");
    } finally {
      setLoading(false);
    }
  }, [api, days]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await api.post("/adaptive/intelligence/refresh", { days, limit: 150 });
      await load({ refresh: false });
      toast.success("Evaluation refreshed");
    } catch (error) {
      toast.error(error.response?.data?.error || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const createExperiment = async () => {
    const first = data?.strategyEffectiveness?.[0]?.label || "Meeting follow-through";
    const second = data?.strategyEffectiveness?.find((item) => item.label !== first)?.label || "Communication and nudges";
    setBusyIntelligence(true);
    try {
      await api.post("/adaptive/intelligence/experiments", {
        name: `${first} vs ${second}`,
        hypothesis: `Compare whether ${first} produces stronger business outcomes than ${second}.`,
        status: "active",
        minimumSampleSize: 20,
        meaningfulDelta: 0.08,
        variants: [
          { key: "strategy_a", label: first, filter: { recommendationCategory: first } },
          { key: "strategy_b", label: second, filter: { recommendationCategory: second } },
        ],
      });
      toast.success("Experiment created");
      await load({ refresh: false });
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not create experiment");
    } finally {
      setBusyIntelligence(false);
    }
  };

  const evaluateExperiment = async (experimentId) => {
    setBusyIntelligence(true);
    try {
      const response = await api.post(`/adaptive/intelligence/experiments/${experimentId}/evaluate`, { days });
      toast.success(response.data?.result?.recommendation?.summary || "Experiment evaluated");
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not evaluate experiment");
    } finally {
      setBusyIntelligence(false);
    }
  };

  const discoverPatterns = async () => {
    setBusyIntelligence(true);
    try {
      const response = await api.post("/adaptive/intelligence/memory-patterns/discover", { days });
      setMemoryPatterns(response.data?.patterns || []);
      toast.success(`${response.data?.discovered || 0} pattern(s) discovered`);
    } catch (error) {
      toast.error(error.response?.data?.error || "Could not discover memory patterns");
    } finally {
      setBusyIntelligence(false);
    }
  };

  const response = data?.recommendationResponse || {};
  const calibration = data?.confidenceCalibration || {};
  const runtime = data?.observability?.runs || {};
  const headline = data?.headline || {};

  const helpfulLabel = useMemo(() => headline.isAdaptiveIntelligenceHelping || "Not enough evidence yet", [headline]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Adaptive Intelligence Evaluation</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[color:var(--text)]">AI Impact</h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[color:var(--text-muted)]">
            Measures whether Asystence recommendations, workflows, context, and learning are improving real operational outcomes.
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
            onClick={refresh}
            disabled={loading || refreshing}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading || refreshing ? "animate-spin" : ""}`} />
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Is Adaptive Intelligence helping?" value={helpfulLabel} note={`${count(headline.evaluatedRecommendations)} evaluated recommendations`} />
            <MetricCard icon={<Gauge className="h-4 w-4" />} label="Average effectiveness" value={percent(headline.averageEffectiveness)} note="Composite outcome score, not just acceptance" />
            <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Accepted or executed" value={count((response.accepted || 0) + (response.executed || 0))} note={`${count(response.rejected)} rejected · ${count(response.pending)} pending`} />
            <MetricCard icon={<Activity className="h-4 w-4" />} label="Runtime health" value={`${count(runtime.total_runs)} runs`} note={`${count(runtime.failed_runs)} failed · avg ${runtime.average_runtime_ms || 0}ms`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Adaptive Intelligence Coach" subtitle="Evidence-based guidance from measured outcomes">
              <CoachInsights insights={coach?.insights} />
            </Panel>
            <Panel title="Adaptive Experiments" subtitle="Compare strategies only after meaningful evidence exists">
              <ExperimentsPanel experiments={experiments} onCreate={createExperiment} onEvaluate={evaluateExperiment} busy={busyIntelligence} />
            </Panel>
            <Panel title="Adaptive Memory" subtitle="Behavioural patterns discovered from feedback and outcomes">
              <MemoryPatterns patterns={memoryPatterns} onDiscover={discoverPatterns} busy={busyIntelligence} />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Which recommendation strategies work?" subtitle="Ranked by measured business effectiveness">
              <RankedList rows={data?.strategyEffectiveness} />
            </Panel>
            <Panel title="Which capabilities create value?" subtitle="Human-facing capability contribution, not internal implementation keys">
              <RankedList rows={data?.capabilityEffectiveness} />
            </Panel>
            <Panel title="Which context improves decisions?" subtitle="Measured context sources present in useful recommendation lifecycles">
              <RankedList rows={data?.contextEffectiveness} valueLabel="context contribution" />
            </Panel>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <Panel title="Confidence calibration" subtitle="Predicted confidence compared with actual outcomes">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={<TrendingUp className="h-4 w-4" />} label="Evaluated predictions" value={count(calibration.evaluated)} />
                <MetricCard icon={<Gauge className="h-4 w-4" />} label="Calibration status" value={calibration.calibrationStatus || "Waiting"} />
                <MetricCard icon={<Activity className="h-4 w-4" />} label="False positives" value={count(calibration.falsePositives)} />
                <MetricCard icon={<Activity className="h-4 w-4" />} label="False negatives" value={count(calibration.falseNegatives)} />
              </div>
            </Panel>
            <Panel title="Recent explainability" subtitle="Why Asystence recommended it, what happened, and whether it should repeat">
              <RecentExplanations rows={data?.recentExplanations} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
