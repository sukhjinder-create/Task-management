// src/pages/AdminAttendance.jsx
import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { ClipboardList, RefreshCw, Download, Filter, X, ChevronDown, ChevronUp } from "lucide-react";
import { getUserProfilePath } from "../utils/userProfiles";

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
      <div className="p-6 text-[color:var(--score-danger)] text-sm">Admin access required.</div>
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
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">Admin</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Attendance</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            {loading ? "Loading…" : `${rows.length} record${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2.5 rounded-lg border transition-colors ${showFilters ? "bg-[var(--primary)] text-white border-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)]"}`}
          >
            <Filter className="w-4 h-4" />
          </button>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="p-2.5 rounded-lg border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors disabled:opacity-40"
            title="Recalculate"
          >
            <RefreshCw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={exportCsv}
            disabled={!from}
            className="p-2.5 rounded-lg border border-[color:var(--border)] text-[color:var(--text)] hover:bg-[var(--surface-soft)] transition-colors disabled:opacity-40"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Filter panel */}
      {showFilters && (
        <div className="border border-[color:var(--border)] rounded-lg p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">From</label>
              <input
                type="date"
                value={from}
                max={to || TODAY}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)]"
              />
            </div>
            <div>
              <label className="block text-xs text-[color:var(--text-muted)] mb-1">To</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                max={TODAY}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[color:var(--text-muted)] mb-1">User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full border border-[color:var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface)] text-[color:var(--text)]"
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
              className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Apply Filters"}
            </button>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)] text-sm hover:bg-[var(--surface-soft)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {!from && (
            <p className="text-xs text-[color:var(--primary)] px-1">
              Set a From date to enable CSV export
            </p>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg border border-[color:var(--border)] animate-pulse bg-[var(--surface-soft)]" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="p-5 rounded-full border border-[color:var(--border)]">
            <ClipboardList className="w-10 h-10 text-[color:var(--text-muted)]" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-[color:var(--text)] mb-1">No records found</p>
            <p className="text-sm text-[color:var(--text-muted)]">Try adjusting filters or recalculate attendance</p>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
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
              username={r.username || userMap[String(r.user_id)] || "Unknown"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AttendanceCard({ row, username }) {
  const [expanded, setExpanded] = useState(false);

  const available = row.available_minutes ?? 0;

  // Availability status as text only (no bg fills)
  const availColor = available >= 420
    ? "text-[color:var(--score-good)]"
    : available >= 240
    ? "text-[color:var(--primary)]"
    : "text-[color:var(--score-danger)]";

  return (
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-soft)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Avatar */}
        <div className="shrink-0 w-10 h-10 rounded-lg border border-[color:var(--border)] flex items-center justify-center">
          <span className="text-[color:var(--primary)] font-bold text-sm">{username.slice(0, 2).toUpperCase()}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <Link
            to={getUserProfilePath(row.user_id)}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-[color:var(--text)] truncate hover:text-[color:var(--primary)]"
          >
            {username}
          </Link>
          <p className="text-xs text-[color:var(--text-muted)]">{row.date}</p>
        </div>

        {/* Available time + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold ${availColor}`}>
            {fmt(available)}
          </span>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)]" />
            : <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)]" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[color:var(--border)] px-4 py-3 grid grid-cols-2 gap-3">
          <Metric label="Signed In"  value={fmt(row.total_signed_in_minutes)} />
          <Metric label="Available"  value={fmt(row.available_minutes)} highlight />
          <Metric label="AWS"        value={fmt(row.aws_minutes)} />
          <Metric label="Lunch"      value={fmt(row.lunch_minutes)} />
          <Metric label="Screen ON"  value={fmt(row.screen_on_minutes)} />
          <Metric label="Screen OFF" value={fmt(row.screen_off_minutes)} />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-[color:var(--primary)]" : "text-[color:var(--text)]"}`}>{value}</span>
    </div>
  );
}
