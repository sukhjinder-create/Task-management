// src/pages/execution/ExecutionDashboard.jsx
import { Button, Badge } from "../../components/ui";
import { executionApi } from "../../services/execution.api";
import { PageHeader, Panel, Metric, AsyncState, useAsync } from "./_shared";

export default function ExecutionDashboard() {
  const analytics = useAsync(() => executionApi.analytics(), []);
  const log = useAsync(() => executionApi.actionLog(), []);
  return (
    <div>
      <PageHeader title="Execution Dashboard" subtitle="Live execution timeline, success/failure, latency and automation share — computed from the immutable action log." actions={<Button size="sm" variant="secondary" onClick={() => { analytics.reload(); log.reload(); }}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Analytics">
          <AsyncState query={analytics} empty="No analytics yet.">
            {(data) => (data.analytics || []).map((m) => <Metric key={m.key} m={m} />)}
          </AsyncState>
        </Panel>
        <Panel title="Recent actions">
          <AsyncState query={log} empty="No actions logged yet.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.actions || []).slice(0, 40).map((a) => (
                  <div key={a.action_id} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                    <span className="text-[12px] text-[color:var(--text-muted)] truncate">{a.ref_id || "—"}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="neutral">{a.type}</Badge>
                      <span className="text-[11px] text-[color:var(--text-soft)]">{a.occurred_at ? new Date(a.occurred_at).toLocaleString() : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
      </div>
    </div>
  );
}
