import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import toast from "react-hot-toast";

/**
 * 🤖 AI AUTOPILOT MODE
 *
 * Approval queue for AI-generated actions
 * Allows managers/admins to review and approve/reject autopilot suggestions
 */

export default function Autopilot() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [actions, setActions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState("pending"); // pending | settings | history

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, actionsRes, statsRes] = await Promise.all([
        api.get("/autopilot/settings"),
        api.get("/autopilot/actions"),
        api.get("/autopilot/stats"),
      ]);

      setSettings(settingsRes.data.settings);
      setActions(actionsRes.data.actions || []);
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error("Failed to fetch autopilot data:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAutopilot = async (enabled) => {
    try {
      const res = await api.post("/autopilot/settings", {
        enabled,
        mode: settings?.mode || "assisted",
        autoAssign: settings?.auto_assign ?? true,
        autoDeadlineAdjust: settings?.auto_deadline_adjust ?? true,
        autoEscalateBlockers: settings?.auto_escalate_blockers ?? true,
        autoGenerateStandup: settings?.auto_generate_standup ?? true,
        maxTasksPerUser: settings?.max_tasks_per_user || 10,
        blockerThresholdHours: settings?.blocker_threshold_hours || 48,
        velocityDropThreshold: settings?.velocity_drop_threshold || 0.20,
        requireApproval: settings?.require_approval ?? true,
        autoApproveAfterHours: settings?.auto_approve_after_hours || 24,
      });

      setSettings(res.data.settings);
      toast.success(res.data.message);
    } catch (err) {
      toast.error("Failed to update settings");
      console.error(err);
    }
  };

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const res = await api.post("/autopilot/run");
      toast.success(res.data.message);
      await fetchData();
    } catch (err) {
      toast.error("Failed to run analysis");
      console.error(err);
    } finally {
      setRunningAnalysis(false);
    }
  };

  const approveAction = async (actionId) => {
    try {
      const res = await api.post(`/autopilot/actions/${actionId}/approve`);
      toast.success(res.data.message);
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to approve action");
      console.error(err);
    }
  };

  const rejectAction = async (actionId, reason = null) => {
    try {
      await api.post(`/autopilot/actions/${actionId}/reject`, { reason });
      toast.success("Action rejected");
      await fetchData();
    } catch (err) {
      toast.error("Failed to reject action");
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Autopilot</h1>
              <p className="text-gray-600">Autonomous task management powered by AI</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              settings?.enabled
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}>
              {settings?.enabled ? "● Active" : "○ Disabled"}
            </div>
            <button
              onClick={() => toggleAutopilot(!settings?.enabled)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                settings?.enabled
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {settings?.enabled ? "Disable Autopilot" : "Enable Autopilot"}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-5 gap-4">
            <StatCard
              label="Pending"
              value={stats.pending}
              icon="⏳"
              color="yellow"
            />
            <StatCard
              label="Executed"
              value={stats.executed}
              icon="✅"
              color="green"
            />
            <StatCard
              label="Rejected"
              value={stats.rejected}
              icon="❌"
              color="red"
            />
            <StatCard
              label="Auto-Approved"
              value={stats.autoApproved}
              icon="⚡"
              color="purple"
            />
            <StatCard
              label="Confidence"
              value={`${Math.round(stats.avgConfidence * 100)}%`}
              icon="🎯"
              color="blue"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-2 px-4 font-semibold transition ${
              activeTab === "pending"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Pending Actions ({actions.length})
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`pb-2 px-4 font-semibold transition ${
              activeTab === "settings"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "pending" && (
        <div>
          {/* Run Analysis Button */}
          <div className="mb-6 flex justify-end">
            <button
              onClick={runAnalysis}
              disabled={runningAnalysis || !settings?.enabled}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {runningAnalysis ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Running...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Run Analysis Now
                </>
              )}
            </button>
          </div>

          {/* Actions List */}
          {actions.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <span className="text-6xl mb-4 block">🎉</span>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No pending actions
              </h3>
              <p className="text-gray-600">
                {settings?.enabled
                  ? "Autopilot is monitoring your workspace. New actions will appear here."
                  : "Enable autopilot to start receiving intelligent suggestions."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  onApprove={() => approveAction(action.id)}
                  onReject={() => rejectAction(action.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "settings" && (
        <SettingsPanel settings={settings} onSave={setSettings} />
      )}
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ label, value, icon, color }) {
  const colorClasses = {
    yellow: "bg-yellow-50 text-yellow-700",
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    purple: "bg-purple-50 text-purple-700",
    blue: "bg-blue-50 text-blue-700",
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
  );
}

function ActionCard({ action, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);

  const actionIcons = {
    reassign: "👤",
    adjust_deadline: "📅",
    escalate: "🚨",
    create_standup: "📝",
  };

  const actionLabels = {
    reassign: "Auto-Assignment",
    adjust_deadline: "Deadline Adjustment",
    escalate: "Escalation",
    create_standup: "Standup Summary",
  };

  const confidenceColor = (score) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">{actionIcons[action.action_type]}</span>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {actionLabels[action.action_type]}
              </h3>
              {action.task_title && (
                <p className="text-sm text-gray-600">Task: {action.task_title}</p>
              )}
            </div>
            <div className={`ml-auto text-sm font-semibold ${confidenceColor(action.confidence_score)}`}>
              {Math.round(action.confidence_score * 100)}% confidence
            </div>
          </div>

          <p className="text-gray-700 mb-4">{action.reason}</p>

          {/* Expandable Details */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-700 text-sm font-semibold mb-2"
          >
            {expanded ? "▼ Hide" : "▶ Show"} Details
          </button>

          {expanded && (
            <div className="mt-4 grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Current State</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(action.current_state, null, 2)}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Proposed Changes</h4>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                  {JSON.stringify(action.proposed_changes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onApprove}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
        >
          ✓ Approve & Execute
        </button>
        <button
          onClick={onReject}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave }) {
  const [localSettings, setLocalSettings] = useState(settings || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post("/autopilot/settings", {
        enabled: localSettings.enabled,
        mode: localSettings.mode,
        autoAssign: localSettings.auto_assign,
        autoDeadlineAdjust: localSettings.auto_deadline_adjust,
        autoEscalateBlockers: localSettings.auto_escalate_blockers,
        autoGenerateStandup: localSettings.auto_generate_standup,
        maxTasksPerUser: parseInt(localSettings.max_tasks_per_user) || 10,
        blockerThresholdHours: parseInt(localSettings.blocker_threshold_hours) || 48,
        velocityDropThreshold: parseFloat(localSettings.velocity_drop_threshold) || 0.20,
        requireApproval: localSettings.require_approval,
        autoApproveAfterHours: parseInt(localSettings.auto_approve_after_hours) || 24,
      });

      onSave(res.data.settings);
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Autopilot Configuration</h2>

      <div className="space-y-6">
        {/* Mode */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Operation Mode
          </label>
          <select
            value={localSettings.mode || "assisted"}
            onChange={(e) => setLocalSettings({ ...localSettings, mode: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="monitoring">Monitoring Only (No actions)</option>
            <option value="assisted">Assisted (Require approval)</option>
            <option value="autonomous">Autonomous (Auto-execute)</option>
          </select>
        </div>

        {/* Features */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Enabled Features</h3>
          <div className="space-y-2">
            <ToggleOption
              label="Auto-assign unassigned tasks"
              checked={localSettings.auto_assign ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_assign: checked })}
            />
            <ToggleOption
              label="Auto-adjust deadlines based on velocity"
              checked={localSettings.auto_deadline_adjust ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_deadline_adjust: checked })}
            />
            <ToggleOption
              label="Auto-escalate blocked tasks"
              checked={localSettings.auto_escalate_blockers ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_escalate_blockers: checked })}
            />
            <ToggleOption
              label="Auto-generate daily standup"
              checked={localSettings.auto_generate_standup ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, auto_generate_standup: checked })}
            />
          </div>
        </div>

        {/* Thresholds */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Thresholds</h3>
          <div className="space-y-3">
            <InputField
              label="Max tasks per user"
              type="number"
              value={localSettings.max_tasks_per_user || 10}
              onChange={(value) => setLocalSettings({ ...localSettings, max_tasks_per_user: value })}
            />
            <InputField
              label="Blocker threshold (hours)"
              type="number"
              value={localSettings.blocker_threshold_hours || 48}
              onChange={(value) => setLocalSettings({ ...localSettings, blocker_threshold_hours: value })}
            />
          </div>
        </div>

        {/* Approval Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Approval Settings</h3>
          <div className="space-y-3">
            <ToggleOption
              label="Require approval for actions"
              checked={localSettings.require_approval ?? true}
              onChange={(checked) => setLocalSettings({ ...localSettings, require_approval: checked })}
            />
            {localSettings.require_approval && (
              <InputField
                label="Auto-approve after (hours)"
                type="number"
                value={localSettings.auto_approve_after_hours || 24}
                onChange={(value) => setLocalSettings({ ...localSettings, auto_approve_after_hours: value })}
              />
            )}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

function ToggleOption({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function InputField({ label, type, value, onChange }) {
  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
