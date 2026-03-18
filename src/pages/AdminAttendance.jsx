// src/pages/AdminAttendance.jsx
import { useEffect, useState, useMemo } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { ClipboardList, RefreshCw, Download, Filter, X, ChevronDown, ChevronUp } from "lucide-react";

const TODAY = new Date().toISOString().slice(0, 10);

function fmt(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function AdminAttendance() {
  const api = useApi();
  const { auth } = useAuth();

  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");

  if (!auth?.user || auth.user.role !== "admin") {
    return (
      <div className="p-6 text-red-600 text-sm">Admin access required.</div>
    );
  }

  useEffect(() => {
    let mounted = true;
    async function loadUsers() {
      try {
        const res = await api.get("/users");
        if (mounted) setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    }
    loadUsers();
    return () => { mounted = false; };
  }, [api]);

  const loadAttendance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (userId) params.userId = userId;
      const res = await api.get("/admin/attendance", { params });
      setRows(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to load attendance reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAttendance(); }, []);

  const clearFilters = () => {
    setFrom(""); setTo(""); setUserId("");
    loadAttendance();
  };

  const handleRecalculate = async () => {
    if (!window.confirm("Recalculate attendance data? This will update the attendance_daily table.")) return;
    try {
      setRecalculating(true);
      const payload = {};
      if (from) payload.from = from;
      if (to) payload.to = to;
      if (userId) payload.userId = userId;
      await api.post("/admin/attendance/recalculate", payload);
      toast.success("Attendance recalculated!");
      await loadAttendance();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Recalculation failed");
    } finally {
      setRecalculating(false);
    }
  };

  const exportCsv = async () => {
    try {
      if (!from) { toast.error("Select a month first"); return; }
      const month = from.slice(0, 7);
      const res = await api.get("/admin/attendance/export", { params: { month }, responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `attendance_${month}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("CSV export failed");
    }
  };

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => { map[String(u.id)] = u.username; });
    return map;
  }, [users]);

  const hasFilters = from || to || userId;

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 theme-surface border-b theme-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary-50 rounded-lg">
              <ClipboardList className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold theme-text leading-tight">Attendance</h1>
              <p className="text-xs theme-text-muted">
                {loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`p-2.5 rounded-xl border theme-border transition-colors ${showFilters ? "bg-primary-600 text-white border-primary-600" : "theme-surface theme-text"}`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="p-2.5 rounded-xl theme-surface border theme-border theme-text active:opacity-70 transition-opacity disabled:opacity-40"
              title="Recalculate"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={exportCsv}
              disabled={!from}
              className="p-2.5 rounded-xl theme-surface border theme-border theme-text active:opacity-70 transition-opacity disabled:opacity-40"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs theme-text-muted mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  max={to || TODAY}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border theme-border rounded-lg px-2 py-2 text-sm theme-surface theme-text"
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={TODAY}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border theme-border rounded-lg px-2 py-2 text-sm theme-surface theme-text"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">User</label>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full border theme-border rounded-lg px-2 py-2 text-sm theme-surface theme-text"
              >
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={loadAttendance}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold active:bg-primary-700 disabled:opacity-50"
              >
                {loading ? "Loading…" : "Apply Filters"}
              </button>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2.5 rounded-xl theme-surface border theme-border theme-text-muted text-sm active:opacity-70"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {!from && (
              <p className="text-xs text-amber-600 px-1">
                Set a From date to enable CSV export
              </p>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* Loading skeletons */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl theme-surface border theme-border animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-5 rounded-full bg-[var(--surface-soft)]">
              <ClipboardList className="w-10 h-10 theme-text-muted" />
            </div>
            <div className="text-center">
              <p className="font-semibold theme-text mb-1">No records found</p>
              <p className="text-sm theme-text-muted">Try adjusting filters or recalculate attendance</p>
            </div>
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold active:bg-amber-600 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
              Recalculate Attendance
            </button>
          </div>
        )}

        {/* Records — card list */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-col gap-3">
            {rows.map((r, idx) => (
              <AttendanceCard
                key={`${r.user_id}-${r.date}-${idx}`}
                row={r}
                username={userMap[String(r.user_id)] || "Unknown"}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AttendanceCard({ row, username }) {
  const [expanded, setExpanded] = useState(false);

  const available = row.available_minutes ?? 0;
  const signedIn = row.total_signed_in_minutes ?? 0;
  const pct = signedIn > 0 ? Math.min(100, Math.round((available / signedIn) * 100)) : 0;

  return (
    <div className="theme-surface border theme-border rounded-2xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 active:opacity-70 transition-opacity cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
          <span className="text-primary-600 font-bold text-sm">{username.slice(0, 2).toUpperCase()}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold theme-text truncate">{username}</p>
          <p className="text-xs theme-text-muted">{row.date}</p>
        </div>

        {/* Available badge + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${available >= 420 ? "bg-green-100 text-green-700" : available >= 240 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-600"}`}>
            {fmt(available)}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 theme-text-muted" /> : <ChevronDown className="w-4 h-4 theme-text-muted" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t theme-border px-4 py-3 grid grid-cols-2 gap-3">
          <Metric label="Signed In" value={fmt(row.total_signed_in_minutes)} />
          <Metric label="Available" value={fmt(row.available_minutes)} highlight />
          <Metric label="AWS" value={fmt(row.aws_minutes)} />
          <Metric label="Lunch" value={fmt(row.lunch_minutes)} />
          <Metric label="Screen ON" value={fmt(row.screen_on_minutes)} />
          <Metric label="Screen OFF" value={fmt(row.screen_off_minutes)} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs theme-text-muted">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-primary-600" : "theme-text"}`}>{value}</span>
    </div>
  );
}
