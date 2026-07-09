// src/pages/execution/AutomationStudio.jsx
import { useState } from "react";
import { Button, Badge, Input, Select } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, JsonView, AsyncState, useAsync } from "./_shared";

const TRIGGERS = ["event", "schedule", "webhook", "manual", "conditional", "recurring"];

export default function AutomationStudio() {
  const query = useAsync(() => executionApi.automations(), []);
  const [form, setForm] = useState({ key: "", triggerType: "event", event: "task.slipped", kind: "capability", ref: "work.risk.escalate" });
  const [fired, setFired] = useState(null);
  const [msg, setMsg] = useState(null);

  const create = async () => {
    setMsg(null);
    try {
      await executionApi.createAutomation({ key: form.key, trigger: { type: form.triggerType, event: form.event }, action: { kind: form.kind, ref: form.ref } });
      setMsg({ ok: true, text: "Automation created." }); query.reload();
    } catch (e) { setMsg({ ok: false, text: execError(e).message }); }
  };
  const fire = async () => {
    setMsg(null);
    try { setFired(await executionApi.fireAutomation({ type: form.triggerType, event: form.event })); }
    catch (e) { setMsg({ ok: false, text: execError(e).message }); }
  };

  return (
    <div>
      <PageHeader title="Automation Studio" subtitle="Bind triggers (event / schedule / webhook / manual / conditional / recurring) to capabilities or workflows. Deterministic matching, fully auditable." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Create automation">
          <div className="space-y-3">
            <Input placeholder="Automation key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value })}>{TRIGGERS.map((t) => <option key={t}>{t}</option>)}</Select>
              <Input placeholder="Event / key" value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="capability">capability</option><option value="workflow">workflow</option></Select>
              <Input placeholder="Action ref" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={create} disabled={!form.key}>Create</Button>
              <Button size="sm" variant="secondary" onClick={fire}>Test fire</Button>
            </div>
            {fired && <JsonView data={fired} />}
            {msg && <p className={`text-[12px] ${msg.ok ? "text-[color:var(--score-good)]" : "text-[color:var(--score-danger)]"}`}>{msg.text}</p>}
          </div>
        </Panel>
        <Panel title="Automations">
          <AsyncState query={query} empty="No automations yet.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.automations || []).map((a) => (
                  <div key={a.automation_id} className="rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[12.5px] font-medium text-[color:var(--text)]">{a.key}</span>
                      <Badge variant={a.enabled ? "success" : "neutral"}>{a.enabled ? "on" : "off"}</Badge>
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
