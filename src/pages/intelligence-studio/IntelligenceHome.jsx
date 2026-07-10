// src/pages/intelligence-studio/IntelligenceHome.jsx
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
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

export default function IntelligenceHome() {
  const query = useAsync(() => eiApi.overview(), []);
  return (
    <div>
      <PageHeader title="Enterprise Intelligence" subtitle="Everything the platform knows — evidence, reasoning, predictions, learning and memory — inspectable and explainable end to end." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <StudioWorkspacePicker onChange={() => query.reload()} />
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
