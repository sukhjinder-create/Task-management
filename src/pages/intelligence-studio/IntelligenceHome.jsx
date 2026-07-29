// src/pages/intelligence-studio/IntelligenceHome.jsx
import { Link } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { getOrchestratorStatus } from "../../services/studioWorkspace";
import StudioWorkspacePicker from "../../components/StudioWorkspacePicker";
import { PageHeader, Panel, StatCard, Metric, AsyncState, useAsync } from "./_shared";
import { PipelineFlow } from "./charts";

const NAV = [
  ["Evidence", "evidence"], ["Attributions", "attributions"], ["Reasoning Traces", "traces"],
  ["Predictions", "predictions"], ["Recommendations", "recommendations"], ["Executive", "executive"],
  ["Outcomes", "outcomes"], ["Validation", "validation"], ["Calibration", "calibration"],
  ["Learning", "learning"], ["Experiments", "experiments"], ["Memory", "memory"],
  ["Platform Health", "health"], ["Graph", "graph"], ["Search", "search"],
];

function PipelineHealth() {
  const query = useAsync(() => getOrchestratorStatus(), []);
  if (query.loading || query.error) return null; // quiet panel — health is supplementary
  const m = query.data || {};
  return (
    <Panel title="Pipeline runs (background worker)">
      <div className="flex items-center gap-4 flex-wrap text-[12.5px]">
        <span>Runs since start: <b className="tabular-nums">{m.runs ?? 0}</b></span>
        <span>Failures: <b className="tabular-nums">{m.failures ?? 0}</b></span>
        <Badge variant={m.failures > 0 ? "warning" : "success"}>{m.failures > 0 ? `${Math.round((m.failureRate || 0) * 100)}% failing` : "healthy"}</Badge>
        <span className="text-[color:var(--text-soft)]">Last run: {m.lastRunAt ? new Date(m.lastRunAt).toLocaleString() : "not yet (runs every 5 min for enabled workspaces)"}</span>
        {m.lastError && <span className="text-[color:var(--score-danger)] truncate">Last error: {m.lastError.message}</span>}
      </div>
      {(m.recent || []).length > 0 && (
        <div className="mt-2 space-y-1">
          {m.recent.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between text-[11.5px] text-[color:var(--text-muted)]">
              <span className="truncate">{new Date(r.ts).toLocaleTimeString()} · ws {String(r.workspaceId).slice(0, 8)}… · {r.durationMs}ms{r.ok ? ` · ${r.events ?? 0} events → ${r.recommendations ?? 0} recommendations` : ""}</span>
              <Badge variant={r.ok ? "success" : "danger"}>{r.ok ? "ok" : "failed"}</Badge>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function IntelligenceHome() {
  const query = useAsync(() => eiApi.overview(), []);
  return (
    <div>
      <PageHeader title="Enterprise Intelligence" subtitle="Everything the platform knows — evidence, reasoning, predictions, learning and memory — inspectable and explainable end to end." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <StudioWorkspacePicker feature="intelligence" onChange={() => query.reload()} />
      <div className="mb-4 rounded-[10px] border border-[color:var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-[12.5px] text-[color:var(--text-muted)]">
        <b className="text-[color:var(--text)]">What this is:</b> a read‑only, fully explainable view of everything the platform reasons about this workspace — Events → Evidence → Attribution → Reasoning → Prediction → Recommendation — plus Validation, Calibration, Learning, Organizational Memory and Platform Health. Every conclusion links back to the evidence that supports it.
      </div>
      <AsyncState query={query} empty="No intelligence recorded yet for this workspace.">
        {(d) => {
          const c = d.counts || {};
          return (
            <div className="space-y-5">
              <Panel title="Intelligence pipeline">
                <PipelineFlow stages={[
                  { label: "Evidence", count: c.evidence }, { label: "Attribution", count: c.attributions },
                  { label: "Reasoning", count: c.traces }, { label: "Prediction", count: c.predictions },
                  { label: "Recommend", count: c.recommendations }, { label: "Outcome", count: c.outcomes },
                  { label: "Learning", count: c.learning }, { label: "Memory", count: c.memory },
                ]} />
              </Panel>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard label="Reasoning traces" value={c.traces} />
                <StatCard label="Predictions" value={c.predictions} />
                <StatCard label="Recommendations" value={c.recommendations} />
                <StatCard label="Graph nodes" value={d.graph?.nodes} hint={`${d.graph?.edges ?? 0} edges`} />
              </div>
              <PipelineHealth />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Panel title="Platform metrics">{(d.metrics || []).map((m) => <Metric key={m.key} m={m} />)}</Panel>
                <Panel title="Explore">
                  <div className="grid grid-cols-2 gap-2">
                    {NAV.map(([label, to]) => (
                      <Link key={to} to={`/intelligence-studio/${to}`} className="rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 text-[13px] font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">{label} →</Link>
                    ))}
                  </div>
                </Panel>
              </div>
            </div>
          );
        }}
      </AsyncState>
    </div>
  );
}
