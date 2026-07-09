// src/pages/intelligence-studio/RecommendationCenter.jsx
import { Link, useParams } from "react-router-dom";
import { Button, Badge } from "../../components/ui";
import { eiApi } from "../../services/ei.api";
import { PageHeader, Panel, JsonView, Metric, AsyncState, useAsync, statusTone } from "./_shared";

function Detail({ id }) {
  const query = useAsync(() => eiApi.recommendation(id), [id]);
  return (
    <div>
      <PageHeader title="Recommendation" subtitle={id} actions={<Link to="/intelligence-studio/recommendations"><Button size="sm" variant="secondary">← All</Button></Link>} />
      <AsyncState query={query} empty="Recommendation not found.">
        {(d) => (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Recommendation">
              {d.recommendation ? (<div className="space-y-2">
                <div className="flex items-center gap-2"><Badge variant={statusTone(d.recommendation.status)}>{d.recommendation.status}</Badge>{d.recommendation.manualOnly && <Badge variant="neutral">manual only</Badge>}</div>
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {d.prediction && <Link to={`/intelligence-studio/predictions/${d.prediction.predictionId}`} className="text-[color:var(--primary)]">Prediction →</Link>}
                  {d.recommendation.rationaleRefs?.reasoningTraceId && <Link to={`/intelligence-studio/traces/${d.recommendation.rationaleRefs.reasoningTraceId}`} className="text-[color:var(--primary)]">Reasoning trace →</Link>}
                </div>
                <JsonView data={d.recommendation} />
              </div>) : <p className="text-[13px] text-[color:var(--text-soft)]">Not found.</p>}
            </Panel>
            <Panel title="Outcome history">
              {(d.outcomes || []).length ? (d.outcomes || []).map((o) => (
                <div key={o.outcomeId} className="flex items-center justify-between py-1.5 border-b border-[color:var(--border)] last:border-0">
                  <span className="text-[12px] text-[color:var(--text-muted)]">{o.observedAt}{o.impact ? ` · impact ${o.impact.actual}/${o.impact.expected}` : ""}</span>
                  <Badge variant={statusTone(o.status)}>{o.status}</Badge>
                </div>
              )) : <p className="text-[13px] text-[color:var(--text-soft)]">No outcomes recorded yet.</p>}
            </Panel>
          </div>
        )}
      </AsyncState>
    </div>
  );
}

function List() {
  const query = useAsync(() => eiApi.recommendations(), []);
  const eff = useAsync(() => eiApi.effectiveness(), []);
  return (
    <div>
      <PageHeader title="Recommendation Center" subtitle="Recommendation lifecycle — reasoning, decision, execution and measured outcome — all linked." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Recommendations">
          <AsyncState query={query} empty="No recommendations yet.">
            {(d) => (
              <div className="space-y-1.5">
                {(d.recommendations || []).map((r) => (
                  <Link key={r.recommendationId} to={`/intelligence-studio/recommendations/${r.recommendationId}`} className="block rounded-[8px] border border-[color:var(--border)] px-3 py-2.5 hover:bg-[var(--surface-soft)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)] truncate">{r.entity?.type} {r.entity?.id} · {r.recommendationType}</span>
                      <Badge variant={statusTone(r.status)}>{r.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>
        <Panel title="Effectiveness (measured)">
          <AsyncState query={eff} empty="No effectiveness data yet (outcomes required).">
            {(e) => {
              const groups = e.groups || [];
              if (!groups.length) return <p className="text-[13px] text-[color:var(--text-soft)]">No recommendation groups yet.</p>;
              return (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <p className="text-[12px] font-medium text-[color:var(--text)] mb-1">{g.key} <span className="text-[color:var(--text-soft)]">({g.count})</span></p>
                      {["acceptanceRate", "executionRate", "completionRate", "effectiveness"].map((k) => g.metrics?.[k] && <Metric key={k} m={{ key: k, label: k, ...g.metrics[k] }} />)}
                    </div>
                  ))}
                </div>
              );
            }}
          </AsyncState>
        </Panel>
      </div>
    </div>
  );
}

export default function RecommendationCenter() {
  const { id } = useParams();
  return id ? <Detail id={id} /> : <List />;
}
