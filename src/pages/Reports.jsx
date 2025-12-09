// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// ---- Status config + helpers ----

// canonical config for known statuses (keys from DB)
const STATUS_META = {
  pending: {
    label: "To Do", // UI label instead of "Pending"
    color: "#facc15", // amber
  },
  "in-progress": {
    label: "In Progress",
    color: "#60a5fa", // soft blue
  },
  completed: {
    label: "Completed",
    color: "#22c55e", // green
  },
  stage: {
    label: "Stage",
    color: "#a855f7", // purple
  },
};

// fallback colors for any extra custom statuses
const FALLBACK_COLORS = ["#fb923c", "#ec4899", "#06b6d4", "#ef4444"];

function getStatusMeta(statusKey, index = 0) {
  const base = STATUS_META[statusKey] || {};
  const label =
    base.label ||
    (statusKey
      ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1)
      : "Unknown");
  const color = base.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  return { label, color };
}

function statusLabel(status) {
  // use the same label mapping everywhere (tables, etc.)
  return getStatusMeta(status).label;
}

function priorityLabel(priority) {
  if (priority === "high") return "High";
  if (priority === "low") return "Low";
  return "Medium";
}

// simple “chips multi-select” component
function MultiSelectChips({ label, options, value, onChange, getLabel }) {
  const remaining = options.filter((opt) => !value.includes(opt.id));

  const handleAdd = (id) => {
    if (!id) return;
    onChange([...value, id]);
  };

  const handleRemove = (id) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <span className="text-[10px] text-slate-400">
          Leave empty for all.
        </span>
      </div>

      <div className="flex flex-wrap gap-1 mb-1 min-h-[24px]">
        {value.length === 0 && (
          <span className="text-[11px] text-slate-400">
            No filter applied.
          </span>
        )}
        {value.map((id) => {
          const opt = options.find((o) => o.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-[2px]"
            >
              <span className="text-[11px] text-slate-700">
                {getLabel(opt)}
              </span>
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:text-red-500"
                onClick={() => handleRemove(id)}
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>

      <select
        className="border rounded-lg px-2 py-1 text-xs"
        onChange={(e) => {
          handleAdd(e.target.value);
          e.target.value = "";
        }}
        value=""
      >
        <option value="">Select…</option>
        {remaining.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {getLabel(opt)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Reports() {
  const api = useApi();
  const { auth } = useAuth();
  const user = auth.user;

  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);

  // filters
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  // which statuses exist in this report (in order)
  const statusOrder = useMemo(() => {
    if (!report || !report.byStatus) return [];

    const raw = report.byStatus.map((row) => row.status);
    const uniq = [];
    raw.forEach((s) => {
      if (s && !uniq.includes(s)) uniq.push(s);
    });

    // keep our 3 main ones in a nice order at the front
    const preferred = ["pending", "in-progress", "completed"];
    const ordered = [];
    preferred.forEach((key) => {
      if (uniq.includes(key)) ordered.push(key);
    });
    uniq.forEach((key) => {
      if (!ordered.includes(key)) ordered.push(key);
    });

    return ordered;
  }, [report]);

  // ---- aggregated status per user (for stacked bar) ----
  const userStatusData = useMemo(() => {
    if (!report || !report.tasks || statusOrder.length === 0) return [];

    const map = new Map();

    report.tasks.forEach((t) => {
      const name = t.username || "-";
      if (!map.has(name)) {
        const base = { name };
        statusOrder.forEach((s) => {
          base[s] = 0;
        });
        map.set(name, base);
      }
      if (statusOrder.includes(t.status)) {
        map.get(name)[t.status] += 1;
      }
    });

    return Array.from(map.values());
  }, [report, statusOrder]);

  // ---- aggregated status per project (for stacked bar) ----
  const projectStatusData = useMemo(() => {
    if (!report || !report.tasks || statusOrder.length === 0) return [];

    const map = new Map();

    report.tasks.forEach((t) => {
      const name = t.project_name || "No project";
      if (!map.has(name)) {
        const base = { name };
        statusOrder.forEach((s) => {
          base[s] = 0;
        });
        map.set(name, base);
      }
      if (statusOrder.includes(t.status)) {
        map.get(name)[t.status] += 1;
      }
    });

    return Array.from(map.values());
  }, [report, statusOrder]);

  // pie chart data using same labels & colors
  const statusPieData = useMemo(() => {
    return (report?.byStatus || []).map((row, idx) => {
      const { label, color } = getStatusMeta(row.status, idx);
      return {
        name: `${label} (${row.count})`,
        value: row.count,
        status: row.status,
        color,
      };
    });
  }, [report]);

  // pagination for raw tasks table
  const [pageSize, setPageSize] = useState(10); // 10–100
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [projRes, userRes] = await Promise.all([
          api.get("/projects"),
          api.get("/users"),
        ]);
        setProjects(projRes.data || []);
        setUsers(userRes.data || []);
      } catch (err) {
        console.error("Failed to load projects/users for reports:", err);
        toast.error("Failed to load metadata for reports");
      }
    }

    if (user) loadMeta();
  }, [user, api]);

  const handleRunReport = async () => {
    setLoading(true);
    setPage(1); // reset pagination on new run

    try {
      const params = new URLSearchParams();

      if (selectedProjectIds.length > 0) {
        params.append("projects", selectedProjectIds.join(","));
      }
      if (selectedUserIds.length > 0) {
        params.append("users", selectedUserIds.join(","));
      }
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (priorityFilter !== "all") params.append("priority", priorityFilter);

      const url = `/reports/combined?${params.toString()}`;
      const res = await api.get(url);
      setReport(res.data || null);
    } catch (err) {
      console.error("Failed to run report:", err);
      const msg = err.response?.data?.error || "Failed to run report";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // pagination for tasks table
  const pagedTasks = useMemo(() => {
    if (!report?.tasks) return [];
    const start = (page - 1) * pageSize;
    return report.tasks.slice(start, start + pageSize);
  }, [report, page, pageSize]);

  const totalPages = useMemo(() => {
    if (!report?.tasks) return 1;
    return Math.max(1, Math.ceil(report.tasks.length / pageSize));
  }, [report, pageSize]);

  const handleChangePageSize = (e) => {
    let size = Number(e.target.value) || 10;
    if (size < 10) size = 10;
    if (size > 100) size = 100;
    setPageSize(size);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <section className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold">Reports</h1>
          <p className="text-xs text-slate-500">
            Analyse tasks by project, user, status and priority. All filters are
            optional – leave them empty to report on everything you can access.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section className="bg-white rounded-xl shadow p-4 text-xs space-y-4">
        <h2 className="text-sm font-semibold mb-1">Filters</h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MultiSelectChips
            label="Projects (multi-select)"
            options={projects}
            value={selectedProjectIds}
            onChange={setSelectedProjectIds}
            getLabel={(p) => (p ? p.name : "-")}
          />

          <MultiSelectChips
            label="Users (multi-select)"
            options={users}
            value={selectedUserIds}
            onChange={setSelectedUserIds}
            getLabel={(u) =>
              u ? `${u.username || "-"} (${u.email || "no email"})` : "-"
            }
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs"
            />
            <span className="text-[10px] text-slate-400">
              Empty means “from the beginning”.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs"
            />
            <span className="text-[10px] text-slate-400">
              Empty means “up to now”.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">Status (UI filter)</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="pending">To Do</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold">
              Priority (UI filter)
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="border rounded-lg px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={handleRunReport}
            className="bg-blue-600 text-white text-xs rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run report"}
          </button>
        </div>
      </section>

      {/* STATUS PIE + SUMMARY */}
      {report && (
        <section className="bg-white rounded-xl shadow p-4 space-y-4">
          <h2 className="text-sm font-semibold mb-1">Status distribution</h2>

          <div className="w-full h-[320px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  labelLine={false}
                  label={({ name }) => name}
                >
                  {statusPieData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    fontSize: "11px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  formatter={(value) => (
                    <span className="text-[11px] text-slate-600">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* BY STATUS / USER / PROJECT TABLES + CHARTS */}
      {report && (
        <section className="bg-white rounded-xl shadow p-4 space-y-6 text-xs">
          <div className="grid md:grid-cols-3 gap-6">
            {/* By Status table */}
            <div>
              <h3 className="font-semibold mb-2">By Status</h3>
              <table className="w-full text-[11px] border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1">Status</th>
                    <th className="text-right px-2 py-1">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byStatus?.map((row) => (
                    <tr
                      key={row.status}
                      className="border-b border-slate-100"
                    >
                      <td className="px-2 py-1">
                        {statusLabel(row.status)}
                      </td>
                      <td className="px-2 py-1 text-right">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By User table */}
            <div>
              <h3 className="font-semibold mb-2">By User</h3>
              <table className="w-full text-[11px] border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1">User</th>
                    <th className="text-left px-2 py-1">Email</th>
                    <th className="text-right px-2 py-1">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byUser?.map((row) => (
                    <tr
                      key={row.id || row.username}
                      className="border-b border-slate-100"
                    >
                      <td className="px-2 py-1">{row.username || "-"}</td>
                      <td className="px-2 py-1">{row.email || "-"}</td>
                      <td className="px-2 py-1 text-right">
                        {row.task_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By Project table */}
            <div>
              <h3 className="font-semibold mb-2">By Project</h3>
              <table className="w-full text-[11px] border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1">Project</th>
                    <th className="text-right px-2 py-1">Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProject?.map((row) => (
                    <tr
                      key={row.id || row.name}
                      className="border-b border-slate-100"
                    >
                      <td className="px-2 py-1">{row.name || "-"}</td>
                      <td className="px-2 py-1 text-right">
                        {row.task_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* STACKED Charts for User & Project breakdowns */}
          <div className="grid md:grid-cols-2 gap-8 mt-10">
            {/* STACKED: Tasks by user */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Tasks by user</h3>
              {userStatusData.length === 0 ? (
                <p className="text-xs text-slate-400">No data for users.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={userStatusData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 11, fill: "#0f172a" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#0f172a" }}
                    />
                    <Tooltip />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{ fontSize: 11, color: "#0f172a" }}
                    />
                    {statusOrder.map((statusKey, index) => {
                      const { label, color } = getStatusMeta(statusKey, index);
                      return (
                        <Bar
                          key={statusKey}
                          dataKey={statusKey}
                          stackId="a"
                          name={label}
                          fill={color}
                          barSize={18}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* STACKED: Tasks by project */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Tasks by project</h3>
              {projectStatusData.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No data for projects.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={projectStatusData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="name"
                      angle={-35}
                      textAnchor="end"
                      height={60}
                      tick={{ fontSize: 11, fill: "#0f172a" }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "#0f172a" }}
                    />
                    <Tooltip />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{ fontSize: 11, color: "#0f172a" }}
                    />
                    {statusOrder.map((statusKey, index) => {
                      const { label, color } = getStatusMeta(statusKey, index);
                      return (
                        <Bar
                          key={statusKey}
                          dataKey={statusKey}
                          stackId="a"
                          name={label}
                          fill={color}
                          barSize={18}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      )}

      {/* DETAILED TASKS TABLE + PAGINATION */}
      {report && (
        <section className="bg-white rounded-xl shadow p-4 text-xs space-y-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-sm font-semibold">Tasks (detailed)</h2>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Rows per page:</span>
              <select
                value={pageSize}
                onChange={handleChangePageSize}
                className="border rounded-lg px-2 py-1 text-[11px]"
              >
                {[10, 25, 50, 75, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {report.tasks?.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              No tasks for this filter.
            </p>
          ) : (
            <>
              <table className="w-full text-[11px] border-collapse">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-1">Task</th>
                    <th className="text-left px-2 py-1">Project</th>
                    <th className="text-left px-2 py-1">Assignee</th>
                    <th className="text-left px-2 py-1">Status</th>
                    <th className="text-left px-2 py-1">Priority</th>
                    <th className="text-left px-2 py-1">Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTasks.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="px-2 py-1">{t.task}</td>
                      <td className="px-2 py-1">{t.project_name || "-"}</td>
                      <td className="px-2 py-1">{t.assigned_to || "-"}</td>
                      <td className="px-2 py-1">{statusLabel(t.status)}</td>
                      <td className="px-2 py-1">
                        {priorityLabel(t.priority)}
                      </td>
                      <td className="px-2 py-1">
                        {t.due_date
                          ? new Date(t.due_date).toLocaleDateString()
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center mt-2">
                <span className="text-[11px] text-slate-500">
                  Showing{" "}
                  {report.tasks.length === 0
                    ? 0
                    : (page - 1) * pageSize + 1}{" "}
                  – {Math.min(page * pageSize, report.tasks.length)} of{" "}
                  {report.tasks.length}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-2 py-1 border rounded text-[11px] disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    className="px-2 py-1 border rounded text-[11px] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
