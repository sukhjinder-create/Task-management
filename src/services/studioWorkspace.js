// src/services/studioWorkspace.js
// The workspace a superadmin is currently inspecting in the Execution Platform /
// Enterprise Intelligence Studio (these are super-admin owned; they view one workspace
// at a time). Persisted locally; the exec/ei API clients send it as ?workspaceId=.
const KEY = "studioWorkspaceId";
export function getStudioWorkspaceId() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } }
export function setStudioWorkspaceId(id) { try { localStorage.setItem(KEY, id || ""); } catch { /* storage unavailable */ } }
