// src/pages/execution/CapabilityStudio.jsx
import { useState } from "react";
import { Button, Badge, Input, Textarea } from "../../components/ui";
import { executionApi, execError } from "../../services/execution.api";
import { PageHeader, Panel, AsyncState, JsonView, useAsync } from "./_shared";

export default function CapabilityStudio() {
  const query = useAsync(() => executionApi.capabilities(), []);
  const [selected, setSelected] = useState(null);
  const [inputText, setInputText] = useState("{\n  \n}");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const input = JSON.parse(inputText || "{}");
      setResult(await executionApi.executeCapability(selected.key, input, `ui-${Date.now()}`));
    } catch (e) {
      setErr(e instanceof SyntaxError ? { message: "Input is not valid JSON." } : execError(e));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Capability Studio" subtitle="Every executable action is a versioned capability. Runs are a safe dry-run unless the side-effects gate is enabled for the workspace." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Registry">
          <AsyncState query={query} empty="No capabilities registered.">
            {(data) => (
              <div className="space-y-1.5">
                {(data.capabilities || []).map((c) => (
                  <button key={c.key} onClick={() => { setSelected(c); setResult(null); setErr(null); }}
                    className={`w-full text-left rounded-[8px] border px-3 py-2.5 transition-colors ${selected?.key === c.key ? "border-[color:var(--primary)] bg-[var(--primary-soft)]" : "border-[color:var(--border)] hover:bg-[var(--surface-soft)]"}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-medium text-[color:var(--text)]">{c.title}</span>
                      <Badge variant="neutral">v{c.version}</Badge>
                    </div>
                    <div className="text-[11px] text-[color:var(--text-soft)] mt-0.5">{c.key} · needs {c.permission} · {c.sideEffect ? "side-effect" : "read-only"}</div>
                  </button>
                ))}
              </div>
            )}
          </AsyncState>
        </Panel>

        <Panel title={selected ? `Execute — ${selected.title}` : "Execute"}>
          {!selected ? (
            <p className="text-[13px] text-[color:var(--text-soft)]">Select a capability to run it.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-[11px] text-[color:var(--text-soft)]">Inputs (JSON): {Object.keys(selected.inputs || {}).join(", ") || "none"}</div>
              <Textarea rows={6} value={inputText} onChange={(e) => setInputText(e.target.value)} className="font-mono text-[12px]" />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={run} loading={busy}>Run</Button>
                <span className="text-[11px] text-[color:var(--text-soft)]">Dry-run unless side-effects enabled</span>
              </div>
              {err && <p className="text-[12px] text-[color:var(--score-danger)]">{err.message}</p>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.execution?.status === "executed" ? "success" : result.execution?.status === "simulated" ? "neutral" : "danger"}>{result.execution?.status}</Badge>
                    <Badge variant={result.verification?.verified ? "success" : "danger"}>{result.verification?.verified ? "verified" : "unverified"}</Badge>
                  </div>
                  <JsonView data={result} />
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
