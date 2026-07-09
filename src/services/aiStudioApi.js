// src/services/aiStudioApi.js
//
// Epic C — AI Studio API client. REUSES the existing axios instances (no new
// client, no duplication): `superadminApi` (token + refresh already wired) for the
// Superadmin Studio, and the workspace `api` instance for the Workspace Studio.
// Mirrors the backend routes in routes/superadminAiStudio.routes.js and
// routes/aiStudioWorkspace.routes.js.

import superadminApi from "../superadminApi";
import api from "../api";

const sg = (p, params) => superadminApi.get(`/superadmin/ai-studio${p}`, params ? { params } : undefined).then((r) => r.data);
const sp = (p, body) => superadminApi.post(`/superadmin/ai-studio${p}`, body).then((r) => r.data);

// ── Superadmin AI Studio ──────────────────────────────────────────────────────
export const superadminAiStudio = {
  overview: () => sg("/overview"),
  providers: () => sg("/providers"),
  models: () => sg("/models"),
  capabilities: () => sg("/capabilities"),
  profiles: () => sg("/profiles"),
  prompts: () => sg("/prompts"),
  effectiveConfig: (key, { lock = "workspace_customizable" } = {}) => sg(`/capabilities/${encodeURIComponent(key)}/effective`, { lock }),
  permissions: ({ role = "superadmin", lock = "workspace_customizable" } = {}) => sg("/permissions", { role, lock }),
  // Saved selections (what the superadmin has chosen — overrides the hardcoded defaults).
  savedConfigs: ({ scope = "PLATFORM", workspaceId = null } = {}) => sg("/capability-config", { scope, ...(workspaceId ? { workspaceId } : {}) }),
  // Write platform default for a capability/feature (provider/model/prompt/profile).
  saveCapabilityConfig: (body) => sp("/capability-config", body),
  // Lock a capability platform-wide (global_locked = no workspace may override).
  setLock: (key, lockLevel) => sp(`/capability-config/${encodeURIComponent(key)}/lock`, { lockLevel }),
  // Manage a SPECIFIC workspace's config + lock from the superadmin side.
  saveWorkspaceConfig: (wsId, body) => sp(`/workspaces/${encodeURIComponent(wsId)}/capability-config`, body),
  setWorkspaceLock: (wsId, key, lockLevel) => sp(`/workspaces/${encodeURIComponent(wsId)}/capability-config/${encodeURIComponent(key)}/lock`, { lockLevel }),
};

// ── Workspace AI Studio ───────────────────────────────────────────────────────
export const workspaceAiStudio = {
  overview: () => api.get("/ai-studio/overview").then((r) => r.data),
  capabilities: () => api.get("/ai-studio/capabilities").then((r) => r.data),
  controls: (key, { lock = "workspace_customizable" } = {}) =>
    api.get(`/ai-studio/capabilities/${encodeURIComponent(key)}/controls`, { params: { lock } }).then((r) => r.data),
  previewOverride: (key, { override = {}, lock = "workspace_customizable" } = {}) =>
    api.post(`/ai-studio/capabilities/${encodeURIComponent(key)}/preview-override`, { override, lock }).then((r) => r.data),
  saveOverride: (key, override) => api.put(`/ai-studio/capabilities/${encodeURIComponent(key)}/override`, { override }).then((r) => r.data),
  playground: (capability, prompt) => api.post("/ai-studio/playground", { capability, prompt }).then((r) => r.data),
  usage: ({ period = "month" } = {}) => api.get("/ai-studio/usage", { params: { period } }).then((r) => r.data),
  providers: () => api.get("/ai-studio/providers").then((r) => r.data),
  models: () => api.get("/ai-studio/models").then((r) => r.data),
  profiles: () => api.get("/ai-studio/profiles").then((r) => r.data),
  prompts: () => api.get("/ai-studio/prompts").then((r) => r.data),
};

export default { superadminAiStudio, workspaceAiStudio };
