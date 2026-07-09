// src/pages/intelligence-studio/PlatformHealth.jsx
import { Button } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, Metric, AsyncState, useAsync } from "./_shared";
import { Bars } from "./charts";

export default function PlatformHealth() {
  const query = useAsync(() => eiApi.health(), []);
  return (
    <div>
      <PageHeader title="Platform Health" subtitle="Reasoning, prediction, recommendation and calibration quality, coverage, unknown rate, graph completeness and learning maturity." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No health signal yet.">
        {(d) => {
          const metrics = d.health || [];
          const numeric = metrics.filter((m) => m.evidenceSufficient && typeof m.value === "number").map((m) => ({ label: m.label || m.key, value: Math.round(m.value * 100) / 100 }));
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Quality metrics">{metrics.map((m) => <Metric key={m.key} m={m} />)}</Panel>
              <Panel title="Quality at a glance">{numeric.length ? <Bars data={numeric} /> : <p className="text-[13px] text-[color:var(--text-soft)]">No numeric quality metrics yet (outcomes required).</p>}</Panel>
            </div>
          );
        }}
      </AsyncState>
    </div>
  );
}
