// src/pages/intelligence-studio/ExecutiveIntelligence.jsx
import { Link } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, AsyncState, useAsync } from "./_shared";

const TITLES = {
  delivery_slowing: "Why is delivery slowing?",
  projects_highest_risk: "Which projects are at highest risk?",
  departments_needing_attention: "Which departments need attention?",
  recommendations_with_impact: "Which recommendations created measurable improvement?",
  strategies_outperforming: "Which strategies consistently outperform?",
  behaviours_changing: "Which organizational behaviours are changing?",
};

export default function ExecutiveIntelligence() {
  const query = useAsync(() => eiApi.executive(), []);
  return (
    <div>
      <PageHeader title="Executive Intelligence" subtitle="Answers to executive questions — each supported by evidence, or honestly marked ‘insufficient evidence’ with the reason. No unsupported conclusions." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <AsyncState query={query} empty="No executive intelligence yet.">
        {(d) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(d.answers || []).map((a) => (
              <Panel key={a.questionType} title={TITLES[a.questionType] || a.questionType}
                actions={<Badge variant={a.status === "answered" ? "success" : "neutral"}>{a.status === "answered" ? `${a.findings?.length || 0} findings` : "insufficient evidence"}</Badge>}>
                {a.status === "answered" ? (
                  <div className="space-y-1.5">
                    {(a.findings || []).slice(0, 6).map((f, i) => (
                      <div key={i} className="text-[12.5px] text-[color:var(--text-muted)]">
                        {f.entity ? `${f.entity.type} ${f.entity.id}` : f.factor || f.department || "—"}
                        {f.probability != null && <span className="ml-2 tabular-nums">p={f.probability}</span>}
                        {f.predictionId && <Link to={`/intelligence-studio/predictions/${f.predictionId}`} className="ml-2 text-[color:var(--primary)]">view →</Link>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-[12.5px] text-[color:var(--text-soft)]">{a.reason}</p>}
              </Panel>
            ))}
          </div>
        )}
      </AsyncState>
    </div>
  );
}
