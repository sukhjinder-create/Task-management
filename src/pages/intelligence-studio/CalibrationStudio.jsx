// src/pages/intelligence-studio/CalibrationStudio.jsx
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";
import { CalibrationCurve } from "./charts";

export default function CalibrationStudio() {
  const query = useAsync(() => eiApi.calibration(), []);
  return (
    <div>
      <PageHeader title="Calibration Studio" subtitle="The versioned calibration model that maps raw confidence to observed frequency. History is never overwritten." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No calibration model built yet (needs validated predictions).">
        {(d) => {
          const model = d.model;
          if (!model) return <p className="text-[13px] text-[color:var(--text-soft)]">No calibration model yet.</p>;
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Current model" actions={<Badge variant="neutral">v{model.version}</Badge>}>
                <CalibrationCurve buckets={model.buckets || []} />
                <p className="text-[11px] text-[color:var(--text-soft)] mt-2">Method: {model.method}. Diagonal = perfectly calibrated; the line shows observed vs predicted.</p>
              </Panel>
              <Panel title="Bucket mappings"><JsonView data={model.buckets} /></Panel>
            </div>
          );
        }}
      </AsyncState>
    </div>
  );
}
