// src/pages/execution/PolicyStudio.jsx
import { useState } from "react";
import { Button, Badge, Input, Select } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";

const OPS = ["gt", "gte", "lt", "lte", "eq", "ne"];

export default function PolicyStudio() {
  const query = useAsync(() => executionApi.policies(), []);
  const [form, setForm] = useState({ key: "", field: "risk", op: "gt", value: "80", action: "work.risk.escalate" });
  const [facts, setFacts] = useState("{\n  \"risk\": 90\n}");
  const [evalResult, setEvalResult] = useState(null);
  const [msg, setMsg] = useState(null);

  const create = async () => {
    setMsg(null);
    try {
      await executionApi.createPolicy({ key: form.key, when: { field: form.field, op: form.op, value: Number(form.value) }, then: { action: form.action } });
      setMsg({ ok: true, text: "Policy created." }); query.reload();
    } catch (e) { setMsg({ ok: false, text: execError(e).message }); }
  };
  const evaluate = async () => {
    setMsg(null);
    try { setEvalResult(await executionApi.evaluatePolicies(JSON.parse(facts || "{}"))); }
    catch (e) { setMsg({ ok: false, text: e instanceof SyntaxError ? "Facts are not valid JSON." : execError(e).message }); }
  };

  return (
    <div>
      <PageHeader title="Policy Studio" subtitle="Configurable IF/THEN rules (e.g. IF risk > 80 THEN escalate). Versioned, audited, workspace-overridable, honoring the AI Studio lock hierarchy." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Create policy">
          <div className="space-y-3">
            <Input placeholder="Policy key (e.g. delivery_risk)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="Field" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} />
              <Select value={form.op} onChange={(e) => setForm({ ...form, op: e.target.value })}>{OPS.map((o) => <option key={o}>{o}</option>)}</Select>
              <Input placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <Input placeholder="Then action (capability key)" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
            <Button size="sm" onClick={create} disabled={!form.key}>Create</Button>

            <div className="pt-3 border-t border-[color:var(--border)]">
              <p className="text-[12px] font-medium text-[color:var(--text)] mb-1.5">Evaluate against facts</p>
              <textarea rows={3} value={facts} onChange={(e) => setFacts(e.target.value)} className="w-full rounded-[8px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-2 font-mono text-[12px]" />
              <Button size="sm" variant="secondary" className="mt-2" onClick={evaluate}>Evaluate</Button>
              {evalResult && <JsonView data={evalResult} />}
            </div>
            {msg && <p className={`text-[12px] ${msg.ok ? "text-[color:var(--score-good)]" : "text-[color:var(--score-danger)]"}`}>{msg.text}</p>}
          </div>
        </Panel>
        <Panel title="Policies">
          <AsyncState query={query} empty="No policies defined.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.policies || []).map((p) => (
                  <div key={p.policy_id} className="rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)]">{p.key}</span>
                      <Badge variant="neutral">{p.lock_level}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">v{p.version} · {p.enabled ? "enabled" : "disabled"}</div>
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
