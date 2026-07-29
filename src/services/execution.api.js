// src/services/execution.api.js
//
// EWIP V3 — client for the (super-admin owned) execution platform. Uses the superadmin
// axios instance and hits /superadmin/execution/*, sending the inspected workspace as
// ?workspaceId=. No mocks. A disabled platform (404) surfaces a "disabled" state.

import superadminApi from "../superadminApi";
import { getStudioWorkspaceId } from "./studioWorkspace";

const B = "/superadmin/execution";
function ws() { const w = getStudioWorkspaceId(); if (!w) { const e = new Error("no_workspace"); e.needsWorkspace = true; throw e; } return w; }
const wsParams = (extra) => ({ params: { workspaceId: ws(), ...(extra || {}) } });
const g = (p, extra) => superadminApi.get(`${B}${p}`, wsParams(extra)).then((r) => r.data);
const p = (path, body, extra) => superadminApi.post(`${B}${path}`, body, wsParams(extra)).then((r) => r.data);

export const executionApi = {
  controlCenter: () => g("/control-center"),
  analytics: () => g("/analytics"),
  actionLog: (type) => g("/action-log", type ? { type } : undefined),

  capabilities: () => g("/capabilities"),
  executeCapability: (key, input, idempotencyKey) => p(`/capabilities/${encodeURIComponent(key)}/execute`, { input, idempotencyKey }),

  decisions: () => g("/decisions"),
  decision: (id) => g(`/decisions/${encodeURIComponent(id)}`),
  createDecision: (recommendation, proposedAction) => p("/decisions", { recommendation, proposedAction }),
  runDecision: (id, approvalPolicy) => p(`/decisions/${encodeURIComponent(id)}/run`, { approvalPolicy }),

  approvals: () => g("/approvals"),
  approvalAction: (approvalId, action, body) => p(`/approvals/${encodeURIComponent(approvalId)}/${action}`, body || {}),

  workflowTemplates: () => g("/workflows/templates"),
  workflowRuns: () => g("/workflows/runs"),
  runWorkflow: (payload) => p("/workflows/run", payload),

  policies: () => g("/policies"),
  createPolicy: (policy) => p("/policies", policy),
  evaluatePolicies: (facts) => p("/policies/evaluate", { facts }),

  automations: () => g("/automations"),
  createAutomation: (automation) => p("/automations", automation),
  fireAutomation: (signal) => p("/automations/fire", { signal }),
};

export function execError(err) {
  if (err?.needsWorkspace) return { disabled: true, message: "Select a workspace above to load its execution data." };
  const status = err?.response?.status;
  if (status === 404) return { disabled: true, message: "The execution platform is not enabled for this workspace." };
  if (status === 403) return { forbidden: true, message: err?.response?.data?.error || "Not permitted." };
  return { message: err?.response?.data?.error || err?.message || "Request failed." };
}

export default executionApi;
