// src/pages/execution/EnterpriseControlCenter.jsx
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import { executionApi } from "../../services/execution.api";
import StudioWorkspacePicker from "../../components/StudioWorkspacePicker";
import { PageHeader, StatCard, Panel, Metric, AsyncState, useAsync } from "./_shared";

const LINKS = [
  ["Decisions", "/execution/decisions"],
  ["Approvals", "/execution/approvals"],
  ["Execution", "/execution/dashboard"],
  ["Workflows", "/execution/workflows"],
  ["Capabilities", "/execution/capabilities"],
  ["Policies", "/execution/policies"],
  ["Automations", "/execution/automations"],
  ["Graph", "/execution/graph"],
];

export default function EnterpriseControlCenter() {
  const query = useAsync(() => executionApi.controlCenter(), []);
  return (
    <div>
      <PageHeader
        title="Enterprise Control Center"
        subtitle="Live health of decisions, execution, approvals and automation across the workspace."
        actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>}
      />
      <StudioWorkspacePicker onChange={() => query.reload()} />
      <AsyncState query={query} empty="No activity recorded yet.">
        {(data) => (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Decisions" value={data.overview?.decisions} />
              <StatCard label="Executions" value={data.overview?.executions} />
              <StatCard label="Logged actions" value={data.overview?.actions} />
              <StatCard label="Metrics tracked" value={data.analytics?.length} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Panel title="Execution & automation health">
                {(data.analytics || []).map((m) => <Metric key={m.key} m={m} />)}
              </Panel>
              <Panel title="Jump to">
                <div className="grid grid-cols-2 gap-2">
                  {LINKS.map(([label, to]) => (
                    <Link key={to} to={to} className="rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 text-[13px] font-medium text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors">
                      {label} →
                    </Link>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
