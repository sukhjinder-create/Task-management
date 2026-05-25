import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles, Brain, Bot, FlaskConical, ArrowRight,
  Zap, TrendingUp, MessageSquare, ShieldCheck, Clock3, Stars, ChevronRight,
} from "lucide-react";

const FEATURES = [
  {
    id: "ai-features",
    path: "/ai-features",
    icon: Sparkles,
    title: "AI Productivity Tools",
    eyebrow: "Everyday boost",
    description: "Turn raw notes and quick prompts into structured work, sharper reports, and faster follow-through.",
    bullets: ["Meeting notes into tasks", "Risk heatmaps and smart digests", "Natural language task parsing"],
    stats: "4 workflow accelerators",
    roles: ["admin", "manager", "user"],
  },
  {
    id: "intelligence",
    path: "/intelligence",
    icon: Brain,
    title: "Strategic Intelligence",
    eyebrow: "Decision cockpit",
    description: "See workspace health, team momentum, and project signals in one place with AI-assisted analysis.",
    bullets: ["Workspace health overview", "Team and project analytics", "Ask AI for natural language answers"],
    stats: "Live workspace insights",
    roles: ["admin", "manager"],
  },
  {
    id: "autopilot",
    path: "/autopilot",
    icon: Bot,
    title: "AI Autopilot",
    eyebrow: "Runs in the background",
    description: "Automate assignment, deadline movement, escalation, and standup preparation without losing control.",
    bullets: ["Auto-assign and reprioritize", "Blocker escalation and action review", "Scheduled standup generation"],
    stats: "Executes every 4 hours",
    roles: ["admin"],
  },
  {
    id: "testing-agent",
    path: "/testing-agent",
    icon: FlaskConical,
    title: "AI Testing Agent",
    eyebrow: "Quality accelerator",
    description: "Generate and run browser and API tests with deeper app exploration grounded in the real UI.",
    bullets: ["Browser and API test flows", "Deep app exploration", "AI-generated scenarios from task context"],
    stats: "Playwright + LLM workflows",
    roles: ["admin", "manager"],
  },
];

const BACKGROUND_AI_FEATURES = [
  { icon: TrendingUp, label: "Monthly Performance Scoring", desc: "Automatic scoring with AI-generated reasoning for each workspace member." },
  { icon: MessageSquare, label: "Coaching Nudges", desc: "Personalized coaching prompts driven by performance patterns and momentum shifts." },
  { icon: Zap, label: "Admin Insights", desc: "Concise AI highlights delivered to admins so issues surface before they become blockers." },
  { icon: ShieldCheck, label: "Executive Summaries", desc: "Executive-ready summaries generated from live execution signals across the workspace." },
];

const HUB_SIGNALS = [
  { icon: Stars, label: "One clean AI entry point" },
  { icon: Clock3, label: "Faster discovery for every role" },
  { icon: ShieldCheck, label: "No route or permission changes" },
];

export default function AIHub() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const role = auth?.user?.role || "user";
  const visible = FEATURES.filter((f) => f.roles.includes(role));

  return (
    <div className="mx-auto max-w-6xl space-y-8">

      {/* ── Page header ── */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">
            Intelligence
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">
            AI Hub
          </h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            Every AI capability in your workspace, in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {HUB_SIGNALS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--text-muted)]"
            >
              <Icon className="h-3 w-3 text-[color:var(--primary)]" />
              {label}
            </div>
          ))}
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 max-w-sm">
        <div className="border border-[color:var(--border)] rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Available tools</p>
          <p className="mt-1.5 text-2xl font-semibold text-[color:var(--text)]">{visible.length}</p>
        </div>
        <div className="border border-[color:var(--border)] rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">Role access</p>
          <p className="mt-1.5 text-lg font-semibold capitalize text-[color:var(--text)]">{role}</p>
        </div>
      </div>

      {/* ── Launch tools ── */}
      <section>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[color:var(--text)]">Launch tools</h2>
          <p className="text-xs text-[color:var(--text-muted)] mt-0.5">Direct access to every AI workflow available for your role.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visible.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => navigate(feature.path)}
                className="group border border-[color:var(--border)] rounded-xl p-5 text-left transition-colors hover:bg-[var(--surface-soft)] hover:border-[color:var(--border-strong)]"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    Open
                    <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-soft)]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-1.5 text-base font-semibold text-[color:var(--text)]">{feature.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[color:var(--text-muted)]">{feature.description}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {feature.bullets.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2.5 py-0.5 text-[10px] font-medium text-[color:var(--text-muted)]"
                    >
                      <ChevronRight className="h-3 w-3" />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--border)] pt-3">
                  <p className="text-xs font-medium text-[color:var(--text-soft)]">{feature.stats}</p>
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Always-on AI ── */}
      {(role === "admin" || role === "manager") && (
        <section>
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[color:var(--text)]">Always-on AI</h2>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
              Background intelligence that keeps working even when you are not on these pages.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {BACKGROUND_AI_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="border border-[color:var(--border)] rounded-lg p-4 flex items-start gap-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--primary)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[color:var(--text)]">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
