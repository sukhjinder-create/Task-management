// src/pages/execution/ExecutiveDashboard.jsx
import { Button } from "../../components/ui";
import { executionApi } from "../../services/execution.api";
import { PageHeader, StatCard, Panel, Metric, AsyncState, useAsync } from "./_shared";

export default function ExecutiveDashboard() {
  const cc = useAsync(() => executionApi.controlCenter(), []);
  return (
    <div>
      <PageHeader title="Executive Dashboard" subtitle="Organization execution health in business terms — decisions taken, work executed, automation and their measured effect." actions={<Button size="sm" variant="secondary" onClick={cc.reload}>Refresh</Button>} />
      <AsyncState query={cc} empty="No executive signal yet.">
        {(data) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Decisions taken" value={data.overview?.decisions} hint="recommendations acted on" />
              <StatCard label="Actions executed" value={data.overview?.executions} />
              <StatCard label="Audited events" value={data.overview?.actions} />
            </div>
            <Panel title="Measured effect">
              {(data.analytics || []).map((m) => <Metric key={m.key} m={m} />)}
              <p className="text-[11px] text-[color:var(--text-soft)] mt-3">Metrics marked “insufficient evidence” need measured outcomes (ROI, adoption) that are recorded once the platform runs with real activity — never estimated.</p>
            </Panel>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
