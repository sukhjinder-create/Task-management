// src/services/ei.api.js
//
// Enterprise Intelligence Studio — the ONE frontend client for the read-only EI surface.
// Uses the shared `api` axios instance (auth + workspace + refresh handled centrally).
// One function per backend endpoint; no mocks. A disabled Studio returns 404 → surfaced
// as a "disabled" state by the pages.

import api from "../api";
const unwrap = (p) => p.then((r) => r.data);
const B = "/intelligence-studio";

export const eiApi = {
  overview: () => unwrap(api.get(`${B}/overview`)),
  evidence: () => unwrap(api.get(`${B}/evidence`)),
  attributions: () => unwrap(api.get(`${B}/attributions`)),
  traces: () => unwrap(api.get(`${B}/traces`)),
  trace: (id) => unwrap(api.get(`${B}/traces/${encodeURIComponent(id)}`)),
  predictions: () => unwrap(api.get(`${B}/predictions`)),
  prediction: (id) => unwrap(api.get(`${B}/predictions/${encodeURIComponent(id)}`)),
  recommendations: () => unwrap(api.get(`${B}/recommendations`)),
  recommendation: (id) => unwrap(api.get(`${B}/recommendations/${encodeURIComponent(id)}`)),
  executive: () => unwrap(api.get(`${B}/executive`)),
  outcomes: () => unwrap(api.get(`${B}/outcomes`)),
  validation: () => unwrap(api.get(`${B}/validation`)),
  effectiveness: () => unwrap(api.get(`${B}/effectiveness`)),
  calibration: () => unwrap(api.get(`${B}/calibration`)),
  learning: () => unwrap(api.get(`${B}/learning`)),
  experiments: () => unwrap(api.get(`${B}/experiments`)),
  memory: () => unwrap(api.get(`${B}/memory`)),
  health: () => unwrap(api.get(`${B}/health`)),
  graph: () => unwrap(api.get(`${B}/graph`)),
  search: (q) => unwrap(api.get(`${B}/search`, { params: { q } })),
};

export function eiError(err) {
  const status = err?.response?.status;
  if (status === 404) return { disabled: true, message: "The Enterprise Intelligence Studio is not enabled for this workspace." };
  if (status === 403) return { forbidden: true, message: err?.response?.data?.error || "Not permitted." };
  return { message: err?.response?.data?.error || err?.message || "Request failed." };
}

export default eiApi;
