// src/pages/execution/WorkflowBuilder.jsx
//
// Definition-driven workflow builder (JSON graph editor + run). A full drag-and-drop
// canvas is a later enhancement; this edits the same validated definition the engine
// runs, so it is fully functional against the live engine.
import { useState } from "react";
import { Button, Badge, Textarea } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, JsonView, useAsync, statusTone } from "./_shared";

export default function WorkflowBuilder() {
  const templates = useAsync(() => executionApi.workflowTemplates(), []);
  const runs = useAsync(() => executionApi.workflowRuns(), []);
  const [def, setDef] = useState("");
  const [facts, setFacts] = useState("{\n  \"risk\": 90\n}");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const loadTemplate = (t) => setDef(JSON.stringify(t, null, 2));
  const run = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const payload = { definition: JSON.parse(def || "{}"), facts: JSON.parse(facts || "{}"), idempotencyKey: `ui-${Date.now()}` };
      setResult(await executionApi.runWorkflow(payload)); runs.reload();
    } catch (e) { setErr(e instanceof SyntaxError ? { message: "Definition/facts are not valid JSON." } : execError(e)); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Workflow Builder" subtitle="Compose capability / approval / condition / retry / compensation nodes and run them on the deterministic engine. Definition-driven (JSON) editor." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Definition" actions={<Button size="sm" onClick={run} loading={busy} disabled={!def}>Run</Button>}>
          <div className="space-y-2">
            <AsyncState query={templates} empty="No templates.">
              {(data) => (
                <div className="flex flex-wrap gap-1.5">
                  {Object.values(data.templates || {}).map((t) => (
                    <Button key={t.key} size="sm" variant="secondary" onClick={() => loadTemplate(t)}>{t.title || t.key}</Button>
                  ))}
                </div>
              )}
            </AsyncState>
            <Textarea rows={12} value={def} onChange={(e) => setDef(e.target.value)} placeholder="Workflow definition JSON" className="font-mono text-[12px]" />
            <Textarea rows={3} value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="Facts JSON" className="font-mono text-[12px]" />
            {err && <p className="text-[12px] text-[color:var(--score-danger)]">{err.message}</p>}
            {result && <div><Badge variant={statusTone(result.run?.status)}>{result.run?.status}</Badge><JsonView data={result.run} /></div>}
          </div>
        </Panel>
        <Panel title="Recent runs">
          <AsyncState query={runs} empty="No workflow runs yet.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.runs || []).map((r) => (
                  <div key={r.run_id} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                    <span className="text-[12px] text-[color:var(--text-muted)] truncate">{r.workflow_key}</span>
                    <Badge variant={statusTone(r.status)}>{r.status}</Badge>
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
