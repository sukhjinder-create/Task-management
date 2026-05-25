// src/pages/Leave.jsx
// Leave Management — apply, view balance, admin review, calendar view, holiday calendar
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CalendarDays, Plus, Check, X, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Users, Palmtree, Settings,
  Trash2, Star,
} from "lucide-react";
import UserProfileLink from "../components/UserProfileLink";

const STATUS_BADGE = {
  pending:   "text-[color:var(--primary)]",
  approved:  "text-[color:var(--score-good)]",
  rejected:  "text-[color:var(--score-danger)]",
  cancelled: "text-[color:var(--text-muted)]",
};

const ALL_DAYS = [
  { dow: 1, label: "Mon" },
  { dow: 2, label: "Tue" },
  { dow: 3, label: "Wed" },
  { dow: 4, label: "Thu" },
  { dow: 5, label: "Fri" },
  { dow: 6, label: "Sat" },
  { dow: 0, label: "Sun" },
];

export default function Leave() {
  const api = useApi();
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = ["admin", "owner"].includes(auth?.user?.role);

  const TABS = ["My Leaves", "Team Calendar", ...(isAdmin ? ["Holidays", "Admin"] : [])];
  const TAB_MAP = { admin: "Admin", my: "My Leaves", calendar: "Team Calendar", holidays: "Holidays" };
  const initialTab = TAB_MAP[searchParams.get("tab")] || "My Leaves";
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">HR</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Leave Management</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">Manage time off, holidays and work schedule</p>
        </div>
      </header>

      <div className="flex gap-1 border-b border-[color:var(--border)] mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? "border-b-2 border-[color:var(--primary)] text-[color:var(--primary)] -mb-px" : "text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "My Leaves"    && <MyLeavesTab />}
      {tab === "Team Calendar" && <CalendarTab />}
      {tab === "Holidays"     && isAdmin && <HolidayTab />}
      {tab === "Admin"        && isAdmin && <AdminTab />}
    </div>
  );
}

// ─── My Leaves ────────────────────────────────────────────────────────────────
function MyLeavesTab() {
  const api = useApi();
  const { auth } = useAuth();
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [types, setTypes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const myId = auth?.user?.id;
    const [req, bal, typ] = await Promise.all([
      api.get(`/leave/requests?userId=${myId}`).catch(() => ({ data: [] })),
      api.get("/leave/balances").catch(() => ({ data: [] })),
      api.get("/leave/types").catch(() => ({ data: [] })),
    ]);
    setRequests(req.data);
    setBalances(bal.data);
    setTypes(typ.data);
    if (typ.data?.length > 0 && !form.leave_type_id) setForm(f => ({ ...f, leave_type_id: typ.data[0].id }));
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) return toast.error("Fill all required fields");
    setSubmitting(true);
    try {
      await api.post("/leave/requests", form);
      toast.success("Leave request submitted");
      setShowForm(false);
      setForm(f => ({ ...f, start_date: "", end_date: "", reason: "" }));
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSubmitting(false);
  };

  const cancel = async (id) => {
    await api.patch(`/leave/requests/${id}/cancel`).catch(() => toast.error("Cannot cancel"));
    load();
    toast.success("Request cancelled");
  };

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {balances.map(b => {
            const remaining = (b.allocated || 0) - (b.used || 0);
            return (
              <div key={b.id} className="border border-[color:var(--border)] rounded-lg p-4 text-center">
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: b.color }} />
                <p className="text-xs text-[color:var(--text-muted)]">{b.name}</p>
                <p className="text-2xl font-bold text-[color:var(--text)] mt-1">{remaining}</p>
                <p className="text-xs text-[color:var(--text-muted)]">of {b.allocated || 0} remaining</p>
              </div>
            );
          })}
        </div>
      )}

      {/* New request button */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-[color:var(--text)]">My Requests</h2>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <div className="border border-[color:var(--border)] rounded-lg p-5 space-y-4">
          <h3 className="font-medium text-[color:var(--text)]">Apply for Leave</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[color:var(--text)] mb-1">Leave Type *</label>
              <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]">
                {types.map(t => <option key={t.id} value={t.id}>{t.name}{t.max_days ? ` (max ${t.max_days} days/yr)` : ""}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium text-[color:var(--text)] mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--text)] mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                min={form.start_date}
                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-[color:var(--text)] mb-1">Reason (optional)</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-4 py-3 hover:bg-[var(--surface-soft)]">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: r.leave_type_color }} />
            <div className="flex-1">
              <p className="text-sm font-medium text-[color:var(--text)]">{r.leave_type_name}</p>
              <p className="text-xs text-[color:var(--text-muted)]">{r.start_date} → {r.end_date} · {r.days} day{r.days !== 1 ? "s" : ""}</p>
              {r.reason && <p className="text-xs text-[color:var(--text-muted)] italic mt-0.5">"{r.reason}"</p>}
              {r.review_note && <p className="text-xs text-[color:var(--primary)] mt-0.5">Note: {r.review_note}</p>}
            </div>
            <span className={`text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
            {r.status === "pending" && (
              <button onClick={() => cancel(r.id)} className="p-1.5 text-[color:var(--score-danger)] hover:bg-[var(--surface-soft)] rounded-lg" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="text-center py-10">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-[color:var(--text-muted)]" />
            <p className="text-[color:var(--text-muted)]">No leave requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Calendar ─────────────────────────────────────────────────────────────
function CalendarTab() {
  const api = useApi();
  const [requests,  setRequests]  = useState([]);
  const [holidays,  setHolidays]  = useState([]);
  const [schedule,  setSchedule]  = useState([1,2,3,4,5]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    const start = new Date(month.year, month.month, 1).toISOString().split("T")[0];
    const end   = new Date(month.year, month.month + 1, 0).toISOString().split("T")[0];
    Promise.all([
      api.get(`/leave/requests?status=approved&startDate=${start}&endDate=${end}`).catch(() => ({ data: [] })),
      api.get(`/holidays?year=${month.year}&month=${month.month + 1}`).catch(() => ({ data: [] })),
      api.get("/holidays/schedule").catch(() => ({ data: { work_days: [1,2,3,4,5] } })),
    ]).then(([lr, hr, sr]) => {
      setRequests(lr.data || []);
      setHolidays(hr.data || []);
      setSchedule(sr.data?.work_days || [1,2,3,4,5]);
    });
  }, [month]);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const firstDow    = new Date(month.year, month.month, 1).getDay();
  const monthName   = new Date(month.year, month.month).toLocaleString("default", { month: "long", year: "numeric" });

  // Map date -> leave requests
  const leaveMap = {};
  requests.forEach(r => {
    const cur = new Date(r.start_date);
    const end = new Date(r.end_date);
    while (cur <= end) {
      const k = cur.toISOString().split("T")[0];
      if (!leaveMap[k]) leaveMap[k] = [];
      leaveMap[k].push(r);
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Map date -> holiday name
  const holidayMap = {};
  holidays.forEach(h => { holidayMap[h.date] = h.name; });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-[color:var(--text)]">{monthName}</h2>
        <div className="flex gap-2">
          <button onClick={() => setMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-1.5 rounded-lg border border-[color:var(--border)] hover:bg-[var(--surface-soft)]">
            <ChevronLeft className="w-4 h-4 text-[color:var(--text)]" />
          </button>
          <button onClick={() => setMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-1.5 rounded-lg border border-[color:var(--border)] hover:bg-[var(--surface-soft)]">
            <ChevronRight className="w-4 h-4 text-[color:var(--text)]" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs text-[color:var(--text-muted)]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500/40 inline-block" /> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[var(--surface-soft)] border border-[color:var(--border)] inline-block" /> Non-working day</span>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-lg overflow-hidden border border-[color:var(--border)]">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, idx) => (
          <div key={d} className={`text-center py-2 text-xs font-semibold ${schedule.includes(idx) ? "bg-[var(--surface-soft)] text-[color:var(--text-muted)]" : "bg-[var(--surface-soft)] text-[color:var(--text-muted)] opacity-50"}`}>{d}</div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} className="bg-[var(--surface)] min-h-16" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const key     = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayLeave = leaveMap[key] || [];
          const holiday  = holidayMap[key];
          const dow      = new Date(month.year, month.month, day).getDay();
          const isToday  = new Date().toISOString().split("T")[0] === key;
          const isOffDay = !schedule.includes(dow);
          return (
            <div key={day} className={`min-h-16 p-1 ${holiday ? "bg-amber-500/10" : isOffDay ? "bg-[var(--surface-soft)] opacity-60" : "bg-[var(--surface)]"} ${isToday ? "ring-2 ring-[color:var(--primary)] ring-inset" : ""}`}>
              <span className={`text-xs font-medium ${isToday ? "text-[color:var(--primary)]" : holiday ? "text-amber-500" : "text-[color:var(--text-muted)]"}`}>{day}</span>
              {holiday && (
                <div className="text-[10px] text-amber-500 font-medium truncate leading-tight mt-0.5">{holiday}</div>
              )}
              {dayLeave.slice(0, 2).map(r => (
                <div key={r.id} className="text-[10px] px-1 py-0.5 rounded mt-0.5 truncate" style={{ background: r.leave_type_color + "25", color: r.leave_type_color }}>
                  {r.username?.split(" ")[0]}
                </div>
              ))}
              {dayLeave.length > 2 && <div className="text-[10px] text-[color:var(--text-muted)]">+{dayLeave.length - 2}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Holiday Calendar & Work Schedule (Admin) ─────────────────────────────────
function HolidayTab() {
  const api = useApi();
  const [holidays, setHolidays]       = useState([]);
  const [schedule, setSchedule]       = useState([1, 2, 3, 4, 5]); // Mon–Fri default
  const [savingSchedule, setSaving]   = useState(false);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ date: "", name: "" });
  const [submitting, setSubmitting]   = useState(false);
  const [year, setYear]               = useState(new Date().getFullYear());

  const load = useCallback(async () => {
    const [hRes, sRes] = await Promise.all([
      api.get(`/holidays?year=${year}`).catch(() => ({ data: [] })),
      api.get("/holidays/schedule").catch(() => ({ data: { work_days: [1,2,3,4,5] } })),
    ]);
    setHolidays(hRes.data || []);
    setSchedule(sRes.data?.work_days || [1, 2, 3, 4, 5]);
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const toggleDay = (dow) => {
    setSchedule(prev =>
      prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow].sort()
    );
  };

  const saveSchedule = async () => {
    if (schedule.length === 0) return toast.error("Select at least one working day");
    setSaving(true);
    try {
      await api.put("/holidays/schedule", { work_days: schedule });
      toast.success("Work schedule saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  const addHoliday = async () => {
    if (!form.date || !form.name.trim()) return toast.error("Date and name are required");
    setSubmitting(true);
    try {
      await api.post("/holidays", form);
      toast.success("Holiday added");
      setForm({ date: "", name: "" });
      setShowForm(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSubmitting(false);
  };

  const deleteHoliday = async (id) => {
    try {
      await api.delete(`/holidays/${id}`);
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast.success("Holiday removed");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  // Group holidays by month for display
  const byMonth = holidays.reduce((acc, h) => {
    const m = h.date.slice(0, 7); // "2026-04"
    if (!acc[m]) acc[m] = [];
    acc[m].push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-8">

      {/* ── Work Schedule ────────────────────────────────────────── */}
      <div className="border border-[color:var(--border)] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-[color:var(--primary)]" />
          <h2 className="font-semibold text-[color:var(--text)]">Work Schedule</h2>
          <span className="text-xs text-[color:var(--text-muted)] ml-1">— which days are working days</span>
        </div>
        <p className="text-xs text-[color:var(--text-muted)] mb-4">
          Working days define when attendance is expected. Absence on these days (without approved leave or a holiday) is penalised in scoring.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_DAYS.map(({ dow, label }) => {
            const active = schedule.includes(dow);
            return (
              <button
                key={dow}
                onClick={() => toggleDay(dow)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active
                    ? "border-[color:var(--primary)] text-[color:var(--primary)] bg-[var(--surface-soft)]"
                    : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <button
          onClick={saveSchedule}
          disabled={savingSchedule}
          className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {savingSchedule ? "Saving…" : "Save Schedule"}
        </button>
      </div>

      {/* ── Holiday List ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-[color:var(--text)] flex items-center gap-2">
              <Palmtree className="w-4 h-4 text-amber-500" /> Company Holidays
            </h2>
            {/* Year selector */}
            <div className="flex items-center gap-1">
              <button onClick={() => setYear(y => y - 1)} className="p-1 rounded hover:bg-[var(--surface-soft)]">
                <ChevronLeft className="w-4 h-4 text-[color:var(--text-muted)]" />
              </button>
              <span className="text-sm font-medium text-[color:var(--text)] w-12 text-center">{year}</span>
              <button onClick={() => setYear(y => y + 1)} className="p-1 rounded hover:bg-[var(--surface-soft)]">
                <ChevronRight className="w-4 h-4 text-[color:var(--text-muted)]" />
              </button>
            </div>
          </div>
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-1 px-3 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" /> Add Holiday
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="border border-[color:var(--border)] rounded-lg p-4 mb-4 space-y-3">
            <h3 className="text-sm font-medium text-[color:var(--text)]">New Holiday</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--text-muted)] mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Good Friday"
                  className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={addHoliday}
                disabled={submitting}
                className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add Holiday"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Grouped by month */}
        {Object.keys(byMonth).length === 0 && (
          <div className="text-center py-12">
            <Star className="w-10 h-10 mx-auto mb-3 text-[color:var(--text-muted)]" />
            <p className="text-[color:var(--text-muted)] text-sm">No holidays declared for {year}</p>
            <p className="text-xs text-[color:var(--text-muted)] mt-1">Click "Add Holiday" to declare company holidays</p>
          </div>
        )}

        <div className="space-y-4">
          {Object.entries(byMonth).map(([monthKey, items]) => {
            const [y, m] = monthKey.split("-");
            const monthLabel = new Date(Number(y), Number(m) - 1, 1)
              .toLocaleString("default", { month: "long", year: "numeric" });
            return (
              <div key={monthKey}>
                <p className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wider mb-2">{monthLabel}</p>
                <div className="space-y-1.5">
                  {items.map(h => {
                    const dow = new Date(h.date).toLocaleString("default", { weekday: "short" });
                    return (
                      <div key={h.id} className="flex items-center gap-3 border border-[color:var(--border)] rounded-lg px-4 py-3 hover:bg-[var(--surface-soft)]">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Palmtree className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[color:var(--text)]">{h.name}</p>
                          <p className="text-xs text-[color:var(--text-muted)]">{h.date} · {dow}</p>
                        </div>
                        <button
                          onClick={() => deleteHoliday(h.id)}
                          className="p-1.5 text-[color:var(--score-danger)] hover:bg-[var(--surface-soft)] rounded-lg transition-colors"
                          title="Remove holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Admin Tab ────────────────────────────────────────────────────────────────
function AdminTab() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [reviewing, setReviewing] = useState(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = () => {
    api.get(`/leave/requests${filter !== "all" ? `?status=${filter}` : ""}`).then(r => setRequests(r.data || [])).catch(() => {});
  };

  useEffect(() => { load(); }, [filter]);

  const review = async (id, status) => {
    try {
      await api.patch(`/leave/requests/${id}/review`, { status, review_note: reviewNote });
      toast.success(`Request ${status}`);
      setReviewing(null);
      setReviewNote("");
      load();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["pending","approved","rejected","all"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${filter === s ? "bg-[var(--primary)] text-white" : "border border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="border border-[color:var(--border)] rounded-lg overflow-hidden hover:bg-[var(--surface-soft)]">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-[color:var(--text)]">
                  <UserProfileLink userId={r.user_id} username={r.username} className="font-medium text-[color:var(--text)]">
                    <span className="font-medium text-[color:var(--text)]">{r.username}</span>
                  </UserProfileLink>
                  <span className="text-[color:var(--text-muted)] font-normal"> — {r.leave_type_name}</span>
                </p>
                <p className="text-xs text-[color:var(--text-muted)]">{r.start_date} → {r.end_date} · {r.days} day{r.days !== 1 ? "s" : ""}</p>
                {r.reason && <p className="text-xs text-[color:var(--text-muted)] italic mt-0.5">"{r.reason}"</p>}
              </div>
              <span className={`text-xs font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
              {r.status === "pending" && (
                <div className="flex gap-1">
                  <button onClick={() => setReviewing(r.id === reviewing ? null : r.id)}
                    className="px-3 py-1.5 text-xs border border-[color:var(--border)] rounded-lg text-[color:var(--text)] hover:bg-[var(--surface-soft)]">
                    Review
                  </button>
                </div>
              )}
            </div>
            {reviewing === r.id && (
              <div className="border-t border-[color:var(--border)] px-4 py-3 space-y-2 bg-[var(--surface-soft)]">
                <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Optional note to requester…"
                  className="w-full px-3 py-1.5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
                <div className="flex gap-2">
                  <button onClick={() => review(r.id, "approved")} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--score-good)] text-white rounded-lg text-sm hover:opacity-90">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => review(r.id, "rejected")} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--score-danger)] text-white rounded-lg text-sm hover:opacity-90">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={() => setReviewing(null)} className="px-3 py-1.5 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="text-center py-10 text-[color:var(--text-muted)]">No {filter !== "all" ? filter : ""} requests</div>
        )}
      </div>
    </div>
  );
}
