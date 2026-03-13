import { useState } from "react";
import { useApi } from "../api";
import { CheckCircle, AlertCircle, ExternalLink, Loader2, ChevronRight, Hash, Users, MessageSquare } from "lucide-react";

const STEPS = ["Setup", "Connect", "Preview", "Migrate"];

const REQUIRED_SCOPES = [
  { scope: "channels:read", why: "List public channels" },
  { scope: "channels:history", why: "Read messages from public channels" },
  { scope: "users:read", why: "List workspace members" },
  { scope: "users:read.email", why: "Match users by email address" },
];

export default function SlackMigration() {
  const api = useApi();

  const [step, setStep] = useState(0);
  const [token, setToken] = useState("");
  const [preview, setPreview] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [selectedChannels, setSelectedChannels] = useState(null); // null = all
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateError, setMigrateError] = useState("");

  /* ── Step 2: Validate token ── */
  async function handleValidate() {
    setValidating(true);
    setValidateError("");
    try {
      const res = await api.post("/integrations/slack/validate", { token });
      setPreview(res.data);
      // Default: all channels selected
      setSelectedChannels(res.data.channels.map((c) => c.id));
      setStep(2);
    } catch (err) {
      setValidateError(err.response?.data?.error || err.message);
    } finally {
      setValidating(false);
    }
  }

  /* ── Step 3 → 4: Run migration ── */
  async function handleMigrate() {
    setMigrating(true);
    setMigrateError("");
    try {
      const res = await api.post("/integrations/slack/migrate", {
        token,
        selectedChannelIds: selectedChannels,
      });
      setMigrateResult(res.data);
      setStep(3);
    } catch (err) {
      setMigrateError(err.response?.data?.error || err.message);
    } finally {
      setMigrating(false);
    }
  }

  function toggleChannel(id) {
    setSelectedChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <img
            src="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png"
            alt="Slack"
            className="w-8 h-8"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <h1 className="text-2xl font-bold theme-text">Slack Migration</h1>
        </div>
        <p className="theme-text-muted text-sm">
          Import your Slack users and public channels into this workspace.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full
              ${i === step ? "bg-primary-600 text-white" : i < step ? "bg-success-100 text-success-700" : "bg-gray-100 text-gray-400"}`}>
              {i < step && <CheckCircle size={12} />}
              {label}
            </div>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Setup instructions ── */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="theme-surface border theme-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold theme-text">Step 1 — Create a Slack App</h2>
            <ol className="space-y-3 text-sm theme-text-muted list-none">
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">1</span>
                <span>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="text-primary-600 underline inline-flex items-center gap-1">api.slack.com/apps <ExternalLink size={11} /></a> and click <strong>Create New App → From scratch</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">2</span>
                <span>Give it any name (e.g. <em>Migration Bot</em>) and pick your Slack workspace.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">3</span>
                <span>Go to <strong>OAuth & Permissions → Scopes → Bot Token Scopes</strong> and add these scopes:</span>
              </li>
            </ol>

            {/* Scopes table */}
            <div className="rounded-lg border theme-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b theme-border">
                    <th className="text-left px-3 py-2 font-medium theme-text-muted">Scope</th>
                    <th className="text-left px-3 py-2 font-medium theme-text-muted">Used for</th>
                  </tr>
                </thead>
                <tbody>
                  {REQUIRED_SCOPES.map((s) => (
                    <tr key={s.scope} className="border-b theme-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-primary-600 bg-primary-50/40">{s.scope}</td>
                      <td className="px-3 py-2 theme-text-muted">{s.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ol className="space-y-3 text-sm theme-text-muted list-none" start={4}>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">4</span>
                <span>Click <strong>Install to Workspace</strong> and approve the permissions.</span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">5</span>
                <span>Copy the <strong>Bot User OAuth Token</strong> (starts with <code className="text-xs bg-gray-100 px-1 rounded">xoxb-</code>).</span>
              </li>
            </ol>
          </div>

          <button
            onClick={() => setStep(1)}
            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors"
          >
            I have my token →
          </button>
        </div>
      )}

      {/* ── STEP 1: Paste token ── */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="theme-surface border theme-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold theme-text">Step 2 — Connect your Slack workspace</h2>
            <p className="text-sm theme-text-muted">Paste the Bot User OAuth Token from your Slack app. It should start with <code className="text-xs bg-gray-100 px-1 rounded">xoxb-</code>.</p>

            <div>
              <label className="block text-xs font-medium theme-text mb-1.5">Bot Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="xoxb-..."
                className="w-full border theme-border rounded-lg px-3 py-2.5 text-sm theme-text theme-bg focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              />
            </div>

            {validateError && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>{validateError}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="px-4 py-2.5 border theme-border rounded-lg text-sm theme-text hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              onClick={handleValidate}
              disabled={!token.startsWith("xoxb-") || validating}
              className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {validating ? <><Loader2 size={15} className="animate-spin" /> Connecting…</> : "Connect & Preview →"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview & channel selection ── */}
      {step === 2 && preview && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <Users size={20} className="mx-auto mb-1.5 text-primary-500" />
              <div className="text-2xl font-bold theme-text">{preview.userCount}</div>
              <div className="text-xs theme-text-muted">Users</div>
            </div>
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <Hash size={20} className="mx-auto mb-1.5 text-primary-500" />
              <div className="text-2xl font-bold theme-text">{preview.channelCount}</div>
              <div className="text-xs theme-text-muted">Channels</div>
            </div>
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <MessageSquare size={20} className="mx-auto mb-1.5 text-primary-500" />
              <div className="text-sm font-bold theme-text">All</div>
              <div className="text-xs theme-text-muted">Messages</div>
            </div>
          </div>

          <div className="theme-surface border theme-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm theme-text">Select channels to import</h3>
              <div className="flex gap-2 text-xs">
                <button onClick={() => setSelectedChannels(preview.channels.map((c) => c.id))} className="text-primary-600 hover:underline">All</button>
                <span className="theme-text-muted">·</span>
                <button onClick={() => setSelectedChannels([])} className="text-primary-600 hover:underline">None</button>
              </div>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {preview.channels.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedChannels?.includes(ch.id) ?? true}
                    onChange={() => toggleChannel(ch.id)}
                    className="accent-primary-600"
                  />
                  <Hash size={13} className="text-gray-400 shrink-0" />
                  <span className="text-sm theme-text">{ch.name}</span>
                  {ch.isArchived && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">archived</span>}
                  <span className="ml-auto text-xs theme-text-muted">{ch.memberCount} members</span>
                </label>
              ))}
            </div>
            <p className="text-xs theme-text-muted mt-2">{selectedChannels?.length ?? preview.channels.length} of {preview.channels.length} selected</p>
          </div>

          <div className="theme-surface border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
            <strong>Note:</strong> Users who don't exist in this workspace will be created with a temporary password. They can log in via their email and reset their password.
          </div>

          {migrateError && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{migrateError}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 border theme-border rounded-lg text-sm theme-text hover:bg-gray-50 transition-colors">
              Back
            </button>
            <button
              onClick={handleMigrate}
              disabled={migrating || selectedChannels?.length === 0}
              className="flex-1 py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              {migrating
                ? <><Loader2 size={15} className="animate-spin" /> Migrating… this may take a few minutes</>
                : `Import ${selectedChannels?.length ?? preview.channels.length} channels →`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 3 && migrateResult && (
        <div className="space-y-5">
          <div className="theme-surface border border-success-200 bg-success-50 rounded-xl p-6 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-success-500" />
            <h2 className="text-lg font-bold theme-text mb-1">Migration complete</h2>
            <p className="text-sm theme-text-muted">Your Slack data has been imported into this workspace.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary-600">{migrateResult.usersCreated}</div>
              <div className="text-xs theme-text-muted">Users created</div>
            </div>
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary-600">{migrateResult.usersLinked}</div>
              <div className="text-xs theme-text-muted">Users linked</div>
            </div>
            <div className="theme-surface border theme-border rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-primary-600">{migrateResult.channelsCreated}</div>
              <div className="text-xs theme-text-muted">Channels created</div>
            </div>
          </div>

          <div className="theme-surface border theme-border rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-primary-600">{migrateResult.messagesImported}</div>
            <div className="text-xs theme-text-muted mt-1">Messages imported</div>
          </div>

          {migrateResult.errors?.length > 0 && (
            <div className="theme-surface border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-700 mb-2">{migrateResult.errors.length} warnings</p>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {migrateResult.errors.map((e, i) => (
                  <li key={i} className="text-xs text-amber-600">{e}</li>
                ))}
              </ul>
            </div>
          )}

          <a
            href="/chat"
            className="block w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors text-center"
          >
            Go to Team Chat →
          </a>
        </div>
      )}
    </div>
  );
}
