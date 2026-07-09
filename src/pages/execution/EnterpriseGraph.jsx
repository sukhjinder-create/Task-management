// src/pages/execution/EnterpriseGraph.jsx
//
// Relationship view over the immutable action log: how decisions, executions,
// approvals, workflows and automations connect. Rendered as a grouped adjacency list
// (a full interactive canvas is a later enhancement); data is live and traceable.
import { Button, Badge } from "../../components/ui";
import { executionApi } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, useAsync } from "./_shared";

export default function EnterpriseGraph() {
  const query = useAsync(() => executionApi.actionLog(), []);
  return (
    <div>
      <PageHeader title="Enterprise Graph" subtitle="How work connects: decisions → approvals → executions → verifications → automations, traced through the immutable action log." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No relationships recorded yet.">
        {(data) => {
          const byRef = {};
          for (const a of data.actions || []) { const k = a.ref_id || "unlinked"; (byRef[k] ||= []).push(a); }
          const groups = Object.entries(byRef);
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {groups.map(([ref, actions]) => (
                <Panel key={ref} title={ref}>
                  <div className="space-y-1.5">
                    {actions.map((a) => (
                      <div key={a.action_id} className="flex items-center gap-2">
                        <Badge variant="neutral">{a.type}</Badge>
                        <span className="text-[11px] text-[color:var(--text-soft)]">{a.occurred_at ? new Date(a.occurred_at).toLocaleTimeString() : ""}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
          );
        }}
      </AsyncState>
    </div>
  );
}
