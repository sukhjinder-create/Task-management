import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Beaker, Play, RefreshCw, Save, Search, Settings, FileCode2,
  ChevronDown, ChevronRight, Terminal, CheckCircle2, XCircle,
  AlertTriangle, Clock, GitBranch, Layers, Cpu, Globe, Camera,
  SkipForward, Wand2, Zap, TrendingUp, Eye, Info, Sparkles,
  Shield, Activity, Maximize2, Minimize2, X as XIcon, Monitor,
  Download, Square, FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Helpers
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function formatDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}
function formatMs(ms) {
  if (!ms) return "-";
  const n = Number(ms);
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`;
}

async function downloadRunReportPdf(runId) {
  const res = await api.get(`/testing-agent/runs/${runId}/report.pdf`, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `testing-agent-report-${runId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

const STATUS_META = {
  passed:         { label: "Passed",       bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200",  Icon: CheckCircle2 },
  failed:         { label: "Failed",       bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    Icon: XCircle },
  failed_tests:   { label: "Issues Found", bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200",    Icon: XCircle },
  cancelled:      { label: "Stopped",      bg: "bg-slate-100",  text: "text-slate-700",  border: "border-slate-200",  Icon: Square },
  cancel_requested: { label: "Stopping",  bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", Icon: Clock },
  partial:        { label: "Partial",      bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  Icon: AlertTriangle },
  blocked:        { label: "Blocked",      bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  Icon: AlertTriangle },
  waiting_input:  { label: "Needs Login",  bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  Icon: AlertTriangle },
  running:        { label: "Running",      bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200",   Icon: Clock },
  generated:      { label: "Generated",    bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", Icon: Layers },
  pending:        { label: "Pending",      bg: "bg-gray-100",   text: "text-gray-600",   border: "border-gray-200",   Icon: Clock },
  skipped:        { label: "Skipped",      bg: "bg-gray-100",   text: "text-gray-400",   border: "border-gray-200",   Icon: SkipForward },
  unknown:        { label: "Unknown",      bg: "bg-gray-100",   text: "text-gray-500",   border: "border-gray-200",   Icon: Clock },
};

function StatusBadge({ value, large = false }) {
  const s = STATUS_META[String(value || "").toLowerCase()] || STATUS_META.pending;
  const Icon = s.Icon;
  const size = large ? "px-3 py-1.5 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${s.bg} ${s.text} ${size}`}>
      <Icon className={large ? "w-4 h-4" : "w-3 h-3"} />
      {s.label}
    </span>
  );
}

const LEVEL_COLORS = {
  basic: "bg-gray-100 text-gray-600", functional: "bg-blue-100 text-blue-700",
  integration: "bg-indigo-100 text-indigo-700", ui: "bg-pink-100 text-pink-700",
  edge: "bg-orange-100 text-orange-700", regression: "bg-yellow-100 text-yellow-700",
  security: "bg-red-100 text-red-700", performance: "bg-teal-100 text-teal-700",
};
function LevelBadge({ level }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LEVEL_COLORS[level] || "bg-gray-100 text-gray-600"}`}>{level}</span>;
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium theme-text">{label}</div>
        {description && <div className="text-xs theme-text-muted mt-0.5">{description}</div>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "theme-primary" : "theme-surface-soft"}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full theme-surface shadow ring-0 transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Performance chips
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function PerfChips({ metrics }) {
  if (!metrics) return null;
  const { loadComplete, firstByte, resourceCount } = metrics;
  const loadColor = !loadComplete ? "text-gray-400" : loadComplete > 3000 ? "text-red-600 font-semibold" : loadComplete > 1500 ? "text-amber-600" : "text-green-600";
  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {loadComplete != null && <span className={`inline-flex items-center gap-1 text-xs ${loadColor} bg-gray-50 border border-gray-200 rounded px-2 py-0.5`}><Activity className="w-3 h-3" />Load {formatMs(loadComplete)}</span>}
      {firstByte != null && <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5"><Zap className="w-3 h-3" />TTFB {formatMs(firstByte)}</span>}
      {resourceCount != null && <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-2 py-0.5"><TrendingUp className="w-3 h-3" />{resourceCount} resources</span>}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Browser step row (enhanced)
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function BrowserStepRow({ step, defaultShowScreenshot = false }) {
  const [showShot, setShowShot] = useState(defaultShowScreenshot);
  const hasSS = Boolean(step.screenshot) && step.screenshot !== true;
  const meta = STATUS_META[step.status] || STATUS_META.pending;
  const Icon = meta.Icon;
  const isInProgress = step.status === "running";

  return (
    <div className={`rounded-lg border ${meta.border} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {isInProgress
          ? <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          : <Icon className={`w-4 h-4 shrink-0 ${meta.text}`} />
        }
        <span className="text-xs text-gray-400 font-mono shrink-0">#{step.stepIndex + 1}</span>
        <span className="text-xs font-semibold text-gray-500 shrink-0 bg-gray-100 px-1.5 py-0.5 rounded">{step.action}</span>
        <span className="text-sm text-gray-700 flex-1 truncate">{step.description}</span>
        {step.healed && (
          <span className="shrink-0 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">Healed</span>
        )}
        {step.durationMs > 0 && <span className="text-xs text-gray-400 shrink-0">{formatMs(step.durationMs)}</span>}
        {hasSS && (
          <button onClick={() => setShowShot((v) => !v)} className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Camera className="w-3 h-3" />{showShot ? "Hide" : "Shot"}
          </button>
        )}
      </div>
      {step.healed && step.usedSelector && step.usedSelector !== step.selector && (
        <div className="px-3 pb-1.5">
          <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
            Selector healed: used <code className="font-mono">{step.usedSelector}</code>
          </p>
        </div>
      )}
      {step.metrics && <div className="px-3 pb-2"><PerfChips metrics={step.metrics} /></div>}
      {step.error && (
        <div className="px-3 pb-2 space-y-1.5">
          <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 font-mono">{step.error}</p>
          {step.aiAnalysis && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <span className="font-semibold">AI Analysis: </span>{step.aiAnalysis}
            </p>
          )}
        </div>
      )}
      {showShot && hasSS && (
        <div className="px-3 pb-3">
          <img src={step.screenshot} alt={`Step ${step.stepIndex + 1}`} className="rounded-lg border border-gray-200 w-full max-h-80 object-contain bg-gray-50" />
        </div>
      )}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// AI Insights panel
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function InsightsPanel({ insights }) {
  const [open, setOpen] = useState(true);
  if (!insights) return null;
  const verdictMeta = {
    "All tests passed": { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", Icon: CheckCircle2 },
    "Some tests failed": { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", Icon: AlertTriangle },
    "Critical failure": { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", Icon: XCircle },
  };
  const vm = verdictMeta[insights.verdict] || verdictMeta["Some tests failed"];
  const VIcon = vm.Icon;

  return (
    <div className={`rounded-xl border ${vm.border} ${vm.bg} overflow-hidden`}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <Sparkles className={`w-4 h-4 shrink-0 ${vm.text}`} />
        <span className={`font-semibold text-sm ${vm.text}`}>AI Insights</span>
        <span className={`flex-1 text-sm font-medium ${vm.text}`}>{insights.verdict}</span>
        <VIcon className={`w-4 h-4 shrink-0 ${vm.text}`} />
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-sm border-t border-gray-100 pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.whatWorked?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />What Worked</p>
                <ul className="space-y-0.5">{insights.whatWorked.map((w, i) => <li key={i} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-green-500 mt-0.5">-</span>{w}</li>)}</ul>
              </div>
            )}
            {insights.whatFailed?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-1 flex items-center gap-1"><XCircle className="w-3 h-3" />What Failed</p>
                <ul className="space-y-0.5">{insights.whatFailed.map((w, i) => <li key={i} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-red-500 mt-0.5">-</span>{w}</li>)}</ul>
              </div>
            )}
          </div>
          {insights.rootCause && (
            <div className="bg-white/70 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-gray-600 mb-0.5">Root Cause</p>
              <p className="text-xs text-gray-700">{insights.rootCause}</p>
            </div>
          )}
          {insights.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1"><Info className="w-3 h-3" />Recommendations</p>
              <ul className="space-y-0.5">{insights.recommendations.map((r, i) => <li key={i} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-blue-500 mt-0.5">-&gt;</span>{r}</li>)}</ul>
            </div>
          )}
          {insights.nextTestsToRun?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />Suggested Next Tests</p>
              <ul className="space-y-0.5">{insights.nextTestsToRun.map((t, i) => <li key={i} className="text-xs text-gray-700 flex items-start gap-1"><span className="text-purple-500 mt-0.5">-&gt;</span>{t}</li>)}</ul>
            </div>
          )}
          {insights.performanceNote && (
            <p className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-1.5">
              <span className="font-semibold">Performance: </span>{insights.performanceNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewSummaryCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-gray-800">{value ?? "-"}</p>
    </div>
  );
}

function PreviewStepList({ steps = [] }) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return <p className="text-sm text-gray-500">No concrete execution steps were generated.</p>;
  }

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={`${step.action || "step"}-${index}`} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-gray-400">#{index + 1}</span>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">{step.action || "step"}</span>
          </div>
          <p className="mt-1 text-sm text-gray-800">{step.description || step.label || step.url || "Execution step"}</p>
          {step.url && <p className="mt-1 text-xs text-gray-500 font-mono break-all">{step.url}</p>}
        </div>
      ))}
    </div>
  );
}

function MissionPreviewPanel({ preview, loading, error }) {
  if (loading) {
    return <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Building execution preview...</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  }
  if (!preview) return null;

  const page = preview.pageContext || null;

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Execution Preview</p>
          <h3 className="text-base font-semibold text-gray-900">
            {preview.mode === "multi_scenario" ? "Coverage plan" : preview.mode === "deep_exploration" ? "Product audit plan" : "Run plan"}
          </h3>
        </div>
        {preview.url && (
          <span className="max-w-[18rem] truncate rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200">
            {preview.url}
          </span>
        )}
      </div>

      {page && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <PreviewSummaryCard label="Navigation" value={page.navCount} />
          <PreviewSummaryCard label="Inputs" value={page.inputCount} />
          <PreviewSummaryCard label="Forms" value={page.formCount} />
          <PreviewSummaryCard label="Tabs" value={page.tabCount} />
        </div>
      )}

      {preview.mode === "multi_scenario" && Array.isArray(preview.scenarios) && (
        <div className="space-y-3">
          {preview.scenarios.map((scenario) => (
            <div key={scenario.type} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900 capitalize">{String(scenario.type || "").replace(/_/g, " ")}</h4>
                <span className="text-xs text-gray-500">{scenario.steps?.length || 0} planned steps</span>
              </div>
              <PreviewStepList steps={scenario.steps || []} />
            </div>
          ))}
        </div>
      )}

      {preview.mode === "deep_exploration" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <PreviewSummaryCard label="Login Id" value={preview.credentialsDetected?.email ? "Detected" : "Not detected"} />
            <PreviewSummaryCard label="Password" value={preview.credentialsDetected?.password ? "Detected" : "Not detected"} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900 mb-2">Audit phases</p>
            <ul className="space-y-1">
              {(preview.phases || []).map((phase, index) => (
                <li key={phase} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="mt-0.5 text-xs font-semibold text-blue-600">{index + 1}.</span>
                  <span>{phase}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-sm font-semibold text-gray-900 mb-2">Preflight checklist</p>
            <ul className="space-y-1">
              {(preview.checklist || []).map((item) => (
                <li key={item} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(preview.mode === "browser" || preview.mode === "auto_discover") && (
        <PreviewStepList steps={preview.steps || []} />
      )}
    </div>
  );
}

const RUN_MODE_META = {
  auto: {
    title: "Recon & Smoke",
    purpose: "Start with a low-friction page and validate that basic navigation and core affordances are alive.",
    evidence: ["page scan", "planned smoke steps", "step screenshots", "failure reasons"],
  },
  guided: {
    title: "Scenario Run",
    purpose: "Reproduce one workflow exactly and leave behind a step-by-step trail of what changed.",
    evidence: ["explicit plan", "live screenshots", "per-step status", "replayable failure point"],
  },
  multi: {
    title: "Coverage Sweep",
    purpose: "Attack the same feature from multiple test angles so blind spots do not hide in a single happy path.",
    evidence: ["scenario set", "separate scenario outcomes", "coverage notes", "comparative failure detail"],
  },
  deep: {
    title: "Product Audit",
    purpose: "Log in, map the reachable product surface, and return a usable QA report instead of vague commentary.",
    evidence: ["audit phases", "module discovery", "issue list", "prioritized QA report"],
  },
  cli: {
    title: "Repository Run",
    purpose: "Execute the project test commands tied to the selected task and capture the raw command evidence.",
    evidence: ["generated cases", "command output", "repo context", "pass/fail summary"],
  },
};

const RUN_MODE_TEMPLATES = {
  auto: [
    { label: "Marketing Page", value: "https://example.com" },
    { label: "Signup Page", value: "https://example.com/signup" },
    { label: "Dashboard Landing", value: "https://example.com/dashboard" },
  ],
  guided: [
    {
      label: "Login Flow",
      value: "Go to https://example.com/login, sign in with email: qa@example.com password: Test@1234, verify the dashboard loads and the user menu is visible.",
    },
    {
      label: "Create Record",
      value: "Go to https://example.com, login with email: qa@example.com password: Test@1234, create a new item, verify the success state appears and the item is listed.",
    },
    {
      label: "Approval Flow",
      value: "Open https://example.com, login with email: qa@example.com password: Test@1234, approve one pending request, verify its status changes and the action is reflected in the activity feed.",
    },
  ],
  multi: [
    { label: "Auth Surface", description: "Login and password reset experience for a SaaS app", url: "https://example.com" },
    { label: "Dashboard CRUD", description: "Create, edit, filter, and archive records in the dashboard", url: "https://example.com/app" },
    { label: "Checkout Flow", description: "Cart, checkout, coupon handling, failed payment retry, and order confirmation", url: "https://example.com" },
  ],
  deep: [
    {
      label: "Full SaaS Audit",
      value: "Go to https://example.com\nLogin with email: qa@example.com password: Test@1234\nExplore all modules, test core workflows, validate forms, and produce a detailed QA report.",
    },
    {
      label: "Admin Audit",
      value: "Go to https://example.com/admin\nLogin with email: admin@example.com password: Test@1234\nExplore every admin module, test settings, roles, and approvals, and report reproducible issues.",
    },
  ],
};

function QuickTemplateBar({ title = "Starter templates", items = [], onSelect }) {
  if (!items.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSelect(item)}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RunPrepPanel({ mode, selectedTask, values }) {
  const meta = RUN_MODE_META[mode] || RUN_MODE_META.auto;
  const readiness = [];

  readiness.push({
    label: "Task selected",
    ok: Boolean(selectedTask),
    hint: selectedTask ? `${selectedTask.taskKey ? `[${selectedTask.taskKey}] ` : ""}${selectedTask.task}` : "Pick the task this run belongs to.",
  });

  if (mode === "auto") {
    readiness.push({
      label: "Target URL",
      ok: String(values.autoUrl || "").trim().startsWith("http"),
      hint: "Use a full HTTP or HTTPS page URL.",
    });
  }

  if (mode === "guided") {
    const raw = String(values.browserInstructions || "").trim();
    readiness.push({
      label: "Scenario instructions",
      ok: raw.length >= 20,
      hint: "Describe the workflow, assertions, and credentials if needed.",
    });
    readiness.push({
      label: "Navigation target",
      ok: /https?:\/\//i.test(raw),
      hint: "Include a URL so the run starts from a known page.",
    });
  }

  if (mode === "multi") {
    readiness.push({
      label: "Feature description",
      ok: String(values.multiDescription || "").trim().length >= 12,
      hint: "Describe the product area to cover from multiple angles.",
    });
    readiness.push({
      label: "Base URL",
      ok: !String(values.multiUrl || "").trim() || String(values.multiUrl || "").trim().startsWith("http"),
      hint: "Optional, but useful when scenarios should anchor to one environment.",
    });
  }

  if (mode === "deep") {
    const raw = String(values.deepInstructions || "").trim();
    readiness.push({
      label: "Audit instructions",
      ok: raw.length >= 30,
      hint: "Explain scope clearly so the audit does not wander.",
    });
    readiness.push({
      label: "Target URL",
      ok: /https?:\/\//i.test(raw),
      hint: "Include the application URL.",
    });
    readiness.push({
      label: "Credentials or public access",
      ok: /(email|username|password)/i.test(raw),
      hint: "Add credentials unless the product is fully public.",
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{meta.title}</p>
        <p className="mt-1 text-sm text-gray-700">{meta.purpose}</p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {readiness.map((item) => (
          <div key={item.label} className={`rounded-lg border px-3 py-2 ${item.ok ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-center gap-2">
              {item.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              <p className={`text-sm font-medium ${item.ok ? "text-green-800" : "text-amber-800"}`}>{item.label}</p>
            </div>
            <p className={`mt-1 text-xs ${item.ok ? "text-green-700" : "text-amber-700"}`}>{item.hint}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Evidence produced</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {meta.evidence.map((item) => (
            <span key={item} className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-800 border border-blue-100">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveScreenView({ displayShot, displayCaption, done, stopRequested, status, lastStep, className = "" }) {
  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`} style={{ aspectRatio: "16/10" }}>
      {displayShot ? (
        <img src={displayShot} alt="Agent view" className="w-full h-full object-contain transition-opacity duration-300" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-xs text-gray-400">Agent starting up...</p>
        </div>
      )}
      {displayCaption && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white px-3 py-1.5 flex items-center gap-2">
          {!done ? (
            <span className={`w-2 h-2 rounded-full ${stopRequested ? "bg-orange-400" : "bg-green-400"} animate-pulse shrink-0`} />
          ) : status === "passed" ? (
            <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
          ) : status === "cancelled" ? (
            <Square className="w-3 h-3 text-slate-300 shrink-0" />
          ) : (
            <XCircle className="w-3 h-3 text-red-400 shrink-0" />
          )}
          <span className="text-xs text-gray-200 truncate">{displayCaption}</span>
          {lastStep?.durationMs > 0 && (
            <span className="text-xs text-gray-400 shrink-0 ml-auto">{formatMs(lastStep.durationMs)}</span>
          )}
        </div>
      )}
    </div>
  );
}

function LiveStepList({ liveSteps, done, bottomRef, maxH = "max-h-48" }) {
  return (
    <div className={`space-y-1 overflow-y-auto ${maxH} pr-0.5`}>
      {liveSteps.length === 0 && (
        <p className="text-xs text-blue-400 text-center py-3 animate-pulse">Waiting for first step...</p>
      )}
      {liveSteps.map((step, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${step.status === "passed" ? "bg-green-50 border border-green-100" : step.status === "failed" ? "bg-red-50 border border-red-100" : "bg-white border border-gray-100"}`}
        >
          {step.status === "passed"
            ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            : step.status === "failed"
              ? <XCircle className="w-3 h-3 text-red-500 shrink-0" />
              : step.status === "cancelled"
                ? <Square className="w-3 h-3 text-slate-500 shrink-0" />
                : i === liveSteps.length - 1 && !done
                  ? <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                  : <Clock className="w-3 h-3 text-gray-300 shrink-0" />}
          <span className="font-mono text-gray-400 shrink-0">#{i + 1}</span>
          <span className="font-semibold text-gray-500 bg-gray-100 px-1 py-0.5 rounded shrink-0">{step.action}</span>
          <span className="text-gray-700 truncate">{step.description}</span>
          {step.screenshot && step.screenshot !== true && (
            <Camera className="w-3 h-3 text-indigo-400 shrink-0 ml-auto" title="Has screenshot" />
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Live Run Panel â€" mini screen + step list + fullscreen
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function LiveRunPanel({ runId, onFinished }) {
  const [liveSteps, setLiveSteps] = useState([]);
  const [status, setStatus] = useState("running");
  const [stopRequested, setStopRequested] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState(null);
  const [credPrompt, setCredPrompt] = useState(null); // { loginUrl }
  const [credEmail, setCredEmail] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [submittingCreds, setSubmittingCreds] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const bottomRef = useRef(null);

  useEffect(() => { onFinishedRef.current = onFinished; });

  useEffect(() => {
    if (!runId) return;
    finishedRef.current = false;

    const poll = async () => {
      try {
        const res = await api.get(`/testing-agent/runs/${runId}`);
        const run = res.data;
        const stepResults = run?.output_json?.stepResults;
        if (Array.isArray(stepResults)) setLiveSteps(stepResults);
        const cs = run?.output_json?.currentScreen;
        if (cs?.screenshot) setCurrentScreen(cs);
        const s = run?.status || "running";
        setStatus(s);
        if (s === "cancel_requested") setStopRequested(true);
        if (s === "waiting_input") {
          const waitingFor = run?.output_json?.waitingFor;
          setCredPrompt((prev) => prev || { loginUrl: waitingFor?.loginUrl || null });
        }
        if (!["running", "cancel_requested", "waiting_input"].includes(s) && !finishedRef.current) {
          finishedRef.current = true;
          clearInterval(intervalRef.current);
          onFinishedRef.current?.(run);
        }
      } catch { /* ignore poll errors */ }
    };
    poll();
    intervalRef.current = setInterval(poll, 2000);
    return () => clearInterval(intervalRef.current);
  }, [runId]);

  useEffect(() => {
    if (!minimized && !fullscreen && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveSteps.length, minimized, fullscreen]);

  async function submitCredentials() {
    if (!credEmail.trim() || !credPassword.trim() || submittingCreds) return;
    setSubmittingCreds(true);
    try {
      await api.post(`/testing-agent/runs/${runId}/provide-credentials`, {
        email: credEmail.trim(),
        password: credPassword,
      });
      setCredPrompt(null);
      setCredEmail("");
      setCredPassword("");
      setStatus("running");
      toast.success("Credentials submitted — agent continuing");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to submit credentials");
    } finally {
      setSubmittingCreds(false);
    }
  }

  if (!runId) return null;

  const done = !["running", "cancel_requested", "waiting_input"].includes(status);
  const passed = liveSteps.filter((s) => s.status === "passed").length;
  const failed = liveSteps.filter((s) => s.status === "failed").length;
  const lastStep = liveSteps[liveSteps.length - 1];

  async function handleStopRun() {
    if (!runId || stopRequested || done) return;
    try {
      setStopRequested(true);
      setStatus("cancel_requested");
      await api.post(`/testing-agent/runs/${runId}/stop`);
      toast("Stop requested");
    } catch {
      setStopRequested(false);
      setStatus("running");
      toast.error("Failed to stop run");
    }
  }

  // Latest screenshot (base64, not stripped to `true`) â€" fallback when currentScreen not available
  const latestScreenshot = [...liveSteps].reverse()
    .find((s) => s.screenshot && s.screenshot !== true)?.screenshot ?? null;

  // Primary: use currentScreen (updated every 1.5s) while running; fall back to latestScreenshot
  const displayShot = (!done && currentScreen?.screenshot) ? currentScreen.screenshot : latestScreenshot;
  const displayCaption = (!done && currentScreen?.caption) ? currentScreen.caption
    : lastStep ? `${lastStep.action}: ${lastStep.description}` : null;

  // â"€â"€ Fullscreen overlay â"€â"€
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
        {/* Fullscreen header */}
        <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
          {!done
            ? <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
            : status === "passed"
              ? <CheckCircle2 className="w-4 h-4 text-green-400" />
              : status === "cancelled"
                ? <Square className="w-4 h-4 text-slate-300" />
              : <XCircle className="w-4 h-4 text-red-400" />
          }
          <span className="text-sm font-semibold text-white">
            {done ? (status === "passed" ? "Run completed" : status === "cancelled" ? "Run stopped" : "Run finished") : status === "waiting_input" ? "Waiting for credentials..." : stopRequested ? "Stopping run..." : "Live Agent View"}
          </span>
          <span className="flex gap-2 text-xs ml-2">
            {passed > 0 && <span className="text-green-400 font-semibold">{passed} passed</span>}
            {failed > 0 && <span className="text-red-400 font-semibold">{failed} failed</span>}
            <span className="text-gray-400">{liveSteps.length} steps</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!done && (
              <button
                onClick={handleStopRun}
                disabled={stopRequested}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/15 text-red-200 hover:bg-red-500/25 disabled:opacity-60 text-xs font-semibold"
              >
                <Square className="w-3.5 h-3.5" />{stopRequested ? "Stopping..." : "Stop"}
              </button>
            )}
            <button onClick={() => setFullscreen(false)}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors"
              title="Exit fullscreen">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={() => setFullscreen(false)}
              className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors"
              title="Close">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fullscreen body: large screenshot left, steps right */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4 flex flex-col">
            <LiveScreenView className="flex-1 h-full" displayShot={displayShot} displayCaption={displayCaption} done={done} stopRequested={stopRequested} status={status} lastStep={lastStep} />
          </div>
          <div className="w-80 bg-gray-900 border-l border-gray-700 p-3 flex flex-col gap-2 overflow-hidden">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide shrink-0">Steps</p>
            <LiveStepList liveSteps={liveSteps} done={done} bottomRef={bottomRef} maxH="h-full overflow-y-auto" />
          </div>
        </div>
      </div>
    );
  }

  // â"€â"€ Normal (mini) panel â"€â"€
  return (
    <div className="mt-4 border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100 bg-blue-50">
        {!done
          ? <span className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
          : status === "passed"
            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            : status === "cancelled"
              ? <Square className="w-4 h-4 text-slate-600 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-500 shrink-0" />
        }
        <span className="text-sm font-semibold text-blue-800">
          {done ? (status === "passed" ? "Completed" : status === "cancelled" ? "Stopped" : "Finished") : status === "waiting_input" ? "Needs Login..." : stopRequested ? "Stopping..." : "Live..."}
        </span>
        {liveSteps.length > 0 && (
          <span className="flex gap-1.5 text-xs ml-1">
            {passed > 0 && <span className="text-green-600 font-semibold">{passed} passed</span>}
            {failed > 0 && <span className="text-red-500 font-semibold">{failed} failed</span>}
            <span className="text-blue-400">{liveSteps.length} steps</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {!done && (
            <button
              onClick={handleStopRun}
              disabled={stopRequested}
              title="Stop run"
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-60 text-xs font-semibold"
            >
              <Square className="w-3.5 h-3.5" />{stopRequested ? "Stopping" : "Stop"}
            </button>
          )}
          <button onClick={() => setFullscreen(true)} title="Fullscreen"
            className="p-1 rounded hover:bg-blue-200 text-blue-500 transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setMinimized((v) => !v)} title={minimized ? "Expand" : "Minimize"}
            className="p-1 rounded hover:bg-blue-200 text-blue-500 transition-colors">
            {minimized ? <Monitor className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-3 space-y-2">
          <LiveScreenView displayShot={displayShot} displayCaption={displayCaption} done={done} stopRequested={stopRequested} status={status} lastStep={lastStep} />
          <LiveStepList liveSteps={liveSteps} done={done} bottomRef={bottomRef} maxH="max-h-44" />
        </div>
      )}

      {/* Credential modal overlay */}
      {credPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <h3 className="text-base font-semibold text-gray-900">Login Required</h3>
            </div>
            <p className="text-sm text-gray-600">
              The testing agent reached a login page and needs credentials to continue.
            </p>
            {credPrompt.loginUrl && (
              <p className="text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-500 break-all">{credPrompt.loginUrl}</p>
            )}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email / Username</label>
                <input
                  type="email"
                  value={credEmail}
                  onChange={(e) => setCredEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                <input
                  type="password"
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => e.key === "Enter" && submitCredentials()}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={submitCredentials}
                disabled={!credEmail.trim() || !credPassword.trim() || submittingCreds}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700"
              >
                {submittingCreds ? "Submitting..." : "Submit & Continue"}
              </button>
              <button
                onClick={() => setCredPrompt(null)}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Collapsible test case row
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function TestCaseRow({ tc }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left">
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className="text-xs font-mono text-gray-500 shrink-0">{tc.id}</span>
        <LevelBadge level={tc.level} />
        <span className="text-sm font-medium text-gray-800 truncate">{tc.title}</span>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3 text-sm bg-white">
          <p className="text-gray-700"><span className="font-semibold">Objective: </span>{tc.objective}</p>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Steps:</p>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">{(tc.steps || []).map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Expected:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">{(tc.expected || []).map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );
}

// CLI command output block
function CommandOutput({ cmd }) {
  const [open, setOpen] = useState(false);
  const hasOutput = cmd.stdout || cmd.stderr;
  const borderColor = cmd.passed ? "border-green-200 bg-green-50" : cmd.timedOut ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50";
  return (
    <div className={`rounded-lg border ${borderColor}`}>
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {cmd.passed ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : cmd.timedOut ? <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <code className="text-sm font-mono truncate text-gray-800">{cmd.command}</code>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
          {cmd.timedOut && <span className="text-amber-600 font-semibold">Timed out</span>}
          <span>exit {cmd.exitCode}</span>
          <span>{formatMs(cmd.durationMs)}</span>
          {hasOutput && <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-gray-600 hover:text-gray-900">{open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Output</button>}
        </div>
      </div>
      {open && hasOutput && (
        <div className="border-t border-gray-200 p-3 space-y-2">
          {cmd.stdout && <pre className="text-xs bg-gray-900 text-green-300 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{cmd.stdout}</pre>}
          {cmd.stderr && <pre className="text-xs bg-gray-900 text-red-300 rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">{cmd.stderr}</pre>}
        </div>
      )}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Multi-scenario cards
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const SCENARIO_META = {
  happy_path:    { label: "Happy Path",    Icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
  error_handling:{ label: "Error Handling",Icon: Shield,       color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200" },
  edge_cases:    { label: "Edge Cases",    Icon: AlertTriangle,color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  performance:   { label: "Performance",   Icon: Activity,     color: "text-teal-600",  bg: "bg-teal-50",  border: "border-teal-200" },
};

function ScenarioCard({ scenario, onViewDetails }) {
  const meta = SCENARIO_META[scenario.type] || SCENARIO_META.happy_path;
  const SIcon = meta.Icon;
  const { passed = 0, failed = 0, total = 0 } = scenario.summary || {};
  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} p-4 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SIcon className={`w-4 h-4 ${meta.color}`} />
          <span className={`text-sm font-semibold ${meta.color}`}>{scenario.label}</span>
        </div>
        <StatusBadge value={scenario.status} />
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-600">
        <span><span className="text-green-600 font-semibold">{passed}</span> passed</span>
        <span><span className="text-red-600 font-semibold">{failed}</span> failed</span>
        <span className="text-gray-400">{total} total</span>
      </div>
      {scenario.insights?.verdict && (
        <p className="text-xs text-gray-600 line-clamp-2">{scenario.insights.verdict}</p>
      )}
      <button onClick={() => onViewDetails(scenario.runId)}
        className={`text-xs font-semibold ${meta.color} hover:underline flex items-center gap-1`}
      >
        <Eye className="w-3 h-3" /> View Details
      </button>
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Full QA Report Panel (for deep exploration runs)
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const SEVERITY_META = {
  critical: { bg: "bg-red-100",    text: "text-red-700",    border: "border-red-300",    dot: "bg-red-500" },
  high:     { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300", dot: "bg-orange-500" },
  medium:   { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-300",  dot: "bg-amber-500" },
  low:      { bg: "bg-blue-50",    text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-400" },
};

function BugCard({ bug }) {
  const [open, setOpen] = useState(false);
  const sm = SEVERITY_META[bug.severity] || SEVERITY_META.low;
  return (
    <div className={`rounded-lg border ${sm.border} overflow-hidden`}>
      <button onClick={() => setOpen(v => !v)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left ${sm.bg} hover:brightness-95`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${sm.dot}`} />
        <span className={`text-xs font-bold uppercase tracking-wide shrink-0 ${sm.text}`}>{bug.severity}</span>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{bug.title}</span>
        {bug.module && <span className="text-xs text-gray-500 shrink-0 bg-white/60 px-2 py-0.5 rounded-full">{bug.module}</span>}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="bg-white px-4 py-3 space-y-2.5 text-sm border-t border-gray-100">
          <p className="text-gray-700">{bug.description}</p>
          {bug.stepsToReproduce?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Steps to reproduce</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs text-gray-600">
                {bug.stepsToReproduce.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {bug.expectedBehavior && (
              <div className="bg-green-50 border border-green-100 rounded px-2 py-1.5">
                <p className="text-xs font-semibold text-green-700 mb-0.5">Expected</p>
                <p className="text-xs text-green-800">{bug.expectedBehavior}</p>
              </div>
            )}
            {bug.actualBehavior && (
              <div className="bg-red-50 border border-red-100 rounded px-2 py-1.5">
                <p className="text-xs font-semibold text-red-700 mb-0.5">Actual</p>
                <p className="text-xs text-red-800">{bug.actualBehavior}</p>
              </div>
            )}
          </div>
          {bug.impact && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <span className="font-semibold">Impact: </span>{bug.impact}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function QAReportPanel({ report, phases }) {
  const [section, setSection] = useState("bugs");
  if (!report) return null;

  const score = report.overallHealthScore || 0;
  const scoreColor = score >= 8 ? "text-green-600" : score >= 5 ? "text-amber-600" : "text-red-600";
  const scoreBg = score >= 8 ? "bg-green-50 border-green-200" : score >= 5 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  const tabs = [
    { key: "bugs", label: `Bugs (${report.bugsFound?.length || 0})` },
    { key: "modules", label: `Modules (${report.moduleReports?.length || 0})` },
    { key: "security", label: `Security (${report.securityConcerns?.length || 0})` },
    { key: "fixes", label: "Fixes" },
  ];

  return (
    <div className="space-y-3">
      {/* Header: health score + verdict + phase summary */}
      <div className={`rounded-xl border ${scoreBg} p-4 space-y-2`}>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className={`text-3xl font-black ${scoreColor}`}>{score}<span className="text-base font-semibold text-gray-400">/10</span></div>
            <div className="text-xs text-gray-500 font-medium">Health Score</div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800 mb-1">Overall Assessment</p>
            <p className="text-sm text-gray-700 leading-relaxed">{report.verdict}</p>
          </div>
        </div>
        {phases && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-200 pt-2 mt-1">
            <span>Modules: <b className="text-gray-700">{phases.recon?.modulesDiscovered || 0}</b></span>
            <span>Modals found: <b className="text-gray-700">{phases.recon?.totalModalsFound ?? "-"}</b></span>
            <span>Buttons clicked: <b className="text-gray-700">{phases.recon?.totalButtonsFound ?? "-"}</b></span>
            <span>Tabs explored: <b className="text-gray-700">{phases.recon?.totalTabsFound ?? "-"}</b></span>
            <span>Test cases run: <b className="text-gray-700">{phases.plan?.totalTestCases || 0}</b></span>
          </div>
        )}
      </div>

      {/* Priority fixes */}
      {report.topPriorityFixes?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Top Priority Fixes</p>
          <ol className="space-y-0.5">
            {report.topPriorityFixes.map((f, i) => (
              <li key={i} className="text-xs text-red-800 flex items-start gap-1.5">
                <span className="font-bold shrink-0">{i + 1}.</span>{f}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200 pb-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${section === t.key ? "bg-white border-gray-200 text-gray-900 -mb-px" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Bugs tab */}
      {section === "bugs" && (
        <div className="space-y-2">
          {report.bugsFound?.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No bugs found - great health!</p>}
          {report.bugsFound?.map((bug, i) => <BugCard key={i} bug={bug} />)}
        </div>
      )}

      {/* Module reports tab */}
      {section === "modules" && (
        <div className="space-y-2">
          {report.moduleReports?.map((m, i) => {
            const mScore = m.healthScore || 5;
            const mColor = mScore >= 8 ? "text-green-600" : mScore >= 5 ? "text-amber-600" : "text-red-600";
            return (
              <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-black ${mColor}`}>{mScore}<span className="text-xs text-gray-400">/10</span></span>
                  <span className="font-semibold text-gray-800 text-sm">{m.module}</span>
                </div>
                <p className="text-xs text-gray-600">{m.summary}</p>
                {m.issues?.length > 0 && (
                  <ul className="space-y-0.5">
                    {m.issues.map((issue, j) => <li key={j} className="text-xs text-red-600 flex items-start gap-1"><span className="text-red-400 mt-0.5">-</span>{issue}</li>)}
                  </ul>
                )}
                {m.testedFeatures?.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {m.testedFeatures.map((f, j) => <span key={j} className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">{f}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Security tab */}
      {section === "security" && (
        <div className="space-y-2">
          {report.securityConcerns?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1"><Shield className="w-3 h-3" /> Security Concerns</p>
              {report.securityConcerns.map((c, i) => <p key={i} className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-1">{c}</p>)}
            </div>
          )}
          {report.performanceIssues?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1"><Activity className="w-3 h-3" /> Performance Issues</p>
              {report.performanceIssues.map((c, i) => <p key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mb-1">{c}</p>)}
            </div>
          )}
          {report.logicalInconsistencies?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-purple-700 mb-1.5 flex items-center gap-1"><Info className="w-3 h-3" /> Logical Inconsistencies</p>
              {report.logicalInconsistencies.map((c, i) => <p key={i} className="text-xs text-purple-800 bg-purple-50 border border-purple-200 rounded px-2.5 py-1.5 mb-1">{c}</p>)}
            </div>
          )}
          {!report.securityConcerns?.length && !report.performanceIssues?.length && !report.logicalInconsistencies?.length && (
            <p className="text-sm text-gray-500 text-center py-4">No security or performance issues detected.</p>
          )}
        </div>
      )}

      {/* Fixes tab */}
      {section === "fixes" && (
        <div className="space-y-2">
          {report.topPriorityFixes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Priority Fixes</p>
              <ol className="space-y-1.5">
                {report.topPriorityFixes.map((f, i) => <li key={i} className="text-sm text-gray-700 flex gap-2"><span className="font-bold text-red-500 shrink-0">{i + 1}.</span>{f}</li>)}
              </ol>
            </div>
          )}
          {report.coverageGaps?.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Coverage Gaps (untested areas)</p>
              {report.coverageGaps.map((g, i) => <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5 mb-1"><span className="text-gray-400 mt-0.5">-&gt;</span>{g}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Smart Browser Report Panel (DOM-first test runs)
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
const CATEGORY_META = {
  happy_path:     { label: "Happy Path",     bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  dot: "bg-green-500",  Icon: CheckCircle2 },
  error_handling: { label: "Error Handling", bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    dot: "bg-red-500",    Icon: Shield },
  edge_case:      { label: "Edge Cases",     bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  dot: "bg-amber-500",  Icon: AlertTriangle },
  regression:     { label: "Regression",     bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700", dot: "bg-purple-500", Icon: Activity },
};

function SmartBrowserReportPanel({ report }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [openModule, setOpenModule] = useState(null);
  const [openScenario, setOpenScenario] = useState(null);
  if (!report) return null;

  const summary = report.summary || {};
  const total    = summary.total    ?? 0;
  const passed   = summary.passed   ?? 0;
  const failed   = summary.failed   ?? 0;
  const passRate = summary.passRate ?? (total > 0 ? Math.round((passed / total) * 100) : 0);
  const narrative       = report.narrative;
  const url             = report.meta?.url ?? report.url;
  const modules         = report.modules   ?? [];
  const fullResults     = report.fullResults ?? [];
  const criticalIssues  = report.criticalIssues ?? [];
  const categorySummary = report.categorySummary ?? [];

  const passColor = passRate >= 80 ? "text-green-600" : passRate >= 50 ? "text-amber-600" : "text-red-600";
  const passBg    = passRate >= 80 ? "bg-green-50 border-green-200" : passRate >= 50 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  const tabs = [
    { key: "overview",  label: "Overview" },
    { key: "scenarios", label: `Scenarios (${modules.flatMap(m => m.scenarios ?? []).length})` },
    { key: "failures",  label: `Failures (${criticalIssues.length})` },
  ];

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className={`rounded-xl border ${passBg} p-4`}>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-center shrink-0">
            <div className={`text-4xl font-black ${passColor}`}>{passRate}<span className="text-lg font-semibold text-gray-400">%</span></div>
            <div className="text-xs text-gray-500 font-medium mt-0.5">Pass Rate</div>
          </div>
          <div className="flex gap-5 text-sm flex-wrap">
            <div className="text-center"><div className="text-xl font-bold text-green-600">{passed}</div><div className="text-xs text-gray-500">Passed</div></div>
            <div className="text-center"><div className="text-xl font-bold text-red-600">{failed}</div><div className="text-xs text-gray-500">Failed</div></div>
            <div className="text-center"><div className="text-xl font-bold text-gray-700">{total}</div><div className="text-xs text-gray-500">Total</div></div>
            <div className="text-center"><div className="text-xl font-bold text-blue-600">{modules.length}</div><div className="text-xs text-gray-500">Pages</div></div>
          </div>
          {categorySummary.length > 0 && (
            <div className="flex flex-wrap gap-2 ml-auto">
              {categorySummary.map(c => {
                const cm = CATEGORY_META[c.category] || CATEGORY_META.happy_path;
                const CIcon = cm.Icon;
                return (
                  <div key={c.category} className={`flex items-center gap-1.5 rounded-lg border ${cm.border} ${cm.bg} px-2.5 py-1.5`}>
                    <CIcon className={`w-3 h-3 ${cm.text} shrink-0`} />
                    <span className={`text-xs font-semibold ${cm.text}`}>{cm.label}</span>
                    <span className={`text-xs font-bold ${c.failed > 0 ? "text-red-600" : "text-green-600"}`}>{c.passed}/{c.total}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {url && <p className="mt-2 text-xs text-gray-500 font-mono break-all">{url}</p>}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${activeTab === t.key ? "bg-white border-gray-200 text-gray-900 -mb-px" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          {narrative && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />QA Executive Summary</p>
              <p className="text-sm text-blue-900 leading-relaxed">{narrative}</p>
            </div>
          )}

          {/* Category breakdown cards */}
          {categorySummary.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {categorySummary.map(c => {
                const cm = CATEGORY_META[c.category] || CATEGORY_META.happy_path;
                const CIcon = cm.Icon;
                const pct = c.total > 0 ? Math.round((c.passed / c.total) * 100) : 0;
                return (
                  <div key={c.category} className={`rounded-xl border ${cm.border} ${cm.bg} p-3`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CIcon className={`w-4 h-4 ${cm.text} shrink-0`} />
                      <span className={`text-sm font-semibold ${cm.text}`}>{cm.label}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-black text-gray-800">{pct}</span>
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div className="text-green-600 font-semibold">{c.passed} passed</div>
                        {c.failed > 0 && <div className="text-red-600 font-semibold">{c.failed} failed</div>}
                        <div>{c.total} total</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pages summary */}
          {modules.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Pages Tested</p>
              {modules.map((mod, i) => {
                const pFailed = mod.failed ?? 0;
                const pPassed = mod.passed ?? 0;
                const pTotal  = pPassed + pFailed;
                return (
                  <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${pFailed === 0 ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                    {pFailed === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{mod.title || mod.url}</p>
                      {mod.pageIntent && <p className="text-xs text-gray-500 truncate">{mod.pageIntent}</p>}
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${pFailed === 0 ? "text-green-600" : "text-red-600"}`}>{pPassed}/{pTotal}</span>
                    {mod.scenarios?.length > 0 && (
                      <span className="text-xs text-gray-400 shrink-0">{mod.scenarios.length} scenarios</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SCENARIOS TAB ── */}
      {activeTab === "scenarios" && (
        <div className="space-y-3">
          {modules.map((mod, mi) => {
            const modScenarios = mod.scenarios ?? [];
            if (modScenarios.length === 0) return null;
            const fullMod = fullResults.find(f => f.url === mod.url);
            return (
              <div key={mi} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <Globe className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{mod.title || mod.url}</span>
                  {mod.pageIntent && <span className="text-xs text-gray-400 italic truncate max-w-[180px]">{mod.pageIntent}</span>}
                </div>
                <div className="divide-y divide-gray-100">
                  {modScenarios.map((scen, si) => {
                    const cm = CATEGORY_META[scen.category] || CATEGORY_META.happy_path;
                    const CIcon = cm.Icon;
                    const key = `${mi}-${si}`;
                    const isOpen = openScenario === key;
                    // Get detailed step results from fullResults
                    const fullScen = fullMod?.scenarios?.find(s => s.scenarioId === scen.id);
                    const stepResults = fullScen?.results ?? [];
                    return (
                      <div key={si}>
                        <button
                          onClick={() => setOpenScenario(isOpen ? null : key)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 ${isOpen ? "bg-gray-50" : ""}`}
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${scen.passed ? "bg-green-500" : "bg-red-500"}`} />
                          <span className={`text-xs font-bold shrink-0 px-1.5 py-0.5 rounded-full ${cm.bg} ${cm.text} ${cm.border} border`}>{cm.label}</span>
                          <span className="text-sm text-gray-800 flex-1 truncate">{scen.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{scen.steps - scen.failedSteps}/{scen.steps} steps</span>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                        </button>
                        {isOpen && (
                          <div className="border-t border-gray-100 bg-white">
                            {stepResults.length > 0 ? stepResults.map((step, j) => (
                              <div key={j} className={`flex items-start gap-2 px-4 py-2 border-b border-gray-50 last:border-0 ${step.passed ? "" : "bg-red-50/40"}`}>
                                {step.passed
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                                  : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                                }
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{step.action}</span>
                                    <span className="text-xs text-gray-700 truncate">{step.step}</span>
                                  </div>
                                  {step.error && <p className="text-xs text-red-600 mt-0.5 bg-red-50 rounded px-1.5 py-0.5 font-mono">{step.error}</p>}
                                  {step.screenshot && step.screenshot !== true && (
                                    <img src={step.screenshot} alt="" className="mt-1.5 rounded border border-gray-200 max-h-28 object-contain" />
                                  )}
                                </div>
                              </div>
                            )) : (
                              <p className="px-4 py-2 text-xs text-gray-400">No step detail available.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {modules.every(m => !m.scenarios?.length) && (
            <p className="text-sm text-gray-500 text-center py-6">No scenario data — run used mechanical fallback mode.</p>
          )}
        </div>
      )}

      {/* ── FAILURES TAB ── */}
      {activeTab === "failures" && (
        <div className="space-y-2">
          {criticalIssues.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No failures — all checks passed.</p>
            </div>
          )}
          {criticalIssues.map((issue, i) => {
            const cm = CATEGORY_META[issue.category] || CATEGORY_META.edge_case;
            return (
              <div key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {issue.category && (
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${cm.bg} ${cm.text} ${cm.border} border`}>{cm.label}</span>
                      )}
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{issue.action}</span>
                    </div>
                    <p className="text-xs text-red-800 font-medium">{issue.step}</p>
                    <p className="text-xs text-red-600 font-mono mt-0.5">{issue.error}</p>
                    {issue.page && <p className="text-xs text-gray-400 mt-0.5 truncate">{issue.page}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Run detail modal
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function NarrativeReportPanel({ reportDocument }) {
  const [open, setOpen] = useState(true);
  if (!reportDocument?.sections?.length) return null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-left border-b border-gray-100">
        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-800 flex-1">Narrative Report</span>
        <span className="text-xs text-gray-400">{reportDocument.generatedAt ? formatDate(reportDocument.generatedAt) : ""}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="p-4 space-y-4">
          {reportDocument.sections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h4 className="text-sm font-semibold text-gray-800">{section.title}</h4>
              <div className="space-y-1">
                {section.lines.map((line, index) => (
                  <p key={`${section.title}-${index}`} className="text-xs text-gray-600 leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunDetailModal({ run, onClose }) {
  if (!run) return null;
  const output = run.output_json || {};
  const isSmartBrowser = run.mode === "smart_browser";
  const isBrowser = isSmartBrowser || run.mode === "browser" || run.mode === "auto_discover" || run.mode === "multi_scenario" || run.mode === "deep_exploration";
  const isAutoDiscover = run.mode === "auto_discover";
  const isDeepExploration = run.mode === "deep_exploration";

  const cases = Array.isArray(run.generated_cases) ? run.generated_cases : [];
  const commandOutputs = Array.isArray(output.commandOutputs) ? output.commandOutputs : [];
  const stepResults = Array.isArray(output.stepResults) ? output.stepResults : [];
  const summary = output.summary || {};
  const gitContext = output.gitContext || {};
  const execCtx = output.executionContext || {};
  const insights = output.insights || null;
  const qaReport = output.qaReport || null;
  const reportDocument = output.reportDocument || null;

  const modeMeta = {
    smart_browser:    { label: "Smart DOM Test", Icon: Wand2,    color: "text-emerald-600", bg: "bg-emerald-50" },
    browser:          { label: "Browser",        Icon: Globe,    color: "text-blue-600",    bg: "bg-blue-50" },
    auto_discover:    { label: "Auto-Discover",  Icon: Wand2,    color: "text-indigo-600",  bg: "bg-indigo-50" },
    multi_scenario:   { label: "Multi-Scenario", Icon: Layers,   color: "text-orange-600",  bg: "bg-orange-50" },
    deep_exploration: { label: "Deep Explore",   Icon: Eye,      color: "text-violet-600",  bg: "bg-violet-50" },
    cli:              { label: "CLI",            Icon: Terminal, color: "text-gray-600",    bg: "bg-gray-50" },
    generate:         { label: "Generate",       Icon: Sparkles, color: "text-purple-600",  bg: "bg-purple-50" },
  };
  const mm = modeMeta[run.mode] || modeMeta.browser;
  const MIcon = mm.Icon;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <StatusBadge value={run.status} large />
            <span className={`inline-flex items-center gap-1 text-xs ${mm.bg} ${mm.color} px-2 py-1 rounded-full font-semibold`}>
              <MIcon className="w-3 h-3" />{mm.label}
            </span>
            <div>
              <div className="font-semibold text-gray-900">{run.task_name || "Unknown task"}</div>
              <div className="text-xs text-gray-500">{run.project_name} - {formatDate(run.created_at)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadRunReportPdf(run.id).catch(() => toast.error("Failed to download PDF report"))}
              className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-semibold"
            >
              <Download className="w-3.5 h-3.5" /> PDF Report
            </button>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-100">Close</button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Summary tiles */}
          {isSmartBrowser ? (() => {
            const rep = output.report || {};
            const s = rep.summary || {};
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoTile label="Pages Tested" value={rep.modules?.length ?? "-"} />
                <InfoTile label="Total Checks" value={s.total ?? "-"} />
                <InfoTile label="Passed" value={s.passed ?? "-"} valueColor="text-green-600" />
                <InfoTile label="Failed" value={s.failed ?? "-"} valueColor="text-red-600" />
              </div>
            );
          })() : isDeepExploration ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoTile label="Modules Tested" value={summary.modules} />
              <InfoTile label="Steps Total" value={summary.total} />
              <InfoTile label="Bugs Found" value={summary.bugsFound ?? "-"} valueColor="text-red-600" />
              <InfoTile label="Health Score" value={summary.overallHealthScore != null ? `${summary.overallHealthScore}/10` : "-"} valueColor={summary.overallHealthScore >= 8 ? "text-green-600" : summary.overallHealthScore >= 5 ? "text-amber-600" : "text-red-600"} />
            </div>
          ) : isBrowser ? (
            <div className="grid grid-cols-3 gap-3">
              <InfoTile label="Steps Total" value={summary.total} />
              <InfoTile label="Passed" value={summary.passed} valueColor="text-green-600" />
              <InfoTile label="Failed" value={summary.failed} valueColor="text-red-600" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoTile label="Commands" value={`${summary.executedCount || 0} / ${summary.commandCount || 0}`} />
              <InfoTile label="Result" value={summary.passed ? "All passed" : summary.failureReason || "Failed"} />
              <InfoTile label="Repository" value={execCtx.repoPath ? execCtx.repoPath.split(/[/\\]/).pop() : "-"} />
              <InfoTile label="Framework" value={execCtx.framework || "-"} />
            </div>
          )}

          {/* Smart Browser full report */}
          {isSmartBrowser && output.report && (
            <section>
              <SmartBrowserReportPanel report={output.report} />
            </section>
          )}

          {reportDocument && (
            <section>
              <NarrativeReportPanel reportDocument={reportDocument} />
            </section>
          )}

          {/* Full QA Report (deep exploration) */}
          {isDeepExploration && qaReport && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-600" /> Full QA Report
              </h3>
              <QAReportPanel report={qaReport} phases={output.phases} />
            </section>
          )}

          {/* AI Insights (non-deep runs, or deep runs without qaReport) */}
          {!isDeepExploration && insights && <InsightsPanel insights={insights} />}
          {isDeepExploration && !qaReport && insights && <InsightsPanel insights={insights} />}

          {/* Auto-discover: page info */}
          {isAutoDiscover && output.pageTitle && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
              <p className="text-xs text-indigo-500 font-semibold mb-1">Discovered page: {output.url}</p>
              <p className="text-sm text-indigo-900 font-medium">{output.pageTitle}</p>
            </div>
          )}

          {/* Browser: instructions */}
          {run.mode === "browser" && output.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-500 font-semibold mb-1">Instructions given:</p>
              <p className="text-sm text-blue-900">{output.instructions}</p>
            </div>
          )}

          {/* Deep Exploration: instructions + discovered modules */}
          {isDeepExploration && (
            <div className="space-y-2">
              {output.instructions && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-violet-500 font-semibold mb-1">Instructions given:</p>
                  <p className="text-sm text-violet-900">{output.instructions}</p>
                </div>
              )}
              {output.discoveredModules?.length > 0 && (
                <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-violet-500 font-semibold mb-2">Modules discovered &amp; tested ({output.discoveredModules.length}):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {output.discoveredModules.map((m, i) => {
                      const mod = output.modules?.find(x => x.name === m);
                      const st = mod?.status || "unknown";
                      const cls = st === "passed" ? "bg-green-100 text-green-700" : st === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
                      return <span key={i} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{m}</span>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Git context (CLI runs) */}
          {!isBrowser && gitContext.branch && (
            <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <GitBranch className="w-4 h-4 text-gray-400" />
              <span>Branch: <span className="font-mono font-semibold">{gitContext.branch}</span></span>
              {gitContext.changedFiles?.length > 0 && <span className="text-gray-400">- {gitContext.changedFiles.length} changed files</span>}
            </div>
          )}

          {/* Browser step results */}
          {isBrowser && stepResults.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Step Results
              </h3>
              <div className="space-y-2">
                {stepResults.map((step, i) => <BrowserStepRow key={i} step={step} />)}
              </div>
            </section>
          )}

          {/* CLI command outputs */}
          {!isBrowser && commandOutputs.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Terminal className="w-4 h-4" /> Command Results</h3>
              <div className="space-y-2">{commandOutputs.map((cmd, i) => <CommandOutput key={i} cmd={cmd} />)}</div>
            </section>
          )}

          {/* Generated test cases */}
          {cases.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><Layers className="w-4 h-4" /> Generated Test Cases ({cases.length})</h3>
              <div className="space-y-1.5">{cases.map((tc, i) => <TestCaseRow key={tc.id || i} tc={tc} />)}</div>
            </section>
          )}

          {stepResults.length === 0 && commandOutputs.length === 0 && cases.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No detail data available for this run.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, valueColor = "text-gray-800" }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-semibold truncate mt-0.5 ${valueColor}`}>{value ?? "-"}</div>
    </div>
  );
}

// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
// Main component
// â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
export default function TestingAgent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = ["settings", "history", "profiles"].includes(searchParams.get("section"))
    ? searchParams.get("section")
    : "";
  const [_settings, setSettings] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [taskSearch, setTaskSearch] = useState("");
  const [taskOptions, setTaskOptions] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState("");

  // run mode: "auto" | "guided" | "multi" | "cli"
  const [runMode, setRunMode] = useState(
    ["auto", "guided", "deep", "multi", "cli"].includes(searchParams.get("mode"))
      ? searchParams.get("mode")
      : "auto"
  );
  const [running, setRunning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [liveRunId, setLiveRunId] = useState(null);

  // Auto-discover state
  const [autoUrl, setAutoUrl] = useState("");
  const [autoResult, setAutoResult] = useState(null);

  // Guided browser state
  const [browserInstructions, setBrowserInstructions] = useState("");

  // Multi-scenario state
  const [multiDescription, setMultiDescription] = useState("");
  const [multiUrl, setMultiUrl] = useState("");
  const [multiResult, setMultiResult] = useState(null);

  // Deep Test state
  const [deepInstructions, setDeepInstructions] = useState("");

  const [historySearch, setHistorySearch] = useState("");
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState("");

  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesSearch, setProfilesSearch] = useState("");
  const [profileEdits, setProfileEdits] = useState({});
  const [savingProfileId, setSavingProfileId] = useState("");

  const selectedTask = useMemo(() => taskOptions.find((t) => t.id === selectedTaskId) || null, [taskOptions, selectedTaskId]);
  const stats = useMemo(() => ({
    passed: runs.filter((r) => r.status === "passed").length,
    failed: runs.filter((r) => r.status === "failed").length,
    blocked: runs.filter((r) => r.status === "blocked").length,
    total: pagination.total,
  }), [runs, pagination.total]);

  async function loadSettings() {
    try {
      const res = await api.get("/testing-agent/settings");
      setSettings(res.data);
      setSettingsDraft({
        enabled: Boolean(res.data?.enabled),
        auto_generate_on_git: Boolean(res.data?.auto_generate_on_git),
        auto_run_on_git: Boolean(res.data?.auto_run_on_git),
        max_runtime_seconds: Number(res.data?.max_runtime_seconds || 900),
        test_commands: Array.isArray(res.data?.test_commands) ? res.data.test_commands.join("\n") : "",
      });
    } catch { toast.error("Failed to load testing settings"); }
  }

  async function saveSettings() {
    if (!settingsDraft) return;
    setSavingSettings(true);
    try {
      const commands = String(settingsDraft.test_commands || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const res = await api.put("/testing-agent/settings", {
        enabled: Boolean(settingsDraft.enabled),
        autoGenerateOnGit: Boolean(settingsDraft.auto_generate_on_git),
        autoRunOnGit: Boolean(settingsDraft.auto_run_on_git),
        maxRuntimeSeconds: Number(settingsDraft.max_runtime_seconds || 900),
        testCommands: commands,
      });
      setSettings(res.data);
      setSettingsDraft({
        enabled: Boolean(res.data?.enabled), auto_generate_on_git: Boolean(res.data?.auto_generate_on_git),
        auto_run_on_git: Boolean(res.data?.auto_run_on_git), max_runtime_seconds: Number(res.data?.max_runtime_seconds || 900),
        test_commands: Array.isArray(res.data?.test_commands) ? res.data.test_commands.join("\n") : "",
      });
      toast.success("Settings saved");
    } catch (err) { toast.error(err?.response?.data?.error || "Failed to save settings"); }
    finally { setSavingSettings(false); }
  }

  async function loadTaskOptions(search = "") {
    try {
      const res = await api.get("/testing-agent/tasks/options", { params: { search, limit: 30 } });
      setTaskOptions(Array.isArray(res.data) ? res.data : []);
    } catch { /* silent */ }
  }

  const loadRuns = useCallback(async (page = 1, search = "") => {
    setHistoryLoading(true);
    try {
      const res = await api.get("/testing-agent/runs", { params: { page, limit: 20, search: search || undefined } });
      setRuns(res.data?.items || []);
      setPagination((prev) => res.data?.pagination || prev);
    } catch { toast.error("Failed to load test run history"); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); loadRuns(1, ""); loadProfiles(""); }, [loadRuns]);
  useEffect(() => { const t = setTimeout(() => loadTaskOptions(taskSearch), 250); return () => clearTimeout(t); }, [taskSearch]);
  useEffect(() => { const t = setTimeout(() => loadProfiles(profilesSearch), 300); return () => clearTimeout(t); }, [profilesSearch]);
  useEffect(() => { const t = setTimeout(() => loadRuns(1, historySearch), 400); return () => clearTimeout(t); }, [historySearch, loadRuns]);
  useEffect(() => { setPreviewData(null); setPreviewError(""); }, [runMode, selectedTaskId]);

  function applyAutoTemplate(item) {
    setAutoUrl(item.value || "");
  }

  function applyGuidedTemplate(item) {
    setBrowserInstructions(item.value || "");
  }

  function applyMultiTemplate(item) {
    setMultiDescription(item.description || "");
    setMultiUrl(item.url || "");
  }

  function applyDeepTemplate(item) {
    setDeepInstructions(item.value || "");
  }

  async function loadProfiles(search = "") {
    setProfilesLoading(true);
    try {
      const res = await api.get("/testing-agent/projects/profiles", { params: { search: search || undefined } });
      const list = Array.isArray(res.data) ? res.data : [];
      setProfiles(list);
      const edits = {};
      list.forEach((p) => {
        edits[p.projectId] = { repoPath: p.repoPath || "", framework: p.framework || "", commands: Array.isArray(p.commands) ? p.commands.join("\n") : "", enabled: p.enabled !== false };
      });
      setProfileEdits(edits);
    } catch { toast.error("Failed to load project profiles"); }
    finally { setProfilesLoading(false); }
  }

  // â"€â"€ Actions â"€â"€
  async function handleSmartTest() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!autoUrl.trim().startsWith("http")) { toast.error("Enter a valid URL starting with http"); return; }
    setRunning(true); setLiveRunId(null); setAutoResult(null);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/browser-run`, { url: autoUrl.trim(), timeoutMs: 0 });
      if (res.data?.runId && res.data?.status === "running") {
        setLiveRunId(res.data.runId);
      } else {
        setAutoResult(res.data);
        const s = res.data?.status;
        const rep = res.data?.report || res.data?.output_json?.report;
        if (s === "passed") toast.success(`Smart test passed — ${rep?.passed ?? "?"}/${rep?.total ?? "?"} checks`);
        else toast.error(`Smart test found issues — ${rep?.failed ?? "?"} check(s) failed`, { duration: 5000 });
        await loadRuns(1, historySearch);
        setRunning(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.details || err?.response?.data?.error || "Smart test failed", { duration: 6000 });
      setRunning(false);
    }
  }

  async function handleAutoDiscover() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!autoUrl.trim().startsWith("http")) { toast.error("Enter a valid URL starting with http"); return; }
    setRunning(true); setLiveRunId(null); setAutoResult(null);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/auto-discover`, { url: autoUrl.trim(), timeoutMs: 0 });
      if (res.data?.runId && res.data?.status === "running") {
        setLiveRunId(res.data.runId);
      } else {
        setAutoResult(res.data);
        const s = res.data?.status;
        if (s === "passed") toast.success(`Auto-test passed - ${res.data.summary?.passed}/${res.data.summary?.total} steps`);
        else toast.error(`Auto-test found issues - ${res.data.summary?.failed} step(s) failed`, { duration: 5000 });
        await loadRuns(1, historySearch);
        setRunning(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.details || err?.response?.data?.error || "Auto-discover failed", { duration: 6000 });
      setRunning(false);
    }
  }

  async function previewAutoDiscover() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!autoUrl.trim().startsWith("http")) { toast.error("Enter a valid URL starting with http"); return; }
    setPreviewLoading(true); setPreviewError("");
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/auto-discover-preview`, { url: autoUrl.trim() });
      setPreviewData(res.data);
    } catch (err) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || "Failed to build preview";
      setPreviewError(msg);
      toast.error(msg);
    } finally { setPreviewLoading(false); }
  }

  async function handleBrowserRun() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!browserInstructions.trim()) { toast.error("Enter test instructions first"); return; }
    setRunning(true); setLiveRunId(null);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/browser-run`, { instructions: browserInstructions.trim(), timeoutMs: 0 });
      if (res.data?.runId && res.data?.status === "running") {
        // Async mode â€" live panel takes over
        setLiveRunId(res.data.runId);
        // running stays true; onFinished callback will clear it
      } else {
        // Legacy sync response
        const { status, summary } = res.data;
        if (status === "passed") toast.success(`Browser test passed - ${summary?.passed || 0}/${summary?.total || 0} steps`);
        else toast.error(`Browser test failed - ${summary?.failed || 0} step(s) failed`, { duration: 5000 });
        await loadRuns(1, historySearch);
        setRunning(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.details || err?.response?.data?.error || "Browser run failed", { duration: 6000 });
      setRunning(false);
    }
  }

  async function previewBrowser() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!browserInstructions.trim()) { toast.error("Enter test instructions first"); return; }
    setPreviewLoading(true); setPreviewError("");
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/browser-preview`, { instructions: browserInstructions.trim() });
      setPreviewData(res.data);
      if (res.data?.mode === "deep_exploration") setRunMode("deep");
    } catch (err) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || "Failed to build preview";
      setPreviewError(msg);
      toast.error(msg);
    } finally { setPreviewLoading(false); }
  }

  async function handleMultiScenario() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!multiDescription.trim()) { toast.error("Enter a feature description first"); return; }
    setRunning(true); setMultiResult(null); setLiveRunId(null);
    let liveStarted = false;
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/multi-scenario`, {
        description: multiDescription.trim(),
        url: multiUrl.trim() || null,
        timeoutMs: 0,
      });
      if (res.data?.runId && res.data?.status === "running") { liveStarted = true; setLiveRunId(res.data.runId); return; }
      setMultiResult(res.data);
      const os = res.data?.overallStatus;
      if (os === "passed") toast.success(`All ${res.data.summary?.total} scenarios passed`);
      else if (os === "partial") toast(`${res.data.summary?.passed} of ${res.data.summary?.total} scenarios passed`);
      else if (os === "cancelled") toast("Multi-scenario run stopped"); else toast.error(`Scenario run found issues - ${res.data.summary?.failed ?? "?"} scenario(s) failed`, { duration: 5000 });
      await loadRuns(1, historySearch);
    } catch (err) { toast.error(err?.response?.data?.details || err?.response?.data?.error || "Multi-scenario run failed", { duration: 6000 }); } finally { if (!liveStarted) setRunning(false); }
  }

  async function previewMultiScenario() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!multiDescription.trim()) { toast.error("Enter a feature description first"); return; }
    setPreviewLoading(true); setPreviewError("");
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/multi-scenario-preview`, {
        description: multiDescription.trim(),
        url: multiUrl.trim() || null,
      });
      setPreviewData(res.data);
    } catch (err) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || "Failed to build preview";
      setPreviewError(msg);
      toast.error(msg);
    } finally { setPreviewLoading(false); }
  }

  async function handleDeepTest() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!deepInstructions.trim()) { toast.error("Enter instructions with a URL and credentials"); return; }
    if (!deepInstructions.includes("http")) { toast.error("Instructions must include a URL (https://...)"); return; }
    setRunning(true); setLiveRunId(null);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/deep-explore`, {
        instructions: deepInstructions.trim(),
        timeoutMs: 0,
      });
      if (res.data?.runId && res.data?.status === "running") {
        setLiveRunId(res.data.runId);
        // running stays true; onFinished will clear it
      } else {
        // sync fallback
        const { status, summary } = res.data;
        if (status === "passed") toast.success(`Deep test passed - ${summary?.modules} modules, ${summary?.passed}/${summary?.total} steps`);
        else toast.error(`Deep test done - ${summary?.failed} step(s) failed`, { duration: 5000 });
        await loadRuns(1, historySearch);
        setRunning(false);
      }
    } catch (err) {
      toast.error(err?.response?.data?.details || err?.response?.data?.error || "Deep test failed", { duration: 6000 });
      setRunning(false);
    }
  }

  async function previewDeepTest() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    if (!deepInstructions.trim()) { toast.error("Enter instructions with a URL and credentials"); return; }
    setPreviewLoading(true); setPreviewError("");
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/deep-explore-preview`, {
        instructions: deepInstructions.trim(),
      });
      setPreviewData(res.data);
    } catch (err) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || "Failed to build preview";
      setPreviewError(msg);
      toast.error(msg);
    } finally { setPreviewLoading(false); }
  }

  async function handleGenerate() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    setGenerating(true);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/generate`);
      toast.success(`${res.data?.generatedCases?.length || 0} task-specific test cases generated`);
      await loadRuns(1, historySearch);
    } catch (err) { toast.error(err?.response?.data?.details || "Generation failed"); }
    finally { setGenerating(false); }
  }

  async function handleCliRun() {
    if (!selectedTaskId) { toast.error("Select a task first"); return; }
    setRunning(true);
    try {
      const res = await api.post(`/testing-agent/tasks/${selectedTaskId}/run`);
      const status = String(res.data?.status || "").toLowerCase();
      const reason = res.data?.output?.summary?.failureReason;
      if (status === "passed") toast.success("All tests passed");
      else if (status === "blocked") toast.error(reason || "Blocked: configure test commands in Project Execution Profiles below", { duration: 6000 });
      else toast.error(reason || `Tests ${status || "failed"}`, { duration: 5000 });
      await loadRuns(1, historySearch);
    } catch (err) {
      const msg = err?.response?.data?.details || err?.response?.data?.error || "Run failed";
      toast.error(msg, { duration: 6000 });
      if (msg.toLowerCase().includes("repository path") || msg.toLowerCase().includes("profile")) {
        document.getElementById("project-profiles-section")?.scrollIntoView({ behavior: "smooth" });
      }
    } finally { setRunning(false); }
  }

  async function openRun(runId) {
    try {
      const res = await api.get(`/testing-agent/runs/${runId}`);
      setSelectedRun(res.data);
    } catch { toast.error("Failed to load run details"); }
  }

  async function saveProfile(projectId) {
    const edit = profileEdits[projectId];
    if (!edit) return;
    setSavingProfileId(projectId);
    try {
      await api.put(`/testing-agent/projects/${projectId}/profile`, {
        repoPath: edit.repoPath || null, framework: edit.framework || null,
        commands: String(edit.commands || "").split("\n").map((x) => x.trim()).filter(Boolean),
        enabled: edit.enabled !== false,
      });
      toast.success("Profile saved");
      await loadProfiles(profilesSearch);
    } catch (err) { toast.error(err?.response?.data?.details || "Failed to save profile"); }
    finally { setSavingProfileId(""); }
  }

  // â"€â"€ RENDER â"€â"€
  const TABS = [
    { key: "auto",   label: "Recon & Smoke",  Icon: Wand2,    desc: "Scan a live page and run a grounded smoke plan" },
    { key: "guided", label: "Scenario Run",   Icon: Globe,    desc: "Run a tester-defined workflow with proof after each step" },
    { key: "deep",   label: "Product Audit",  Icon: Eye,      desc: "Authenticate, map the product, and audit modules end to end" },
    { key: "multi",  label: "Coverage Sweep", Icon: Layers,   desc: "Happy path, errors, edge cases, and performance" },
    { key: "cli",    label: "Repository Run", Icon: Terminal, desc: "Execute repo commands and attach run evidence" },
  ];

  useEffect(() => {
    if (!["auto", "guided", "deep", "multi", "cli"].includes(runMode)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("mode", runMode);
      return next;
    }, { replace: true });
  }, [runMode, setSearchParams]);

  useEffect(() => {
    const targetId = {
      settings: "testing-agent-settings-section",
      history: "testing-agent-history-section",
      profiles: "project-profiles-section",
    }[requestedSection];

    if (!targetId) return;

    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [requestedSection]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold theme-text">Testing Agent</h1>
          <p className="text-sm theme-text-muted">Evidence-first browser and repository testing with reproducible runs, previews, and reports.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Runs"  value={stats.total}   color="blue"  icon={<Cpu className="w-5 h-5" />} />
        <StatCard label="Passed"      value={stats.passed}  color="green" icon={<CheckCircle2 className="w-5 h-5" />} />
        <StatCard label="Failed"      value={stats.failed}  color="red"   icon={<XCircle className="w-5 h-5" />} />
        <StatCard label="Blocked"     value={stats.blocked} color="amber" icon={<AlertTriangle className="w-5 h-5" />} />
      </div>

      {/* Settings + Run panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Settings */}
        <div id="testing-agent-settings-section" className="xl:col-span-2 theme-surface border theme-border rounded-xl p-5">
          <h2 className="font-semibold theme-text flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 theme-text-muted" /> Automation Settings
          </h2>
          {!settingsDraft ? <p className="text-sm theme-text-muted">Loading...</p> : (
            <div className="space-y-1 divide-y theme-border">
              <Toggle label="Enable testing agent" description="Master switch." checked={settingsDraft.enabled} onChange={(v) => setSettingsDraft((p) => ({ ...p, enabled: v }))} />
              <Toggle label="Auto-generate test cases on Git push" description="Generate cases when a Git-linked task is updated." checked={settingsDraft.auto_generate_on_git} onChange={(v) => setSettingsDraft((p) => ({ ...p, auto_generate_on_git: v }))} />
              <Toggle label="Auto-run CLI tests on Git push" description="Execute CLI tests automatically (requires repo path per project)." checked={settingsDraft.auto_run_on_git} onChange={(v) => setSettingsDraft((p) => ({ ...p, auto_run_on_git: v }))} />
              <div className="pt-3 space-y-3">
                <div>
                  <label className="block text-xs font-medium theme-text-muted mb-1">Max CLI runtime per command (seconds)</label>
                  <input type="number" min={30} max={3600} value={settingsDraft.max_runtime_seconds}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, max_runtime_seconds: Number(e.target.value || 900) }))}
                    className="w-40 px-3 py-2 rounded-lg theme-input border theme-border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium theme-text-muted mb-1">Fallback CLI test commands <span className="theme-text-soft">(one per line)</span></label>
                  <textarea rows={3} value={settingsDraft.test_commands}
                    onChange={(e) => setSettingsDraft((p) => ({ ...p, test_commands: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg theme-input border theme-border font-mono text-sm"
                    placeholder={"npm test -- --runInBand\nnpm run test:e2e"}
                  />
                </div>
                <button onClick={saveSettings} disabled={savingSettings}
                  className="px-4 py-2 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2 text-sm"
                >
                  <Save className="w-4 h-4" />{savingSettings ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Run panel */}
        <div className="theme-surface border theme-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold theme-text flex items-center gap-2">
            <FileCode2 className="w-4 h-4 theme-text-muted" /> Manual Test Run
          </h2>

          {/* Task picker */}
          <div className="relative">
            <Search className="w-4 h-4 theme-text-soft absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Search task / project / assignee"
              className="w-full pl-9 pr-3 py-2 rounded-lg theme-input border theme-border text-sm"
            />
          </div>
          <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm"
          >
            <option value="">Select a task...</option>
            {taskOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.taskKey ? `[${t.taskKey}] ` : ""}{t.task} - {t.projectName}
              </option>
            ))}
          </select>
          {selectedTask && (
            <div className="text-xs theme-text-muted theme-surface-soft rounded-lg p-2">
              Status: <b>{selectedTask.status || "n/a"}</b> - Priority: <b>{selectedTask.priority || "n/a"}</b>
              {selectedTask.assigneeName && <> - Assignee: <b>{selectedTask.assigneeName}</b></>}
            </div>
          )}

          {/* Mode tabs â€" 5 tabs */}
          <div className="grid grid-cols-3 gap-1.5">
            {TABS.map((tab) => {
              const TabIcon = tab.Icon;
              return (
                <button key={tab.key} onClick={() => setRunMode(tab.key)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-colors ${runMode === tab.key ? "theme-primary text-white shadow" : "theme-surface-soft theme-text-muted hover:opacity-90"}`}
                >
                  <TabIcon className="w-3.5 h-3.5" />{tab.label}
                </button>
              );
            })}
          </div>

          <RunPrepPanel
            mode={runMode}
            selectedTask={selectedTask}
            values={{ autoUrl, browserInstructions, multiDescription, multiUrl, deepInstructions }}
          />

          {/* â"€â"€ AUTO-TEST TAB â"€â"€ */}
          {runMode === "auto" && (
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg px-3 py-2">
                <p className="text-xs text-emerald-700 font-semibold">DOM-first smart test</p>
                <p className="text-xs text-emerald-600 mt-0.5">Paste a URL. The agent reads the real DOM, clicks every button, fills every form, and follows every link — no LLM guessing, zero hallucination.</p>
              </div>
              <label className="block text-xs font-medium theme-text-muted">URL to test</label>
              <input
                value={autoUrl}
                onChange={(e) => setAutoUrl(e.target.value)}
                placeholder="https://myapp.com"
                className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm"
              />
              <QuickTemplateBar items={RUN_MODE_TEMPLATES.auto} onSelect={applyAutoTemplate} />
              <div className="flex gap-2">
                <button onClick={handleSmartTest} disabled={running || !selectedTaskId || !autoUrl.trim()}
                  className="flex-1 px-3 py-2.5 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm shadow"
                >
                  <Wand2 className="w-4 h-4" />
                  {running ? "Testing..." : "Run Smart Test"}
                </button>
              </div>
              <p className="text-xs theme-text-soft">If the agent hits a login wall, it will pause and ask you for credentials live. You will see a modal to enter them and the run continues.</p>
              {liveRunId && <LiveRunPanel key={liveRunId} runId={liveRunId} onFinished={(run) => {
                setRunning(false);
                const s = run?.status;
                const rep = run?.output_json?.report;
                if (s === "cancelled") toast("Smart test stopped");
                else if (s === "passed") toast.success(`Smart test passed — ${rep?.passed ?? "?"}/${rep?.total ?? "?"} checks across ${rep?.pagesVisited ?? "?"} pages`, { duration: 5000 });
                else toast.error(`Smart test found issues — ${rep?.failed ?? "?"} check(s) failed`, { duration: 5000 });
                loadRuns(1, historySearch);
              }} />}
              {autoResult && !running && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge value={autoResult.status} large />
                    <span className="text-xs theme-text-muted">{autoResult.report?.passed ?? autoResult.summary?.passed}/{autoResult.report?.total ?? autoResult.summary?.total} passed</span>
                  </div>
                  {autoResult.report && <SmartBrowserReportPanel report={autoResult.report} />}
                </div>
              )}
            </div>
          )}

          {/* â"€â"€ GUIDED TEST TAB â"€â"€ */}
          {runMode === "guided" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium theme-text-muted">Test instructions</label>
              <textarea
                value={browserInstructions}
                onChange={(e) => setBrowserInstructions(e.target.value)}
                rows={5}
                placeholder={"go to https://myapp.com, click Login, enter admin@test.com / pass123, verify dashboard shows"}
                className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm resize-none"
              />
              <QuickTemplateBar items={RUN_MODE_TEMPLATES.guided} onSelect={applyGuidedTemplate} />
              <div className="flex gap-2">
                <button onClick={previewBrowser} disabled={previewLoading || running || !selectedTaskId || !browserInstructions.trim()}
                  className="flex-1 px-3 py-2 rounded-lg border theme-border theme-surface-soft font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm theme-text"
                >
                  <FileText className="w-4 h-4" />
                  {previewLoading ? "Previewing..." : "Preview Plan"}
                </button>
                <button onClick={handleBrowserRun} disabled={running || !selectedTaskId || !browserInstructions.trim()}
                  className="flex-1 px-3 py-2 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm"
                >
                  <Globe className="w-4 h-4" />
                  {running ? "Executing scenario..." : "Run Scenario"}
                </button>
              </div>
              <p className="text-xs theme-text-soft">Use this for a specific workflow you want reproduced exactly, with evidence after each meaningful state change.</p>
              <MissionPreviewPanel preview={previewData} loading={previewLoading} error={previewError} />
              {liveRunId && <LiveRunPanel key={liveRunId} runId={liveRunId} onFinished={(run) => {
                setRunning(false);
                const s = run?.status;
                const sum = run?.output_json?.summary;
                if (s === "cancelled") toast("Scenario run stopped"); else if (s === "passed") toast.success(`Scenario run passed - ${sum?.passed ?? "?"}/${sum?.total ?? "?"} steps`); else toast.error(`Scenario run finished - ${sum?.failed ?? "?"} step(s) failed`, { duration: 5000 });
                loadRuns(1, historySearch);
              }} />}
            </div>
          )}

          {/* â"€â"€ MULTI-SCENARIO TAB â"€â"€ */}
          {runMode === "multi" && (
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg px-3 py-2">
                <p className="text-xs text-orange-700 font-semibold">Coverage sweep</p>
                <p className="text-xs text-orange-600 mt-0.5">Build a four-angle plan before launch: happy path, handled failures, edge cases, and performance.</p>
              </div>
              <label className="block text-xs font-medium theme-text-muted">Feature / app description</label>
              <textarea
                value={multiDescription}
                onChange={(e) => setMultiDescription(e.target.value)}
                rows={3}
                placeholder="Login flow for an e-commerce app at https://myapp.com"
                className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm resize-none"
              />
              <label className="block text-xs font-medium theme-text-muted">Base URL (optional)</label>
              <input
                value={multiUrl}
                onChange={(e) => setMultiUrl(e.target.value)}
                placeholder="https://myapp.com"
                className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm"
              />
              <QuickTemplateBar items={RUN_MODE_TEMPLATES.multi} onSelect={applyMultiTemplate} />
              <div className="flex gap-2">
                <button onClick={previewMultiScenario} disabled={previewLoading || running || !selectedTaskId || !multiDescription.trim()}
                  className="flex-1 px-3 py-2.5 rounded-lg border theme-border theme-surface-soft font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm theme-text"
                >
                  <FileText className="w-4 h-4" />
                  {previewLoading ? "Previewing..." : "Preview Coverage"}
                </button>
                <button onClick={handleMultiScenario} disabled={running || !selectedTaskId || !multiDescription.trim()}
                  className="flex-1 px-3 py-2.5 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm shadow"
                >
                  <Layers className="w-4 h-4" />
                  {running ? "Running coverage..." : "Run Coverage Sweep"}
                </button>
              </div>
              <p className="text-xs theme-text-soft">Each scenario runs separately so you can see which testing angle failed and why.</p>
              <MissionPreviewPanel preview={previewData} loading={previewLoading} error={previewError} />
              {liveRunId && <LiveRunPanel key={liveRunId} runId={liveRunId} onFinished={(run) => { setRunning(false); const output = run?.output_json || {}; const result = { description: output.description || multiDescription.trim(), scenarios: Array.isArray(output.scenarios) ? output.scenarios : [], overallStatus: output.overallStatus || run?.status || "failed", summary: output.summary || {}, }; setMultiResult(result); const os = result.overallStatus; if (run?.status === "cancelled" || os === "cancelled") toast("Coverage sweep stopped"); else if (os === "passed") toast.success(`All ${result.summary?.total ?? "?"} scenarios passed`); else if (os === "partial") toast(`${result.summary?.passed ?? 0} of ${result.summary?.total ?? "?"} scenarios passed`); else toast.error(`Coverage sweep found issues - ${result.summary?.failed ?? "?"} scenario(s) failed`, { duration: 5000 }); loadRuns(1, historySearch); }} />}
              {multiResult && !running && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <StatusBadge value={multiResult.overallStatus} large />
                    <span className="text-xs theme-text-muted">{multiResult.summary?.passed}/{multiResult.summary?.total} scenarios passed</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {(multiResult.scenarios || []).map((s) => (
                      <ScenarioCard key={s.type} scenario={s} onViewDetails={openRun} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* â"€â"€ DEEP TEST TAB â"€â"€ */}
          {runMode === "deep" && (
            <div className="space-y-2">
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-violet-700 font-semibold">Product audit</p>
                <div className="text-xs text-violet-600 space-y-0.5">
                  <p><span className="font-semibold">Phase 1:</span> Authenticate and map reachable product surface.</p>
                  <p><span className="font-semibold">Phase 2:</span> Build module-level tests from real DOM and workflow evidence.</p>
                  <p><span className="font-semibold">Phase 3:</span> Execute the audit and produce a usable QA report.</p>
                </div>
              </div>

              <label className="block text-xs font-medium theme-text-muted">Instructions <span className="theme-text-soft font-normal">(include URL and credentials)</span></label>
              <textarea
                value={deepInstructions}
                onChange={(e) => setDeepInstructions(e.target.value)}
                rows={5}
                placeholder={`Go to https://myapp.com\nLogin with email: user@example.com password: Test@1234\nExplore all modules and test every single feature`}
                className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm resize-none font-mono"
              />
              <QuickTemplateBar items={RUN_MODE_TEMPLATES.deep} onSelect={applyDeepTemplate} />

              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-1">
                <p className="text-xs text-amber-700 font-semibold">Tips for best results</p>
                <ul className="text-xs text-amber-600 space-y-0.5 list-disc list-inside">
                  <li>Include the full URL with <code className="bg-amber-100 px-1 rounded">https://</code></li>
                  <li>Include login credentials if the app requires authentication</li>
                  <li>Say "test all modules" or "explore every feature" to trigger deep mode</li>
                  <li>Runs can take 5-15 minutes for large apps - live progress shows below</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={previewDeepTest}
                  disabled={previewLoading || running || !selectedTaskId || !deepInstructions.trim()}
                  className="flex-1 px-3 py-2.5 rounded-lg border theme-border theme-surface-soft font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm theme-text"
                >
                  <FileText className="w-4 h-4" />
                  {previewLoading ? "Previewing..." : "Preview Audit"}
                </button>
                <button
                  onClick={handleDeepTest}
                  disabled={running || !selectedTaskId || !deepInstructions.trim()}
                  className="flex-1 px-3 py-2.5 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-2 text-sm shadow"
                >
                  <Eye className="w-4 h-4" />
                  {running ? "Running audit..." : "Start Product Audit"}
                </button>
              </div>
              <MissionPreviewPanel preview={previewData} loading={previewLoading} error={previewError} />

              {liveRunId && (
                <LiveRunPanel
                  key={liveRunId}
                  runId={liveRunId}
                  onFinished={(run) => {
                    setRunning(false);
                    const s = run?.status;
                    const sum = run?.output_json?.summary;
                    if (s === "cancelled") {
                      toast("Product audit stopped");
                      loadRuns(1, historySearch);
                      return;
                    }
                    const modules = sum?.modules ?? "?";
                    const bugs = sum?.bugsFound ?? 0;
                    const score = sum?.overallHealthScore;
                    if (s === "passed") toast.success(`Product audit complete - ${modules} modules, ${bugs} bugs found, health ${score ?? "?"}/10`, { duration: 6000 });
                    else toast.error(`Product audit finished - ${bugs} bugs, ${sum?.failed ?? "?"} failures across ${modules} modules`, { duration: 6000 });
                    loadRuns(1, historySearch);
                  }}
                />
              )}
            </div>
          )}

          {/* â"€â"€ CLI TAB â"€â"€ */}
          {runMode === "cli" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={generating || !selectedTaskId}
                  className="flex-1 px-3 py-2 rounded-lg border theme-border theme-surface-soft font-semibold hover:opacity-90 disabled:opacity-50 text-sm theme-text"
                >
                  {generating ? "Generating..." : "Generate Cases"}
                </button>
                <button onClick={handleCliRun} disabled={running || !selectedTaskId}
                  className="flex-1 px-3 py-2 rounded-lg theme-primary text-white font-semibold disabled:opacity-50 inline-flex justify-center items-center gap-1.5 text-sm"
                >
                  <Play className="w-4 h-4" />{running ? "Running..." : "Run Tests"}
                </button>
              </div>
              <p className="text-xs theme-text-soft">"Generate Cases" uses AI to create task-specific test scenarios. "Run Tests" executes CLI commands - requires repo path in Project Execution Profiles below.</p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <p className="text-sm font-semibold text-blue-900">Tester experience goals</p>
        <p className="mt-1 text-sm text-blue-800">
          Every run should make its intent visible before launch, prove state changes while executing, and leave behind usable evidence for the next person.
        </p>
      </div>

      {/* Run History */}
      <div id="testing-agent-history-section" className="theme-surface border theme-border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold theme-text">Run History</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 theme-text-soft absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search task / project" className="pl-8 pr-3 py-2 rounded-lg theme-input border theme-border text-sm"
              />
            </div>
            <button onClick={() => loadRuns(pagination.page, historySearch)}
              className="px-3 py-2 rounded-lg border theme-border theme-surface-soft hover:opacity-90 inline-flex items-center gap-1 text-sm theme-text"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        {historyLoading ? (
          <div className="text-sm theme-text-muted py-10 text-center">Loading history...</div>
        ) : runs.length === 0 ? (
          <div className="text-center py-10">
            <Beaker className="w-10 h-10 theme-text-soft mx-auto mb-2" />
            <p className="text-sm theme-text-muted">No runs yet. Select a task and start an Auto-Test or browser test.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs theme-text-muted border-b theme-border">
                  <th className="pb-2 px-3">Date</th>
                  <th className="pb-2 px-3">Task</th>
                  <th className="pb-2 px-3">Project</th>
                  <th className="pb-2 px-3">Mode</th>
                  <th className="pb-2 px-3">Status</th>
                  <th className="pb-2 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t theme-border hover:bg-[var(--surface-soft)]">
                    <td className="px-3 py-2.5 theme-text-muted whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2.5 font-medium theme-text max-w-[180px] truncate">{r.task_name || "-"}</td>
                    <td className="px-3 py-2.5 theme-text-muted">{r.project_name || "-"}</td>
                    <td className="px-3 py-2.5">{modeBadge(r.mode)}</td>
                    <td className="px-3 py-2.5"><StatusBadge value={r.status} /></td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => openRun(r.id)} className="px-2.5 py-1 rounded-lg border theme-border hover:bg-[var(--surface-soft)] text-xs font-medium theme-text-muted">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 text-sm theme-text-muted">
          <div>{pagination.total} total runs - page {pagination.page} / {pagination.totalPages}</div>
          <div className="flex gap-2">
            <button onClick={() => loadRuns(Math.max(1, pagination.page - 1), historySearch)} disabled={!pagination.hasPrev} className="px-3 py-1.5 rounded-lg border theme-border disabled:opacity-40 hover:bg-[var(--surface-soft)] theme-text">Previous</button>
            <button onClick={() => loadRuns(pagination.page + 1, historySearch)} disabled={!pagination.hasNext} className="px-3 py-1.5 rounded-lg border theme-border disabled:opacity-40 hover:bg-[var(--surface-soft)] theme-text">Next</button>
          </div>
        </div>
      </div>

      {/* Project Execution Profiles */}
      <div id="project-profiles-section" className="theme-surface border theme-border rounded-xl p-5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div>
            <h2 className="font-semibold theme-text">Project Execution Profiles</h2>
            <p className="text-xs theme-text-muted mt-0.5">Needed only for CLI test runs. Set the repo path and commands per project.</p>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 theme-text-soft absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={profilesSearch} onChange={(e) => setProfilesSearch(e.target.value)} placeholder="Search project"
              className="pl-8 pr-3 py-2 rounded-lg theme-input border theme-border text-sm"
            />
          </div>
        </div>

        {profilesLoading ? (
          <div className="text-sm theme-text-muted py-6">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="text-sm theme-text-muted py-6 text-center">No projects found.</div>
        ) : (
          <div className="space-y-3 mt-4">
            {profiles.map((p) => {
              const edit = profileEdits[p.projectId] || { repoPath: "", framework: "", commands: "", enabled: true };
              return (
                <div key={p.projectId} className="border theme-border rounded-xl p-4 theme-surface-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="font-semibold text-sm theme-text">{p.projectName}{p.projectCode ? ` (${p.projectCode})` : ""}</div>
                      <div className="text-xs theme-text-muted flex items-center gap-2 mt-0.5">
                        {p.repoFullName && <><GitBranch className="w-3 h-3" />{p.repoFullName}</>}
                        <span className={p.repoPathExists ? "text-green-600 font-medium" : "text-red-500"}>
                          {p.repoPathExists ? "path found" : "path not configured"}
                        </span>
                        {p.framework && p.framework !== "unknown" && <><span>-</span><span className="font-mono">{p.framework}</span></>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs theme-text-muted inline-flex items-center gap-2 cursor-pointer">
                        <button type="button"
                          onClick={() => setProfileEdits((prev) => ({ ...prev, [p.projectId]: { ...edit, enabled: !edit.enabled } }))}
                          className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${edit.enabled ? "theme-primary" : "theme-surface"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full theme-surface shadow transition-transform ${edit.enabled ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                        Enabled
                      </label>
                      <button onClick={() => saveProfile(p.projectId)} disabled={savingProfileId === p.projectId}
                        className="px-3 py-1.5 rounded-lg theme-primary text-white text-xs font-semibold disabled:opacity-50"
                      >
                        {savingProfileId === p.projectId ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Repo path (absolute)</label>
                      <input value={edit.repoPath}
                        onChange={(e) => setProfileEdits((prev) => ({ ...prev, [p.projectId]: { ...edit, repoPath: e.target.value } }))}
                        placeholder="e.g. C:\repos\my-project" className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs theme-text-muted mb-1">Framework</label>
                      <select value={edit.framework}
                        onChange={(e) => setProfileEdits((prev) => ({ ...prev, [p.projectId]: { ...edit, framework: e.target.value } }))}
                        className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm"
                      >
                        <option value="">Auto-detect</option>
                        <option value="node">Node.js</option>
                        <option value="python">Python</option>
                        <option value="go">Go</option>
                        <option value="maven">Java (Maven)</option>
                        <option value="gradle">Java (Gradle)</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs theme-text-muted mb-1">Test commands <span className="theme-text-soft">(one per line)</span></label>
                      <textarea value={edit.commands}
                        onChange={(e) => setProfileEdits((prev) => ({ ...prev, [p.projectId]: { ...edit, commands: e.target.value } }))}
                        rows={2} placeholder="npm test -- --runInBand"
                        className="w-full px-3 py-2 rounded-lg theme-input border theme-border text-sm font-mono"
                      />
                    </div>
                    {p.recommendedCommands?.length > 0 && (
                      <div className="md:col-span-2 text-xs theme-text-muted">
                        Detected: {p.recommendedCommands.map((c) => <code key={c} className="ml-1 px-1.5 py-0.5 theme-surface rounded font-mono">{c}</code>)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </div>
  );
}

function modeBadge(mode) {
  const map = {
    smart_browser:    { label: "Smart DOM Test",  Icon: Wand2,     cls: "bg-emerald-50 text-emerald-700" },
    browser:          { label: "Browser",         Icon: Globe,     cls: "bg-blue-50 text-blue-600" },
    auto_discover:    { label: "Auto-Discover",   Icon: Wand2,     cls: "bg-indigo-50 text-indigo-600" },
    multi_scenario:   { label: "Multi-Scenario",  Icon: Layers,    cls: "bg-orange-50 text-orange-600" },
    deep_exploration: { label: "Deep Explore",    Icon: Eye,       cls: "bg-violet-50 text-violet-600" },
    generate:         { label: "Generate",        Icon: Sparkles,  cls: "bg-purple-50 text-purple-600" },
    cli:              { label: "CLI",             Icon: Terminal,  cls: "bg-gray-100 text-gray-600" },
  };
  const m = map[mode] || map.cli;
  const Icon = m.Icon;
  return <span className={`inline-flex items-center gap-1 text-xs ${m.cls} px-2 py-0.5 rounded-full font-semibold`}><Icon className="w-3 h-3" />{m.label}</span>;
}

function StatCard({ label, value, color, icon }) {
  const colors = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600" };
  return (
    <div className="theme-surface border theme-border rounded-xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold theme-text">{value}</div>
        <div className="text-xs theme-text-muted">{label}</div>
      </div>
    </div>
  );
}

