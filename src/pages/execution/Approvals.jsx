// src/pages/execution/Approvals.jsx
import { useState } from "react";
import { Button, Badge, Input, Select } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, useAsync } from "./_shared";

const ACTIONS = ["approve", "reject", "escalate", "delegate"];

export default function Approvals() {
  const query = useAsync(() => executionApi.approvals(), []);
  const [form, setForm] = useState({ approvalId: "", action: "approve", step: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      await executionApi.approvalAction(form.approvalId, form.action, { step: Number(form.step) || 0 });
      setMsg({ ok: true, text: `Recorded ${form.action}.` });
      query.reload();
    } catch (e) { setMsg({ ok: false, text: execError(e).message }); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Approvals" subtitle="Approval chains (manager / admin / executive / custom) with escalation, delegation and timeouts. Every decision is append-only and audited." actions={<Button size="sm" variant="secondary" onClick={query.reload}>Refresh</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Record an approval decision">
          <div className="space-y-3">
            <Input placeholder="Approval ID" value={form.approvalId} onChange={(e) => setForm({ ...form, approvalId: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
              <Input type="number" placeholder="Step" value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value })} />
            </div>
            <Button size="sm" onClick={submit} loading={busy} disabled={!form.approvalId}>Submit</Button>
            {msg && <p className={`text-[12px] ${msg.ok ? "text-[color:var(--score-good)]" : "text-[color:var(--score-danger)]"}`}>{msg.text}</p>}
          </div>
        </Panel>
        <Panel title="Recent approval activity">
          <AsyncState query={query} empty="No approval activity yet.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.events || []).map((e) => (
                  <div key={e.eventId} className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-3 py-2">
                    <span className="text-[12px] text-[color:var(--text-muted)] truncate">{e.approvalId} · step {e.step}</span>
                    <Badge variant={e.action === "approve" ? "success" : e.action === "reject" ? "danger" : "warning"}>{e.action}</Badge>
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
