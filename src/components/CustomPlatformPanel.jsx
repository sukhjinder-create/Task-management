// src/components/CustomPlatformPanel.jsx
//
// Connect any platform without a code change: enter the API details, test the
// connection against a real record, map that tool's field names onto
// Asystence's, then import.
//
// Deliberately self-contained so the existing Slack/Asana/YouTrack panels are
// untouched by this feature.
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../api";
import {
  Plus, Loader2, CheckCircle, AlertCircle, Trash2, Webhook, Copy,
  ChevronRight, ArrowLeft, Wand2, Clock,
} from "lucide-react";

// The Asystence fields an admin can map an external field onto. `auto` explains
// what we already detect without any mapping, so the admin only fills gaps.
const MAPPABLE_FIELDS = [
  { key: "title",       label: "Title",        required: true,  auto: "name, summary, title, fields.summary" },
  { key: "description", label: "Description",  required: false, auto: "description, notes, body" },
  { key: "status",      label: "Status",       required: false, auto: "status, state.name, fields.status.name" },
  { key: "priority",    label: "Priority",     required: false, auto: "priority, severity, fields.priority.name" },
  { key: "assignee",    label: "Assignee",     required: false, auto: "assignee, assignee.email, owner" },
  { key: "dueDate",     label: "Due date",     required: false, auto: "due_on, dueDate, duedate, deadline" },
  { key: "taskType",    label: "Type",         required: false, auto: "type, issueType, fields.issuetype.name" },
  { key: "storyPoints", label: "Story points", required: false, auto: "story_points, points, estimate" },
  { key: "externalId",  label: "Unique ID",    required: true,  auto: "id, gid, key, idReadable" },
];

const AUTH_TYPES = [
  { value: "bearer", label: "Bearer token",  hint: "Sent as: Authorization: Bearer <token>" },
  { value: "header", label: "Custom header", hint: "For APIs using X-Api-Key or similar" },
  { value: "basic",  label: "Username & password", hint: "HTTP Basic authentication" },
  { value: "query",  label: "URL parameter", hint: "For APIs expecting ?api_key=..." },
  { value: "none",   label: "No authentication", hint: "Only for fully public APIs" },
];

const inputCls =
  "w-full bg-[var(--surface)] border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm theme-text focus:outline-none focus:border-[color:var(--primary)]";
const labelCls = "block text-xs font-semibold theme-text mb-1";
const hintCls = "text-[11px] theme-text-muted mt-1";

function Field({ label, hint, children, required }) {
  return (
    <div>
      <label className={labelCls}>
        {label} {required && <span className="text-[color:var(--score-danger)]">*</span>}
      </label>
      {children}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );
}

export default function CustomPlatformPanel() {
  const api = useApi();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = list view

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/integrations/custom-providers");
      setPlatforms(res.data?.providers || []);
    } catch {
      setPlatforms([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 theme-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading platforms…
      </div>
    );
  }

  if (editing !== null) {
    return (
      <PlatformEditor
        platform={editing}
        onBack={() => { setEditing(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold theme-text">Your platforms</h3>
          <p className="text-xs theme-text-muted mt-0.5">
            Connect any tool with a REST API — no engineering required.
          </p>
        </div>
        <button
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] text-white text-xs font-semibold rounded-lg px-3 py-2 hover:opacity-90"
        >
          <Plus size={14} /> Add platform
        </button>
      </div>

      {!platforms.length ? (
        <div className="border border-dashed theme-border rounded-xl p-8 text-center">
          <Wand2 className="w-6 h-6 mx-auto mb-2 text-[color:var(--primary)]" />
          <p className="text-sm font-medium theme-text">No custom platforms yet</p>
          <p className="text-xs theme-text-muted mt-1 max-w-md mx-auto">
            If your tool isn't listed as a tab above, add it here. You'll need its API
            URL and an API token — Asystence handles the rest.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {platforms.map((platform) => (
            <button
              key={platform.slug}
              onClick={() => setEditing(platform)}
              className="w-full text-left border theme-border rounded-xl px-4 py-3 hover:bg-[var(--surface-soft)] transition-colors flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold theme-text truncate">{platform.name}</span>
                  <StatusPill platform={platform} />
                </div>
                <p className="text-[11px] theme-text-muted truncate mt-0.5">{platform.baseUrl}</p>
              </div>
              <ChevronRight size={16} className="theme-text-muted shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ platform }) {
  const pill = "text-[10px] font-semibold px-1.5 py-0.5 rounded border";
  if (platform.status === "active" && platform.lastTestOk) {
    return <span className={`${pill} border-[color:var(--border)] text-[color:var(--score-good)]`}>Ready</span>;
  }
  if (platform.lastTestOk === false) {
    return <span className={`${pill} border-[color:var(--border)] text-[color:var(--score-danger)]`}>Needs attention</span>;
  }
  return <span className={`${pill} border-[color:var(--border)] theme-text-muted`}>Draft</span>;
}

function PlatformEditor({ platform, onBack }) {
  const api = useApi();
  const isNew = !platform?.slug;

  const [form, setForm] = useState({
    name: platform?.name || "",
    baseUrl: platform?.baseUrl || "",
    authType: platform?.auth?.authType || "bearer",
    authConfig: platform?.auth?.authConfig || {},
    tasksPath: platform?.endpoints?.tasks?.path || "",
    tasksItemsPath: platform?.endpoints?.tasks?.itemsPath || "",
    projectsPath: platform?.endpoints?.projects?.path || "",
    fieldMappings: platform?.fieldMappings || {},
    // GraphQL APIs are a POST to one path with a query body; everything else
    // reads the response the same way via itemsPath.
    apiStyle: platform?.endpoints?.tasks?.method === "POST" ? "graphql" : "rest",
    graphqlQuery:
      typeof platform?.endpoints?.tasks?.body?.query === "string"
        ? platform.endpoints.tasks.body.query
        : "",
  });
  // Whether we issue the secret or the platform signs with its own.
  const [webhookMode, setWebhookMode] = useState("generate");
  const [theirSecret, setTheirSecret] = useState("");
  const [theirHeader, setTheirHeader] = useState("x-hub-signature-256");
  const [slug, setSlug] = useState(platform?.slug || null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [webhook, setWebhook] = useState(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setAuth = (key, value) =>
    setForm((prev) => ({ ...prev, authConfig: { ...prev.authConfig, [key]: value } }));

  const payload = () => ({
    name: form.name,
    baseUrl: form.baseUrl,
    authType: form.authType,
    authConfig: form.authConfig,
    endpoints: {
      tasks: {
        path: form.tasksPath,
        itemsPath: form.tasksItemsPath || undefined,
        ...(form.apiStyle === "graphql"
          ? { method: "POST", body: { query: form.graphqlQuery } }
          : {}),
      },
      ...(form.projectsPath ? { projects: { path: form.projectsPath } } : {}),
    },
    fieldMappings: form.fieldMappings,
  });

  const save = async ({ activate = false } = {}) => {
    setSaving(true); setError("");
    try {
      const body = { ...payload(), ...(activate ? { status: "active" } : {}) };
      const res = slug
        ? await api.put(`/integrations/custom-providers/${slug}`, body)
        : await api.post("/integrations/custom-providers", body);
      const saved = res.data?.provider;
      if (saved?.slug) setSlug(saved.slug);
      return saved?.slug || slug;
    } catch (err) {
      setError(err.response?.data?.error || "Could not save this platform.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Save first so the server tests exactly what's on screen.
  const testConnection = async () => {
    setTesting(true); setTestResult(null); setError("");
    const savedSlug = await save();
    if (!savedSlug) { setTesting(false); return; }
    try {
      const res = await api.post(`/integrations/custom-providers/${savedSlug}/test`, {});
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ ok: false, message: err.response?.data?.error || "Connection test failed." });
    } finally {
      setTesting(false);
    }
  };

  const runImport = async () => {
    setImporting(true); setImportResult(null); setError("");
    const savedSlug = await save({ activate: true });
    if (!savedSlug) { setImporting(false); return; }
    try {
      const res = await api.post(`/integrations/custom-providers/${savedSlug}/migrate`, { mode: "skip" });
      setImportResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const createWebhook = async () => {
    const savedSlug = slug || (await save());
    if (!savedSlug) return;
    try {
      const body = webhookMode === "theirs"
        ? { secret: theirSecret, signatureScheme: "hmac_sha256", signatureHeader: theirHeader }
        : {};
      const res = await api.post(`/integrations/custom-providers/${savedSlug}/webhook`, body);
      setWebhook(res.data?.endpoint || null);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create the webhook endpoint.");
    }
  };

  const remove = async () => {
    if (!slug) return onBack();
    if (!window.confirm(`Remove "${form.name}"? Tasks already imported from it are kept.`)) return;
    try {
      await api.delete(`/integrations/custom-providers/${slug}`);
      onBack();
    } catch (err) {
      setError(err.response?.data?.error || "Could not remove this platform.");
    }
  };

  const authType = AUTH_TYPES.find((a) => a.value === form.authType);
  const canTest = form.name && form.baseUrl && form.tasksPath;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-xs theme-text-muted hover:text-[color:var(--primary)]">
          <ArrowLeft size={14} /> All platforms
        </button>
        {!isNew && (
          <button onClick={remove} className="inline-flex items-center gap-1 text-xs text-[color:var(--score-danger)] hover:underline">
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-[color:var(--border)] rounded-lg px-3 py-2 text-xs text-[color:var(--score-danger)]">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* Step 1 — connection */}
      <section className="border theme-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold theme-text">1. Where is your platform?</h3>
        <Field label="Platform name" required>
          <input className={inputCls} value={form.name} placeholder="e.g. Linear, Monday, Trello"
            onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field
          label="API base URL"
          required
          hint="The root of your tool's API. Must be reachable from the internet — private and internal addresses are rejected for security."
        >
          <input className={inputCls} value={form.baseUrl} placeholder="https://api.yourtool.com"
            onChange={(e) => set("baseUrl", e.target.value)} />
        </Field>

        <Field label="Authentication" hint={authType?.hint}>
          <select className={inputCls} value={form.authType} onChange={(e) => set("authType", e.target.value)}>
            {AUTH_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </Field>

        {form.authType === "bearer" && (
          <Field label="API token" required>
            <input type="password" className={inputCls} value={form.authConfig.token || ""}
              placeholder="Paste your token" onChange={(e) => setAuth("token", e.target.value)} />
          </Field>
        )}
        {form.authType === "header" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Header name" required>
              <input className={inputCls} value={form.authConfig.header || ""} placeholder="X-Api-Key"
                onChange={(e) => setAuth("header", e.target.value)} />
            </Field>
            <Field label="Header value" required>
              <input type="password" className={inputCls} value={form.authConfig.value || ""}
                onChange={(e) => setAuth("value", e.target.value)} />
            </Field>
          </div>
        )}
        {form.authType === "basic" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Username" required>
              <input className={inputCls} value={form.authConfig.username || ""}
                onChange={(e) => setAuth("username", e.target.value)} />
            </Field>
            <Field label="Password" required>
              <input type="password" className={inputCls} value={form.authConfig.password || ""}
                onChange={(e) => setAuth("password", e.target.value)} />
            </Field>
          </div>
        )}
        {form.authType === "query" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Parameter name" required>
              <input className={inputCls} value={form.authConfig.param || ""} placeholder="api_key"
                onChange={(e) => setAuth("param", e.target.value)} />
            </Field>
            <Field label="Parameter value" required>
              <input type="password" className={inputCls} value={form.authConfig.value || ""}
                onChange={(e) => setAuth("value", e.target.value)} />
            </Field>
          </div>
        )}
      </section>

      {/* Step 2 — where the data lives */}
      <section className="border theme-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold theme-text">2. Where are the tasks?</h3>

        <Field label="API type" hint={form.apiStyle === "graphql"
          ? "GraphQL: one endpoint, and the query below decides what comes back."
          : "REST: most tools. Each endpoint is a separate URL path."}>
          <select className={inputCls} value={form.apiStyle} onChange={(e) => set("apiStyle", e.target.value)}>
            <option value="rest">REST (most tools)</option>
            <option value="graphql">GraphQL</option>
          </select>
        </Field>

        {form.apiStyle === "graphql" && (
          <Field
            label="GraphQL query"
            required
            hint="Paste the query that returns your tasks. Use {projectId} to filter by project."
          >
            <textarea
              className={`${inputCls} font-mono text-xs min-h-[110px]`}
              value={form.graphqlQuery}
              placeholder={"{ issues { id title state { name } } }"}
              onChange={(e) => set("graphqlQuery", e.target.value)}
            />
          </Field>
        )}

        <Field label="Tasks endpoint" required hint={form.apiStyle === "graphql"
          ? "Usually just / or /graphql — the single GraphQL endpoint."
          : "Path relative to the base URL. Use {projectId} if it needs a project."}>
          <input className={inputCls} value={form.tasksPath} placeholder="/rest/issues"
            onChange={(e) => set("tasksPath", e.target.value)} />
        </Field>
        <Field
          label="Where the records are in the response"
          hint={form.apiStyle === "graphql"
            ? "Usually data.<something>.nodes — check your query's shape."
            : "Optional. Leave blank unless the list is nested, e.g. results.items."}
        >
          <input className={inputCls} value={form.tasksItemsPath}
            placeholder={form.apiStyle === "graphql" ? "data.issues.nodes" : "leave blank to detect"}
            onChange={(e) => set("tasksItemsPath", e.target.value)} />
        </Field>

        <Field label="Projects endpoint" hint="Optional — lets you import one project at a time.">
          <input className={inputCls} value={form.projectsPath} placeholder="/rest/projects"
            onChange={(e) => set("projectsPath", e.target.value)} />
        </Field>

        <div className="pt-1">
          <button
            onClick={testConnection}
            disabled={!canTest || testing || saving}
            className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] text-white text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50 hover:opacity-90"
          >
            {testing ? <><Loader2 size={14} className="animate-spin" /> Testing…</> : <>Test connection</>}
          </button>
          {!canTest && (
            <p className={hintCls}>Fill in the name, base URL and tasks endpoint first.</p>
          )}
        </div>

        {testResult && (
          <div className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs ${
            testResult.ok ? "border-[color:var(--border)] text-[color:var(--score-good)]"
                          : "border-[color:var(--border)] text-[color:var(--score-danger)]"}`}>
            {testResult.ok ? <CheckCircle size={14} className="mt-0.5 shrink-0" />
                           : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
            <span className="theme-text">{testResult.message}</span>
          </div>
        )}
      </section>

      {/* Step 3 — mapping, only once we have a real sample to map against */}
      {testResult?.ok && testResult.sampleFields?.length > 0 && (
        <section className="border theme-border rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold theme-text">3. Match up the fields</h3>
            <p className={hintCls}>
              Asystence already detected the common ones. Only set a field if it's wrong or missing.
            </p>
          </div>

          <div className="space-y-2">
            {MAPPABLE_FIELDS.map((field) => (
              <div key={field.key} className="grid sm:grid-cols-[140px_1fr] gap-2 sm:items-center">
                <div>
                  <span className="text-xs font-medium theme-text">{field.label}</span>
                  {field.required && <span className="text-[color:var(--score-danger)] text-xs"> *</span>}
                </div>
                <div>
                  <select
                    className={inputCls}
                    value={form.fieldMappings[field.key] || ""}
                    onChange={(e) => set("fieldMappings", {
                      ...form.fieldMappings,
                      ...(e.target.value ? { [field.key]: e.target.value } : { [field.key]: undefined }),
                    })}
                  >
                    <option value="">Detect automatically</option>
                    {testResult.sampleFields.map((sample) => (
                      <option key={sample.path} value={sample.path}>
                        {sample.path} — {sample.preview}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Step 4 — import + real-time */}
      {testResult?.ok && (
        <section className="border theme-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold theme-text">4. Import</h3>
          <button
            onClick={runImport}
            disabled={importing || saving}
            className="inline-flex items-center gap-1.5 bg-[color:var(--primary)] text-white text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50 hover:opacity-90"
          >
            {importing ? <><Loader2 size={14} className="animate-spin" /> Importing…</> : <>Import tasks</>}
          </button>

          {importResult && (
            <div className="border theme-border rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="theme-text font-medium">
                Imported {importResult.importedTasks} task{importResult.importedTasks === 1 ? "" : "s"}
                {importResult.skippedTasks ? ` · skipped ${importResult.skippedTasks} already imported` : ""}
              </p>
              {importResult.unmappedValues?.length > 0 && (
                <p className="theme-text-muted">
                  Couldn't match these values, so a sensible default was used:{" "}
                  <span className="theme-text">{importResult.unmappedValues.join(", ")}</span>
                </p>
              )}
            </div>
          )}

          <div className="pt-2 border-t theme-border">
            <div className="flex items-center gap-1.5 mb-1">
              <Webhook size={13} className="text-[color:var(--primary)]" />
              <span className="text-xs font-semibold theme-text">Keep it up to date</span>
            </div>
            <p className={hintCls}>
              Get changes instantly instead of waiting for the next refresh.
            </p>

            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" className="mt-0.5" checked={webhookMode === "generate"}
                  onChange={() => setWebhookMode("generate")} />
                <span className="text-xs theme-text">
                  <span className="font-medium">Asystence creates the secret</span>
                  <span className="block theme-text-muted text-[11px]">
                    You paste our URL and secret into your tool. Works when the tool lets you set a custom header.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="radio" className="mt-0.5" checked={webhookMode === "theirs"}
                  onChange={() => setWebhookMode("theirs")} />
                <span className="text-xs theme-text">
                  <span className="font-medium">My platform signs with its own secret</span>
                  <span className="block theme-text-muted text-[11px]">
                    For tools like GitHub, Stripe, Shopify or Trello that generate the secret themselves.
                  </span>
                </span>
              </label>
            </div>

            {webhookMode === "theirs" && (
              <div className="mt-2 space-y-2">
                <Field label="Secret from your platform" required
                  hint="Copy it from your tool's webhook settings.">
                  <input type="password" className={inputCls} value={theirSecret}
                    onChange={(e) => setTheirSecret(e.target.value)} />
                </Field>
                <Field label="Signature header your platform sends"
                  hint="GitHub uses x-hub-signature-256; Shopify uses x-shopify-hmac-sha256.">
                  <input className={inputCls} value={theirHeader}
                    onChange={(e) => setTheirHeader(e.target.value)} />
                </Field>
              </div>
            )}

            <button onClick={createWebhook}
              className="mt-2 inline-flex items-center gap-1.5 border theme-border text-xs font-semibold rounded-lg px-3 py-2 hover:bg-[var(--surface-soft)] theme-text">
              <Webhook size={13} /> {webhook ? "Regenerate" : "Generate"} webhook URL
            </button>

            {webhook && (
              <div className="mt-2 space-y-2">
                <CopyRow label="Webhook URL" value={webhook.url} />
                <CopyRow label="Header name" value={webhook.headerName} />
                {webhook.secret ? (
                  <>
                    <CopyRow label="Secret" value={webhook.secret} />
                    <p className="text-[11px] text-[color:var(--score-warning)] flex items-start gap-1">
                      <Clock size={12} className="mt-0.5 shrink-0" />
                      Copy the secret now — for security it isn't shown again.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] theme-text-muted">
                    Saved. Asystence will verify incoming requests using your platform's own secret.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <span className="text-[11px] font-semibold theme-text-muted">{label}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <code className="flex-1 text-[11px] theme-text bg-[var(--surface-soft)] border theme-border rounded px-2 py-1.5 truncate">
          {value}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 border theme-border rounded px-2 py-1.5 hover:bg-[var(--surface-soft)]"
          title="Copy"
        >
          {copied ? <CheckCircle size={13} className="text-[color:var(--score-good)]" /> : <Copy size={13} className="theme-text-muted" />}
        </button>
      </div>
    </div>
  );
}
