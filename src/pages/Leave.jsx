// src/pages/Leave.jsx
// Leave Management — apply, view balance, admin review, calendar view
import { useState, useEffect } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CalendarDays, Plus, Check, X, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Users,
} from "lucide-react";

const STATUS_BADGE = {
  pending:   "bg-amber-100 text-amber-700",
  approved:  "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const TABS = ["My Leaves", "Team Calendar", "Admin"];

export default function Leave() {
  const api = useApi();
  const { auth } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = ["admin", "owner"].includes(auth?.user?.role);

  const TAB_MAP = { admin: "Admin", my: "My Leaves", calendar: "Team Calendar" };
  const initialTab = TAB_MAP[searchParams.get("tab")] || "My Leaves";
  const [tab, setTab] = useState(isAdmin && initialTab === "Admin" ? "Admin" : initialTab);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-indigo-500" /> Leave Management
          </h1>
          <p className="theme-text-muted text-sm mt-1">Manage time off requests and balances</p>
        </div>
      </div>

      <div className="flex gap-1 border-b theme-border mb-6">
        {TABS.filter(t => t !== "Admin" || isAdmin).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${tab === t ? "border-b-2 border-indigo-500 text-indigo-600 -mb-px" : "theme-text-muted hover:theme-text"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "My Leaves"    && <MyLeavesTab />}
      {tab === "Team Calendar" && <CalendarTab />}
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
              <div key={b.id} className="theme-surface-card rounded-xl p-4 border theme-border text-center">
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ background: b.color }} />
                <p className="text-xs theme-text-muted">{b.name}</p>
                <p className="text-2xl font-bold theme-text mt-1">{remaining}</p>
                <p className="text-xs theme-text-muted">of {b.allocated || 0} remaining</p>
              </div>
            );
          })}
        </div>
      )}

      {/* New request button */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold theme-text">My Requests</h2>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      {/* Request form */}
      {showForm && (
        <div className="theme-surface-card rounded-xl p-5 border theme-border space-y-4">
          <h3 className="font-medium theme-text">Apply for Leave</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium theme-text mb-1">Leave Type *</label>
              <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text">
                {types.map(t => <option key={t.id} value={t.id}>{t.name}{t.max_days ? ` (max ${t.max_days} days/yr)` : ""}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="block text-sm font-medium theme-text mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
            </div>
            <div>
              <label className="block text-sm font-medium theme-text mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                min={form.start_date}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium theme-text mb-1">Reason (optional)</label>
              <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">Cancel</button>
          </div>
        </div>
      )}

      {/* Request list */}
      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="flex items-center gap-3 theme-surface-card rounded-xl px-4 py-3 border theme-border">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: r.leave_type_color }} />
            <div className="flex-1">
              <p className="text-sm font-medium theme-text">{r.leave_type_name}</p>
              <p className="text-xs theme-text-muted">{r.start_date} → {r.end_date} · {r.days} day{r.days !== 1 ? "s" : ""}</p>
              {r.reason && <p className="text-xs theme-text-muted italic mt-0.5">"{r.reason}"</p>}
              {r.review_note && <p className="text-xs text-amber-600 mt-0.5">Note: {r.review_note}</p>}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
            {r.status === "pending" && (
              <button onClick={() => cancel(r.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Cancel">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="text-center py-10">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-indigo-200" />
            <p className="theme-text-muted">No leave requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Team Calendar ─────────────────────────────────────────────────────────────
function CalendarTab() {
  const api = useApi();
  const [requests, setRequests] = useState([]);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    const start = new Date(month.year, month.month, 1).toISOString().split("T")[0];
    const end   = new Date(month.year, month.month + 1, 0).toISOString().split("T")[0];
    api.get(`/leave/requests?status=approved&startDate=${start}&endDate=${end}`).then(r => setRequests(r.data || [])).catch(() => {});
  }, [month]);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const firstDow = new Date(month.year, month.month, 1).getDay();
  const monthName = new Date(month.year, month.month).toLocaleString("default", { month: "long", year: "numeric" });

  // Map date -> requests
  const dateMap = {};
  requests.forEach(r => {
    const cur = new Date(r.start_date);
    const end = new Date(r.end_date);
    while (cur <= end) {
      const k = cur.toISOString().split("T")[0];
      if (!dateMap[k]) dateMap[k] = [];
      dateMap[k].push(r);
      cur.setDate(cur.getDate() + 1);
    }
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold theme-text">{monthName}</h2>
        <div className="flex gap-2">
          <button onClick={() => setMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-1.5 rounded-lg border theme-border hover:bg-[var(--surface-soft)]">
            <ChevronLeft className="w-4 h-4 theme-text" />
          </button>
          <button onClick={() => setMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-1.5 rounded-lg border theme-border hover:bg-[var(--surface-soft)]">
            <ChevronRight className="w-4 h-4 theme-text" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-xl overflow-hidden border theme-border">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="bg-[var(--surface-soft)] text-center py-2 text-xs font-semibold theme-text-muted">{d}</div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} className="theme-surface min-h-16" />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayRequests = dateMap[key] || [];
          const isToday = new Date().toISOString().split("T")[0] === key;
          return (
            <div key={day} className={`theme-surface min-h-16 p-1 ${isToday ? "ring-2 ring-indigo-400 ring-inset" : ""}`}>
              <span className={`text-xs font-medium ${isToday ? "text-indigo-600" : "theme-text-muted"}`}>{day}</span>
              {dayRequests.slice(0, 3).map(r => (
                <div key={r.id} className="text-xs px-1 py-0.5 rounded mt-0.5 truncate" style={{ background: r.leave_type_color + "30", color: r.leave_type_color }}>
                  {r.username?.split(" ")[0]}
                </div>
              ))}
              {dayRequests.length > 3 && <div className="text-xs theme-text-muted">+{dayRequests.length - 3}</div>}
            </div>
          );
        })}
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
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize ${filter === s ? "bg-indigo-600 text-white" : "border theme-border theme-text-muted hover:theme-text"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {requests.map(r => (
          <div key={r.id} className="theme-surface-card rounded-xl border theme-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium theme-text">{r.username} <span className="theme-text-muted font-normal">— {r.leave_type_name}</span></p>
                <p className="text-xs theme-text-muted">{r.start_date} → {r.end_date} · {r.days} day{r.days !== 1 ? "s" : ""}</p>
                {r.reason && <p className="text-xs theme-text-muted italic mt-0.5">"{r.reason}"</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
              {r.status === "pending" && (
                <div className="flex gap-1">
                  <button onClick={() => setReviewing(r.id === reviewing ? null : r.id)}
                    className="px-3 py-1.5 text-xs border theme-border rounded-lg theme-text hover:bg-[var(--surface-soft)]">
                    Review
                  </button>
                </div>
              )}
            </div>
            {reviewing === r.id && (
              <div className="border-t theme-border px-4 py-3 space-y-2 bg-[var(--surface-soft)]">
                <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Optional note to requester…"
                  className="w-full px-3 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <div className="flex gap-2">
                  <button onClick={() => review(r.id, "approved")} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => review(r.id, "rejected")} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={() => setReviewing(null)} className="px-3 py-1.5 border theme-border rounded-lg text-sm theme-text">Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <div className="text-center py-10 theme-text-muted">No {filter !== "all" ? filter : ""} requests</div>
        )}
      </div>
    </div>
  );
}
