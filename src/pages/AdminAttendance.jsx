// src/pages/AdminAttendance.jsx
import { useEffect, useState, useMemo } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

export default function AdminAttendance() {
  const api = useApi();
  const { auth } = useAuth();

  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  // Optional filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState("");

  /* --------------------------------------------------
     🔐 HARD UI GUARD
     Backend already enforces this, but UI should not
     even try to render for non-admins
  -------------------------------------------------- */
  if (!auth?.user || auth.user.role !== "admin") {
    return (
      <div className="p-6 text-red-600 text-sm">
        Admin access required.
      </div>
    );
  }

  /* --------------------------------------------------
     Load users (workspace-scoped automatically)
     No workspace param needed — middleware handles it
  -------------------------------------------------- */
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
    return () => {
      mounted = false;
    };
  }, [api]);

  /* --------------------------------------------------
     Load attendance rows
     All filters OPTIONAL
  -------------------------------------------------- */
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
      console.error("Attendance load error:", err);
      toast.error(
        err.response?.data?.error ||
          "Failed to load attendance reports"
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial load (no filters)
  useEffect(() => {
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFilters = () => {
    setFrom("");
    setTo("");
    setUserId("");
    loadAttendance();
  };

  /* --------------------------------------------------
     Recalculate Attendance (INSERT into attendance_daily)
  -------------------------------------------------- */
  const handleRecalculate = async () => {
    if (!window.confirm("Recalculate attendance data? This will update the attendance_daily table.")) {
      return;
    }

    try {
      setRecalculating(true);

      const payload = {};
      if (from) payload.from = from;
      if (to) payload.to = to;
      if (userId) payload.userId = userId;

      await api.post("/admin/attendance/recalculate", payload);

      toast.success("Attendance recalculated successfully!");

      // Reload the attendance data to show updated values
      await loadAttendance();
    } catch (err) {
      console.error("Recalculation error:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.details ||
        err.message ||
        "Recalculation failed";
      toast.error(`Recalculation failed: ${errorMsg}`);
    } finally {
      setRecalculating(false);
    }
  };

  /* --------------------------------------------------
     Fast lookup: userId → username
  -------------------------------------------------- */
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[String(u.id)] = u.username;
    });
    return map;
  }, [users]);

  /* --------------------------------------------------
     CSV EXPORT (FIXED POSITION)
  -------------------------------------------------- */
  const exportCsv = async () => {
    try {
      if (!from) {
        toast.error("Select a month first");
        return;
      }

      const month = from.slice(0, 7);

      const res = await api.get(
        `/admin/attendance/export`,
        {
          params: { month },
          responseType: "blob",
        }
      );

      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${month}.csv`;
      document.body.appendChild(a);
      a.click();

      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("CSV export failed");
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Attendance Reports
        </h1>
        <p className="text-sm text-slate-500">
          Workspace-wide attendance analytics. All filters are optional.
        </p>
      </div>

      {/* ACTION BUTTONS */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Actions</h3>
          <p className="text-xs text-slate-500">
            Recalculate attendance data from raw logs or export filtered results
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="border px-4 py-2 rounded text-sm bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
          >
            {recalculating ? "Recalculating..." : "🔄 Recalculate Attendance"}
          </button>

          <button
            onClick={exportCsv}
            disabled={!from}
            className="border px-4 py-2 rounded text-sm bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
            title={!from ? "Select a 'From' date first" : "Export attendance data as CSV"}
          >
            📊 Export CSV (Payroll)
          </button>
        </div>

        {!from && (
          <p className="text-xs text-amber-600">
            💡 Tip: Set a date range in the filters below to recalculate or export specific periods
          </p>
        )}
      </div>

      {/* FILTERS */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col text-sm">
          <label className="text-xs text-slate-500 mb-1">
            From date
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col text-sm">
          <label className="text-xs text-slate-500 mb-1">
            To date
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>

        <div className="flex flex-col text-sm min-w-[200px]">
          <label className="text-xs text-slate-500 mb-1">
            User
          </label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Apply"}
          </button>

          <button
            onClick={clearFilters}
            className="border px-4 py-2 rounded text-sm hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-right">Signed In (min)</th>
              <th className="px-4 py-2 text-right">AWS</th>
              <th className="px-4 py-2 text-right">Lunch</th>
              <th className="px-4 py-2 text-right">Available</th>
              <th className="px-4 py-2 text-right">Screen ON</th>
              <th className="px-4 py-2 text-right">Screen OFF</th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    Loading attendance data...
                  </div>
                </td>
              </tr>
            )}

            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  No attendance data found. Try adjusting your filters or click "Recalculate Attendance" to process raw logs.
                </td>
              </tr>
            )}

            {rows.map((r, idx) => (
              <tr
                key={`${r.user_id}-${r.date}-${idx}`}
                className="border-t hover:bg-slate-50"
              >
                <td className="px-4 py-2">
                  {userMap[String(r.user_id)] || "—"}
                </td>
                <td className="px-4 py-2">{r.date}</td>
                <td className="px-4 py-2 text-right">
                  {r.total_signed_in_minutes ?? 0}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.aws_minutes ?? 0}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.lunch_minutes ?? 0}
                </td>
                <td className="px-4 py-2 text-right font-semibold">
                  {r.available_minutes ?? 0}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.screen_on_minutes ?? 0}
                </td>
                <td className="px-4 py-2 text-right">
                  {r.screen_off_minutes ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
