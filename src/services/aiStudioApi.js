// src/services/aiStudioApi.js
//
// Epic C — AI Studio API client. REUSES the existing axios instances (no new
// client, no duplication): `superadminApi` (token + refresh already wired) for the
// Superadmin Studio, and the workspace `api` instance for the Workspace Studio.
// Mirrors the backend routes in routes/superadminAiStudio.routes.js and
// routes/aiStudioWorkspace.routes.js.

import superadminApi from "../superadminApi";
import api from "../api";

// ── Superadmin AI Studio ──────────────────────────────────────────────────────
export const superadminAiStudio = {
  overview: () => superadminApi.get("/superadmin/ai-studio/overview").then((r) => r.data),
  providers: () => superadminApi.get("/superadmin/ai-studio/providers").then((r) => r.data),
  models: () => superadminApi.get("/superadmin/ai-studio/models").then((r) => r.data),
  capabilities: () => superadminApi.get("/superadmin/ai-studio/capabilities").then((r) => r.data),
  profiles: () => superadminApi.get("/superadmin/ai-studio/profiles").then((r) => r.data),
  effectiveConfig: (key, { lock = "workspace_customizable" } = {}) =>
    superadminApi
      .get(`/superadmin/ai-studio/capabilities/${encodeURIComponent(key)}/effective`, { params: { lock } })
      .then((r) => r.data),
  permissions: ({ role = "superadmin", lock = "workspace_customizable" } = {}) =>
    superadminApi.get("/superadmin/ai-studio/permissions", { params: { role, lock } }).then((r) => r.data),
};

// ── Workspace AI Studio ───────────────────────────────────────────────────────
export const workspaceAiStudio = {
  overview: () => api.get("/ai-studio/overview").then((r) => r.data),
  capabilities: () => api.get("/ai-studio/capabilities").then((r) => r.data),
  controls: (key, { lock = "workspace_customizable" } = {}) =>
    api.get(`/ai-studio/capabilities/${encodeURIComponent(key)}/controls`, { params: { lock } }).then((r) => r.data),
  previewOverride: (key, { override = {}, lock = "workspace_customizable" } = {}) =>
    api.post(`/ai-studio/capabilities/${encodeURIComponent(key)}/preview-override`, { override, lock }).then((r) => r.data),
};

export default { superadminAiStudio, workspaceAiStudio };
