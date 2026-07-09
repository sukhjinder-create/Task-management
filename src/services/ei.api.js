// src/services/ei.api.js
//
// Enterprise Intelligence Studio — client for the (super-admin owned) read-only EI
// surface. Uses the superadmin axios instance and hits /superadmin/intelligence-studio/*,
// sending the inspected workspace as ?workspaceId=. No mocks; a disabled Studio (404)
// surfaces a "disabled" state.

import superadminApi from "../superadminApi";
import { getStudioWorkspaceId } from "./studioWorkspace";

const B = "/superadmin/intelligence-studio";
function ws() { const w = getStudioWorkspaceId(); if (!w) { const e = new Error("no_workspace"); e.needsWorkspace = true; throw e; } return w; }
const wsParams = (extra) => ({ params: { workspaceId: ws(), ...(extra || {}) } });
const g = (p, extra) => superadminApi.get(`${B}${p}`, wsParams(extra)).then((r) => r.data);

export const eiApi = {
  overview: () => g("/overview"),
  evidence: () => g("/evidence"),
  attributions: () => g("/attributions"),
  traces: () => g("/traces"),
  trace: (id) => g(`/traces/${encodeURIComponent(id)}`),
  predictions: () => g("/predictions"),
  prediction: (id) => g(`/predictions/${encodeURIComponent(id)}`),
  recommendations: () => g("/recommendations"),
  recommendation: (id) => g(`/recommendations/${encodeURIComponent(id)}`),
  executive: () => g("/executive"),
  outcomes: () => g("/outcomes"),
  validation: () => g("/validation"),
  effectiveness: () => g("/effectiveness"),
  calibration: () => g("/calibration"),
  learning: () => g("/learning"),
  experiments: () => g("/experiments"),
  memory: () => g("/memory"),
  health: () => g("/health"),
  graph: () => g("/graph"),
  search: (q) => g("/search", { q }),
};

export function eiError(err) {
  if (err?.needsWorkspace) return { disabled: true, message: "Select a workspace above to load its intelligence." };
  const status = err?.response?.status;
  if (status === 404) return { disabled: true, message: "The Enterprise Intelligence Studio is not enabled for this workspace." };
  if (status === 403) return { forbidden: true, message: err?.response?.data?.error || "Not permitted." };
  return { message: err?.response?.data?.error || err?.message || "Request failed." };
}

export default eiApi;
