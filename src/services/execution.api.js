// src/services/execution.api.js
//
// EWIP V3 — the ONE frontend client for the execution platform. Uses the shared `api`
// axios instance (auth + workspace headers + refresh handled centrally). Every backend
// endpoint under /execution has a function here — no mocks, no fake data. When the
// platform is disabled for the workspace the backend returns 404; callers surface that
// as a "platform disabled" state.

import api from "../api";

const unwrap = (p) => p.then((r) => r.data);

export const executionApi = {
  // Control center + analytics
  controlCenter: () => unwrap(api.get("/execution/control-center")),
  analytics: () => unwrap(api.get("/execution/analytics")),
  actionLog: (type) => unwrap(api.get("/execution/action-log", { params: type ? { type } : {} })),

  // Capabilities
  capabilities: () => unwrap(api.get("/execution/capabilities")),
  executeCapability: (key, input, idempotencyKey) => unwrap(api.post(`/execution/capabilities/${encodeURIComponent(key)}/execute`, { input, idempotencyKey })),

  // Decisions
  decisions: () => unwrap(api.get("/execution/decisions")),
  decision: (id) => unwrap(api.get(`/execution/decisions/${encodeURIComponent(id)}`)),
  createDecision: (recommendation, proposedAction) => unwrap(api.post("/execution/decisions", { recommendation, proposedAction })),
  runDecision: (id, approvalPolicy) => unwrap(api.post(`/execution/decisions/${encodeURIComponent(id)}/run`, { approvalPolicy })),

  // Approvals
  approvals: () => unwrap(api.get("/execution/approvals")),
  approvalAction: (approvalId, action, body) => unwrap(api.post(`/execution/approvals/${encodeURIComponent(approvalId)}/${action}`, body || {})),

  // Workflows
  workflowTemplates: () => unwrap(api.get("/execution/workflows/templates")),
  workflowRuns: () => unwrap(api.get("/execution/workflows/runs")),
  runWorkflow: (payload) => unwrap(api.post("/execution/workflows/run", payload)),

  // Policies
  policies: () => unwrap(api.get("/execution/policies")),
  createPolicy: (policy) => unwrap(api.post("/execution/policies", policy)),
  evaluatePolicies: (facts) => unwrap(api.post("/execution/policies/evaluate", { facts })),

  // Automations
  automations: () => unwrap(api.get("/execution/automations")),
  createAutomation: (automation) => unwrap(api.post("/execution/automations", automation)),
  fireAutomation: (signal) => unwrap(api.post("/execution/automations/fire", { signal })),
};

/** Normalize an axios error into a small shape the pages can render. */
export function execError(err) {
  const status = err?.response?.status;
  if (status === 404) return { disabled: true, message: "The execution platform is not enabled for this workspace." };
  if (status === 403) return { forbidden: true, message: err?.response?.data?.error || "Not permitted." };
  return { message: err?.response?.data?.error || err?.message || "Request failed." };
}

export default executionApi;
