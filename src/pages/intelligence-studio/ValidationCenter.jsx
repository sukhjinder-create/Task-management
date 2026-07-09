// src/pages/intelligence-studio/ValidationCenter.jsx
import { Button } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, Metric, AsyncState, useAsync } from "./_shared";
import { CalibrationCurve, Distribution } from "./charts";

export default function ValidationCenter() {
  const query = useAsync(() => eiApi.validation(), []);
  return (
    <div>
      <PageHeader title="Validation Center" subtitle="Prediction accuracy, precision, recall, Brier score, false positives/negatives and calibration — deterministic, from measured outcomes." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No validated predictions yet (outcomes required).">
        {(d) => {
          const metrics = Object.entries(d.metrics || {}).map(([key, m]) => ({ key, label: key, ...m }));
          const buckets = d.calibration || [];
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Validation metrics">{metrics.map((m) => <Metric key={m.key} m={m} />)}</Panel>
              <Panel title="Calibration curve">
                {buckets.length ? <CalibrationCurve buckets={buckets} /> : <p className="text-[13px] text-[color:var(--text-soft)]">No calibration data yet.</p>}
                {buckets.length > 0 && <div className="mt-3"><p className="text-[11px] text-[color:var(--text-soft)] mb-1">Volume by confidence bucket</p><Distribution values={Array.from({ length: 10 }, (_, i) => buckets.find((b) => b.bucket === i)?.count || 0)} /></div>}
              </Panel>
            </div>
          );
        }}
      </AsyncState>
    </div>
  );
}
