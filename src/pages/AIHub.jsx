// src/pages/AIHub.jsx
// Central landing page that surfaces all AI capabilities in one place.
// Routes and permissions remain unchanged; this page is the single entry hub.

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Brain,
  Bot,
  FlaskConical,
  ArrowRight,
  Zap,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  Clock3,
  Stars,
  ChevronRight,
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
    palette: {
      base: "#0ea5e9",
      accent: "#0284c7",
    },
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
    palette: {
      base: "#8b5cf6",
      accent: "#7c3aed",
    },
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
    roles: ["admin", "manager"],
    palette: {
      base: "#10b981",
      accent: "#059669",
    },
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
    palette: {
      base: "#f59e0b",
      accent: "#d97706",
    },
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

function getFeatureStyles(color) {
  return {
    card: {
      background: `radial-gradient(circle at top right, color-mix(in srgb, ${color} 18%, transparent), transparent 36%), linear-gradient(135deg, color-mix(in srgb, var(--surface) 92%, ${color} 8%), color-mix(in srgb, var(--surface-soft) 84%, ${color} 16%))`,
      boxShadow: `0 24px 80px -36px color-mix(in srgb, ${color} 42%, transparent)`,
    },
    orb: {
      background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
      color: `color-mix(in srgb, ${color} 64%, var(--text) 36%)`,
      borderColor: `color-mix(in srgb, ${color} 24%, var(--border))`,
    },
    chip: {
      background: `color-mix(in srgb, ${color} 12%, var(--surface))`,
      color: `color-mix(in srgb, ${color} 52%, var(--text) 48%)`,
      borderColor: `color-mix(in srgb, ${color} 24%, var(--border))`,
    },
    openChip: {
      background: "color-mix(in srgb, var(--surface) 82%, transparent)",
      color: "var(--text-muted)",
      borderColor: "var(--border)",
    },
    accent: {
      background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 76%, white 24%))`,
    },
  };
}

export default function AIHub() {
  const navigate = useNavigate();
  const { auth } = useAuth();
  const role = auth?.user?.role || "user";

  const visible = FEATURES.filter((feature) => feature.roles.includes(role));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <section
        className="relative overflow-hidden rounded-[32px] border theme-border p-6 sm:p-8"
        style={{
          background:
            "radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 16%, transparent), transparent 34%), radial-gradient(circle at 80% 20%, color-mix(in srgb, #38bdf8 14%, transparent), transparent 32%), linear-gradient(135deg, color-mix(in srgb, var(--surface) 94%, var(--primary) 6%), color-mix(in srgb, var(--surface-soft) 88%, var(--surface) 12%))",
        }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-60">
          <div
            className="absolute -top-16 right-10 h-36 w-36 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, #38bdf8 15%, transparent)" }}
          />
          <div
            className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "color-mix(in srgb, var(--primary) 16%, transparent)" }}
          />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] shadow-sm"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in srgb, var(--surface) 82%, transparent)",
                color: "var(--text-muted)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
              AI Hub
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight theme-text sm:text-4xl">
              A single, cleaner home for every AI workflow in your workspace.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 theme-text-muted sm:text-base">
              Launch analysis, automation, testing, and productivity tools from one place. The underlying pages stay exactly as they are; this hub simply makes the experience feel more intentional.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {HUB_SIGNALS.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-sm"
                  style={{
                    borderColor: "var(--border)",
                    background: "color-mix(in srgb, var(--surface) 84%, transparent)",
                    color: "var(--text)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5 theme-text-muted" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div
              className="rounded-3xl border p-4 shadow-sm backdrop-blur"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in srgb, var(--surface) 88%, transparent)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Available tools</p>
              <p className="mt-2 text-3xl font-semibold theme-text">{visible.length}</p>
              <p className="mt-1 text-sm theme-text-muted">Visible for your role right now.</p>
            </div>
            <div
              className="rounded-3xl border p-4 shadow-sm backdrop-blur"
              style={{
                borderColor: "var(--border)",
                background: "color-mix(in srgb, var(--surface) 88%, transparent)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] theme-text-muted">Role access</p>
              <p className="mt-2 text-lg font-semibold capitalize theme-text">{role}</p>
              <p className="mt-1 text-sm theme-text-muted">Cards adapt to current permissions.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold theme-text">Launch tools</h2>
            <p className="mt-1 text-sm theme-text-muted">Direct access stays available through these cards only.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {visible.map((feature) => {
            const Icon = feature.icon;
            const styles = getFeatureStyles(feature.palette.base);

            return (
              <button
                key={feature.id}
                type="button"
                onClick={() => navigate(feature.path)}
                className="group relative overflow-hidden rounded-[28px] border theme-border p-6 text-left transition-all duration-200 hover:-translate-y-1"
                style={styles.card}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in srgb, var(--surface) 74%, transparent), color-mix(in srgb, var(--surface-soft) 40%, transparent))",
                  }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm"
                      style={styles.orb}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div
                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] shadow-sm"
                      style={styles.openChip}
                    >
                      Open
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] theme-text-muted">{feature.eyebrow}</p>
                    <h3 className="mt-2 text-2xl font-semibold theme-text">{feature.title}</h3>
                    <p className="mt-3 max-w-xl text-sm leading-6 theme-text-muted">{feature.description}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {feature.bullets.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                        style={styles.chip}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t theme-border pt-4">
                    <p className="text-sm font-medium theme-text">{feature.stats}</p>
                    <span className="inline-flex h-2.5 w-2.5 rounded-full" style={styles.accent} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {(role === "admin" || role === "manager") && (
        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold theme-text">Always-on AI</h2>
            <p className="mt-1 text-sm theme-text-muted">Background intelligence that keeps working even when you are not on these pages.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {BACKGROUND_AI_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-3xl border theme-border p-5 shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--surface) 94%, var(--primary) 6%), color-mix(in srgb, var(--surface-soft) 84%, var(--surface) 16%))",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 18%, var(--surface))",
                      color: "var(--primary)",
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold theme-text">{label}</p>
                    <p className="mt-1 text-sm leading-6 theme-text-muted">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
