import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowDown, BrainCircuit, Building2, Compass, Globe2, Info,
  MousePointerClick, RefreshCw, Repeat2, Route, UserPlus, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import superadminApi from "../superadminApi";

const TABS = [
  ["overview", "Growth Overview"], ["acquisition", "Acquisition"],
  ["activation", "Activation"], ["engagement", "Engagement"],
  ["retention", "Retention"], ["journeys", "User Journey"],
  ["product-discovery", "Product Discovery"],
];

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: isoDate(from), to: isoDate(to) };
}

function formatNumber(value) {
  if (typeof value === "string" && !/^-?\d+(\.\d+)?$/.test(value)) return value;
  return Number(value || 0).toLocaleString();
}

function MetricCard({ icon, label, value, change, note }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[var(--surface)] p-4 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[color:var(--text-soft)]">{icon}</span>
        {change !== undefined && (
          <span className={`text-[11px] font-medium ${change >= 0 ? "text-emerald-500" : "text-amber-500"}`}>
            {change >= 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-[color:var(--text)]">{formatNumber(value)}</p>
      <p className="mt-1 text-xs text-[color:var(--text-muted)]">{label}</p>
      {note && <p className="mt-1 text-[10px] text-[color:var(--text-soft)]">{note}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-[color:var(--border)] bg-[var(--surface)] ${className}`}>
      <div className="border-b border-[color:var(--border)] px-4 py-3.5">
        <h2 className="text-sm font-semibold text-[color:var(--text)]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function RankedList({ rows = [], empty = "No telemetry in this period" }) {
  const max = Math.max(1, ...rows.map((row) => row.value || row.uses || 0));
  if (!rows.length) return <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">{empty}</p>;
  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const value = row.value ?? row.uses ?? 0;
        const label = row.label ?? row.feature_name;
        return (
          <div key={`${label}-${index}`}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate text-[color:var(--text-muted)]">{label}</span>
              <span className="font-medium text-[color:var(--text)]">{formatNumber(value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div className="h-full rounded-full bg-[color:var(--primary)]" style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GrowthChart({ data = [] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--text-soft)" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: "var(--text-soft)" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
          <Line type="monotone" dataKey="active_users" name="Active users" stroke="var(--primary)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="page_views" name="Page views" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="signups" name="Signups" stroke="#34d399" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Funnel({ stages = [] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));
  return (
    <div className="space-y-2">
      {stages.map((stage, index) => (
        <div key={stage.key}>
          {index > 0 && (
            <div className="flex h-6 items-center gap-2 pl-3 text-[10px] text-[color:var(--text-soft)]">
              <ArrowDown className="h-3 w-3" /> {stage.conversion_from_previous}% step conversion
            </div>
          )}
          <div className="relative overflow-hidden rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2.5">
            <div className="absolute inset-y-0 left-0 bg-[color:var(--primary)] opacity-[0.08]" style={{ width: `${Math.max(2, (stage.count / max) * 100)}%` }} />
            <div className="relative flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-[color:var(--text-muted)]">{stage.label}</span>
              <span className="text-sm font-semibold text-[color:var(--text)]">{formatNumber(stage.count)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Insights({ rows = [] }) {
  if (!rows.length) return <p className="text-xs text-[color:var(--text-muted)]">Insights appear as telemetry accumulates.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((item) => (
        <div key={item.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex gap-2.5">
            <BrainCircuit className={`mt-0.5 h-4 w-4 shrink-0 ${item.severity === "attention" ? "text-amber-500" : "text-[color:var(--primary)]"}`} />
            <div>
              <p className="text-xs font-semibold text-[color:var(--text)]">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductDiscoveryInsights({ rows = [] }) {
  if (!rows.length) return <p className="text-xs text-[color:var(--text-muted)]">Weekly product insights appear as pilot telemetry accumulates.</p>;
  const priorityClass = {
    critical: "text-red-500",
    high: "text-amber-500",
    medium: "text-[color:var(--primary)]",
    low: "text-[color:var(--text-soft)]",
  };
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((item) => (
        <div key={item.id} className="rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)] p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${priorityClass[item.priority] || priorityClass.medium}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-[color:var(--text)]">{item.title}</p>
                <span className="rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[color:var(--text-soft)]">{item.priority}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">{item.summary}</p>
              {!!item.evidence?.length && (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4 text-[color:var(--text-soft)]">
                  {item.evidence.slice(0, 3).map((evidence, index) => <li key={`${item.id}-evidence-${index}`}>{evidence}</li>)}
                </ul>
              )}
              {item.recommendation && <p className="mt-2 text-[11px] leading-4 text-[color:var(--text-muted)]">Recommendation: {item.recommendation}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SuperadminGrowthIntelligence() {
  const [tab, setTab] = useState("overview");
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, discoveryResponse] = await Promise.all([
        superadminApi.get("/superadmin/growth/dashboard", { params: range }),
        superadminApi.get("/superadmin/growth/product-discovery", { params: range }),
      ]);
      setData({ ...dashboardResponse.data, product_discovery: discoveryResponse.data });
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to load Growth Intelligence");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);
  const overview = data?.overview || {};
  const adoption = data?.engagement?.feature_adoption || [];
  const retentionChart = useMemo(() => data?.retention?.weekly_active_users || [], [data]);
  const discovery = data?.product_discovery || {};

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--primary)]">Asystence Intelligence</p>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-[color:var(--text)]">Growth Intelligence</h1>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">Measure product adoption, understand friction, and improve activation.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="h-9 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[color:var(--text)]" />
          <span className="text-xs text-[color:var(--text-soft)]">to</span>
          <input type="date" value={range.to} min={range.from} max={isoDate(new Date())} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="h-9 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] px-2.5 text-xs text-[color:var(--text)]" />
          <button onClick={load} disabled={loading} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-3 text-xs font-medium text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--border)] pb-px">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium ${tab === key ? "border-[color:var(--primary)] text-[color:var(--text)]" : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>{label}</button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1,2,3,4].map((key) => <div key={key} className="h-32 animate-pulse rounded-lg border border-[color:var(--border)] bg-[var(--surface-soft)]" />)}</div>
      ) : (
        <>
          {tab === "overview" && <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
              <MetricCard icon={<Globe2 className="h-4 w-4" />} label="Page views" value={overview.page_views} change={overview.growth?.page_views} />
              <MetricCard icon={<MousePointerClick className="h-4 w-4" />} label="Sessions" value={overview.sessions} />
              <MetricCard icon={<UserPlus className="h-4 w-4" />} label="Signups" value={overview.signups} change={overview.growth?.signups} />
              <MetricCard icon={<Users className="h-4 w-4" />} label="Active users" value={overview.active_users} change={overview.growth?.active_users} />
              <MetricCard icon={<Building2 className="h-4 w-4" />} label="Active workspaces" value={overview.active_workspaces} />
              <MetricCard icon={<Repeat2 className="h-4 w-4" />} label="Returning users" value={`${overview.returning_user_percentage || 0}%`} note={`${overview.returning_users || 0} users`} />
            </div>
            <Panel title="Growth trend" subtitle="Daily adoption signals across the selected period"><GrowthChart data={data?.series} /></Panel>
            <Panel title="Operational insights" subtitle="Rule-based now; response contract is ready for future AI-generated insight providers"><Insights rows={data?.insights} /></Panel>
          </div>}

          {tab === "acquisition" && <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Panel title="Traffic sources"><RankedList rows={data?.acquisition?.traffic_sources} /></Panel>
            <Panel title="Top pages"><RankedList rows={data?.acquisition?.top_pages} /></Panel>
            <Panel title="Landing pages"><RankedList rows={data?.acquisition?.landing_pages} /></Panel>
            <Panel title="Referrers"><RankedList rows={data?.acquisition?.referrers} /></Panel>
            <Panel title="Devices"><RankedList rows={data?.acquisition?.devices} /></Panel>
            <Panel title="Countries (coarse)"><RankedList rows={data?.acquisition?.countries} /></Panel>
          </div>}

          {tab === "activation" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <Panel title="Activation funnel" subtitle="Distinct visitor or workspace identities reaching each milestone"><Funnel stages={data?.funnel} /></Panel>
            <Panel title="Authentication" subtitle="Server-confirmed outcomes only">
              <div className="grid grid-cols-2 gap-3">
                <MetricCard icon={<Route className="h-4 w-4" />} label="Login attempts" value={overview.login_attempts} />
                <MetricCard icon={<Activity className="h-4 w-4" />} label="Successful logins" value={overview.successful_logins} />
              </div>
            </Panel>
          </div>}

          {tab === "engagement" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <Panel title="Feature adoption" subtitle="Measured successful product actions">
              <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={adoption.slice(0, 10)} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-soft)" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="feature_name" width={90} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} /><Bar dataKey="uses" fill="var(--primary)" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></div>
            </Panel>
            <Panel title="Top features"><RankedList rows={adoption} /></Panel>
          </div>}

          {tab === "retention" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
            <Panel title="Weekly active users" subtitle="Distinct authenticated users with measured activity">
              <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={retentionChart}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--text-soft)" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-soft)" }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} /><Line dataKey="active_users" name="Active users" stroke="var(--primary)" strokeWidth={2} /></LineChart></ResponsiveContainer></div>
            </Panel>
            <MetricCard icon={<Repeat2 className="h-4 w-4" />} label="Returning user percentage" value={`${overview.returning_user_percentage || 0}%`} note="Active this period with earlier product activity" />
          </div>}

          {tab === "journeys" && <Panel title="Recent user journey signals" subtitle="Identifiers and operational event names only; no message, AI prompt, or private content is collected">
            <div className="divide-y divide-[color:var(--border)]">
              {(data?.journeys || []).map((event) => {
                const identity = event.actor_user_id || event.anonymous_id || "anonymous";
                return <div key={event.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(150px,0.7fr)_minmax(180px,1fr)_minmax(120px,0.7fr)_auto] sm:items-center">
                  <span className="truncate text-xs font-medium text-[color:var(--text)]">{String(identity).slice(0, 12)}…</span>
                  <span className="text-xs text-[color:var(--text-muted)]">{event.event_name}</span>
                  <span className="truncate text-xs text-[color:var(--text-soft)]">{event.feature_name || event.page_path || "—"}</span>
                  <span className="text-[10px] text-[color:var(--text-soft)]">{new Date(event.occurred_at).toLocaleString()}</span>
                </div>;
              })}
              {!data?.journeys?.length && <p className="py-10 text-center text-xs text-[color:var(--text-muted)]">No journey signals in this period.</p>}
            </div>
          </Panel>}

          {tab === "product-discovery" && <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
              <MetricCard icon={<Compass className="h-4 w-4" />} label="Product events" value={discovery.overview?.product_events} />
              <MetricCard icon={<Users className="h-4 w-4" />} label="Active users" value={discovery.overview?.active_users} />
              <MetricCard icon={<MousePointerClick className="h-4 w-4" />} label="Tracked clicks" value={discovery.overview?.clicks} />
              <MetricCard icon={<Route className="h-4 w-4" />} label="Feature views" value={discovery.overview?.feature_views} />
              <MetricCard icon={<AlertTriangle className="h-4 w-4" />} label="Friction signals" value={discovery.overview?.friction_events} />
              <MetricCard icon={<Repeat2 className="h-4 w-4" />} label="Abandonment" value={discovery.overview?.abandonment_events} />
            </div>

            <Panel
              title="Weekly product discovery insights"
              subtitle="Generated from observed adoption, hesitation, abandonment, recommendation, workflow, dashboard, search, and click telemetry"
            >
              <ProductDiscoveryInsights rows={discovery.insights} />
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <Panel title="Feature discovery signals" subtitle="Views, actions, friction, and abandonment by surface">
                <div className="divide-y divide-[color:var(--border)]">
                  {(discovery.adoption?.feature_adoption || []).slice(0, 12).map((row) => (
                    <div key={row.feature_name} className="grid gap-2 py-3 text-xs sm:grid-cols-[minmax(120px,1fr)_repeat(5,minmax(60px,auto))] sm:items-center">
                      <span className="font-medium text-[color:var(--text)]">{row.feature_name}</span>
                      <span className="text-[color:var(--text-muted)]">events {formatNumber(row.total_events)}</span>
                      <span className="text-[color:var(--text-muted)]">views {formatNumber(row.views)}</span>
                      <span className="text-[color:var(--text-muted)]">uses {formatNumber(row.uses)}</span>
                      <span className="text-[color:var(--text-muted)]">friction {formatNumber(row.friction_events)}</span>
                      <span className="text-[color:var(--text-muted)]">users {formatNumber(row.unique_users)}</span>
                    </div>
                  ))}
                  {!discovery.adoption?.feature_adoption?.length && <p className="py-10 text-center text-xs text-[color:var(--text-muted)]">No product discovery events in this range.</p>}
                </div>
              </Panel>

              <div className="space-y-4">
                <Panel title="AI and recommendations" subtitle="Adoption and trust signals">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard icon={<BrainCircuit className="h-4 w-4" />} label="AI uses" value={discovery.adoption?.ai_adoption?.uses} />
                    <MetricCard icon={<BrainCircuit className="h-4 w-4" />} label="Recommendation views" value={discovery.adoption?.recommendation_usage?.views} />
                    <MetricCard icon={<Activity className="h-4 w-4" />} label="Recommendation actions" value={discovery.adoption?.recommendation_usage?.actions} />
                    <MetricCard icon={<Info className="h-4 w-4" />} label="Explainability opens" value={discovery.adoption?.explainability_usage?.opens} />
                  </div>
                </Panel>
                <Panel title="Search and workflows" subtitle="Findability and workflow usage">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard icon={<Route className="h-4 w-4" />} label="Searches" value={discovery.adoption?.search_analytics?.searches} />
                    <MetricCard icon={<MousePointerClick className="h-4 w-4" />} label="Search clicks" value={discovery.adoption?.search_analytics?.result_clicks} />
                    <MetricCard icon={<Route className="h-4 w-4" />} label="Workflow views" value={discovery.adoption?.workflow_usage?.views} />
                    <MetricCard icon={<Activity className="h-4 w-4" />} label="Workflow actions" value={discovery.adoption?.workflow_usage?.actions} />
                  </div>
                </Panel>
              </div>
            </div>

            <Panel title="Longest observed session flows" subtitle="Aggregate paths only; no task titles, message text, prompts, or raw search queries">
              <div className="divide-y divide-[color:var(--border)]">
                {(discovery.friction?.session_flows || []).slice(0, 10).map((flow) => (
                  <div key={flow.session_id} className="grid gap-2 py-3 text-xs md:grid-cols-[minmax(140px,0.5fr)_minmax(220px,1fr)_repeat(3,auto)] md:items-center">
                    <span className="truncate font-medium text-[color:var(--text)]">{String(flow.session_id).slice(0, 12)}?</span>
                    <span className="truncate text-[color:var(--text-muted)]">{flow.path_sample?.join(" ? ") || "No path sample"}</span>
                    <span className="text-[color:var(--text-soft)]">steps {formatNumber(flow.step_count)}</span>
                    <span className="text-[color:var(--text-soft)]">clicks {formatNumber(flow.click_count)}</span>
                    <span className="text-[color:var(--text-soft)]">friction {formatNumber(flow.friction_count)}</span>
                  </div>
                ))}
                {!discovery.friction?.session_flows?.length && <p className="py-10 text-center text-xs text-[color:var(--text-muted)]">No session flow telemetry in this range.</p>}
              </div>
            </Panel>
          </div>}
        </>
      )}
    </div>
  );
}
