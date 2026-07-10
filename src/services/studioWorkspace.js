// src/services/studioWorkspace.js
// The workspace a superadmin is currently inspecting in the Execution Platform /
// Enterprise Intelligence Studio (these are super-admin owned; they view one workspace
// at a time). Persisted locally; the exec/ei API clients send it as ?workspaceId=.
import superadminApi from "../superadminApi";

const KEY = "studioWorkspaceId";
export function getStudioWorkspaceId() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function setStudioWorkspaceId(id) { try { localStorage.setItem(KEY, id || ""); } catch { /* storage unavailable */ } }

/** Superadmin workspaces (id + human name) for the picker dropdown. */
export async function listWorkspacesForPicker() {
  const { data } = await superadminApi.get("/superadmin/workspaces");
  return (Array.isArray(data) ? data : data?.workspaces || []).map((w) => ({
    id: w.id || w.workspace_id || w.workspaceId,
    name: w.name || w.workspace_name || w.company_name || w.slug || w.title || w.id || w.workspace_id,
  })).filter((w) => w.id);
}

/** Per-workspace enablement of the Execution Platform / Enterprise Intelligence. */
export async function getPlatformFeatures(workspaceId) {
  const { data } = await superadminApi.get("/superadmin/platform-features", { params: { workspaceId } });
  return data || {};
}
export async function setPlatformFeature(feature, workspaceId, enabled) {
  const { data } = await superadminApi.post(`/superadmin/platform-features/${feature}`, { workspaceId, enabled });
  return data;
}

/** EI pipeline runtime health (orchestrator run metrics). */
export async function getOrchestratorStatus() {
  const { data } = await superadminApi.get("/superadmin/platform-features/orchestrator/status");
  return data;
}
