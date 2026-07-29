// src/pages/intelligence-studio/IntelligenceGraph.jsx
//
// Interactive intelligence graph: entities → traces → predictions → recommendations,
// grouped by type; click any reasoning node to open its detail (cross-navigation).
// A force-directed canvas is a follow-up; nodes/edges here are live and traceable.
import { useNavigate } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, AsyncState, useAsync } from "./_shared";

const ROUTE = { trace: "/intelligence-studio/traces", prediction: "/intelligence-studio/predictions", recommendation: "/intelligence-studio/recommendations" };
const TYPES = ["entity", "attribution", "evidence", "trace", "prediction", "recommendation"];

export default function IntelligenceGraph() {
  const query = useAsync(() => eiApi.graph(), []);
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader title="Enterprise Intelligence Graph" subtitle="The full pipeline as a graph — every relationship traceable back to evidence. Click a reasoning node to open it." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No graph yet.">
        {(g) => (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-[12px] text-[color:var(--text-soft)]">
              <Badge variant="neutral">{g.counts?.nodes ?? 0} nodes</Badge>
              <Badge variant="neutral">{g.counts?.edges ?? 0} edges</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TYPES.map((type) => {
                const nodes = (g.nodes || []).filter((n) => n.type === type);
                if (!nodes.length) return null;
                return (
                  <Panel key={type} title={`${type} (${nodes.length})`}>
                    <div className="space-y-1">
                      {nodes.slice(0, 60).map((n) => {
                        const route = ROUTE[type];
                        const label = n.predicate || n.predictionType || n.recommendationType || n.ref;
                        return (
                          <button key={n.id} disabled={!route} onClick={() => route && navigate(`${route}/${n.ref}`)}
                            className={`w-full text-left text-[11.5px] rounded-[6px] border border-[color:var(--border)] px-2 py-1.5 truncate ${route ? "hover:bg-[var(--surface-soft)] text-[color:var(--primary)]" : "text-[color:var(--text-muted)] cursor-default"}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </Panel>
                );
              })}
            </div>
          </div>
        )}
      </AsyncState>
    </div>
  );
}
