// src/pages/Reviews.jsx
// Performance Reviews — cycles, review cards, scoring form
import { useState, useEffect } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import { Star, Plus, ChevronDown, ChevronUp, Check, Users, BarChart2 } from "lucide-react";

const STATUS_COLOR = {
  pending:     "bg-gray-100 text-gray-600",
  in_progress: "bg-amber-100 text-amber-700",
  submitted:   "bg-green-100 text-green-700",
};

const CYCLE_STATUS = {
  draft:     "bg-gray-100 text-gray-600",
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
};

export default function Reviews() {
  const api = useApi();
  const { auth } = useAuth();
  const isAdmin = ["admin","owner"].includes(auth?.user?.role);
  const [cycles, setCycles] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState([]);
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", type: "quarterly", start_date: "", end_date: "" });
  const [activeTab, setActiveTab] = useState("reviews"); // reviews | summary

  const loadCycles = () => {
    api.get("/reviews/cycles").then(r => setCycles(r.data || [])).catch(() => {});
  };

  useEffect(() => { loadCycles(); }, []);

  const selectCycle = (cycle) => {
    setActiveCycle(cycle);
    api.get(`/reviews/cycles/${cycle.id}/reviews`).then(r => setReviews(r.data || [])).catch(() => {});
    if (isAdmin) api.get(`/reviews/cycles/${cycle.id}/summary`).then(r => setSummary(r.data || [])).catch(() => {});
  };

  const createCycle = async () => {
    if (!cycleForm.name || !cycleForm.start_date || !cycleForm.end_date) return toast.error("All fields required");
    try {
      await api.post("/reviews/cycles", cycleForm);
      loadCycles();
      setShowNewCycle(false);
      setCycleForm({ name: "", type: "quarterly", start_date: "", end_date: "" });
      toast.success("Review cycle created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const changeStatus = async (id, status) => {
    await api.patch(`/reviews/cycles/${id}/status`, { status }).catch(() => {});
    loadCycles();
    if (activeCycle?.id === id) setActiveCycle(c => ({ ...c, status }));
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
          <Star className="w-6 h-6 text-indigo-500" /> Performance Reviews
        </h1>
        <p className="theme-text-muted text-sm mt-1">Run 360° reviews, self-assessments, and manager evaluations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cycles list */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold theme-text">Review Cycles</h2>
            {isAdmin && (
              <button onClick={() => setShowNewCycle(s => !s)} className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)]">
                <Plus className="w-4 h-4 theme-text-muted" />
              </button>
            )}
          </div>

          {showNewCycle && (
            <div className="theme-surface-card rounded-xl p-4 border theme-border mb-3 space-y-2">
              <input value={cycleForm.name} onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Cycle name" className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
              <select value={cycleForm.type} onChange={e => setCycleForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text">
                {["quarterly","annual","360"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={cycleForm.start_date} onChange={e => setCycleForm(f => ({ ...f, start_date: e.target.value }))}
                  className="px-2 py-1.5 rounded border theme-border theme-surface text-xs theme-text" />
                <input type="date" value={cycleForm.end_date} onChange={e => setCycleForm(f => ({ ...f, end_date: e.target.value }))}
                  className="px-2 py-1.5 rounded border theme-border theme-surface text-xs theme-text" />
              </div>
              <div className="flex gap-1">
                <button onClick={createCycle} className="flex-1 py-1.5 bg-indigo-600 text-white rounded text-xs">Create</button>
                <button onClick={() => setShowNewCycle(false)} className="flex-1 py-1.5 border theme-border rounded text-xs theme-text">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {cycles.map(c => (
              <div key={c.id}
                onClick={() => selectCycle(c)}
                className={`rounded-xl p-3 border cursor-pointer transition-colors ${activeCycle?.id === c.id ? "border-indigo-400 bg-indigo-50" : "theme-border theme-surface-card hover:border-indigo-200"}`}>
                <div className="flex items-start justify-between mb-1">
                  <p className="text-sm font-medium theme-text">{c.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 shrink-0 ${CYCLE_STATUS[c.status]}`}>{c.status}</span>
                </div>
                <p className="text-xs theme-text-muted">{c.type} · {c.start_date} → {c.end_date}</p>
                <p className="text-xs theme-text-muted">{c.review_count} reviews</p>
                {isAdmin && c.status !== "completed" && (
                  <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                    {c.status === "draft" && (
                      <button onClick={() => changeStatus(c.id, "active")} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Activate</button>
                    )}
                    {c.status === "active" && (
                      <button onClick={() => changeStatus(c.id, "completed")} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Complete</button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {cycles.length === 0 && <p className="text-sm theme-text-muted text-center py-6">No review cycles yet</p>}
          </div>
        </div>

        {/* Reviews panel */}
        <div className="lg:col-span-2">
          {activeCycle ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold theme-text flex-1">{activeCycle.name}</h2>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => setActiveTab("reviews")} className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === "reviews" ? "bg-indigo-600 text-white" : "border theme-border theme-text"}`}>
                      <Users className="w-4 h-4 inline mr-1" />Reviews
                    </button>
                    <button onClick={() => setActiveTab("summary")} className={`px-3 py-1.5 rounded-lg text-sm ${activeTab === "summary" ? "bg-indigo-600 text-white" : "border theme-border theme-text"}`}>
                      <BarChart2 className="w-4 h-4 inline mr-1" />Summary
                    </button>
                  </div>
                )}
              </div>

              {activeTab === "reviews" && (
                <div className="space-y-3">
                  {reviews.map(r => (
                    <ReviewCard key={r.id} review={r} cycleId={activeCycle.id} onRefresh={() => selectCycle(activeCycle)} />
                  ))}
                  {reviews.length === 0 && (
                    <div className="text-center py-10">
                      <Star className="w-10 h-10 mx-auto mb-3 text-indigo-200" />
                      <p className="theme-text-muted text-sm">No reviews assigned in this cycle yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "summary" && isAdmin && (
                <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-soft)] border-b theme-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-semibold theme-text-muted">Member</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold theme-text-muted">Reviews</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold theme-text-muted">Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map(s => (
                        <tr key={s.reviewee_id} className="border-b theme-border hover:bg-[var(--surface-soft)]">
                          <td className="px-4 py-3 font-medium theme-text">{s.username}</td>
                          <td className="px-4 py-3 text-right theme-text-muted">{s.submitted}/{s.total}</td>
                          <td className="px-4 py-3 text-right">
                            {s.avg_score ? (
                              <span className="flex items-center justify-end gap-1">
                                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                <span className="font-semibold theme-text">{s.avg_score}</span>
                              </span>
                            ) : <span className="theme-text-muted">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <p className="theme-text-muted text-sm">Select a review cycle to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review, onRefresh }) {
  const api = useApi();
  const { auth } = useAuth();
  const isMine = review.reviewer_id === auth?.user?.id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    overall_score: review.overall_score || "",
    strengths: review.strengths || "",
    improvements: review.improvements || "",
    goals_next: review.goals_next || "",
    status: review.status,
  });
  const [saving, setSaving] = useState(false);

  const save = async (submit = false) => {
    setSaving(true);
    try {
      await api.put(`/reviews/reviews/${review.id}`, { ...form, status: submit ? "submitted" : "in_progress" });
      onRefresh();
      if (submit) { setOpen(false); toast.success("Review submitted!"); }
      else toast.success("Draft saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  const renderStars = (score) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => isMine && setForm(f => ({ ...f, overall_score: n }))}
          className={`${isMine ? "cursor-pointer" : "cursor-default"}`}>
          <Star className={`w-5 h-5 ${n <= (form.overall_score || score || 0) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => isMine && setOpen(o => !o)}>
        <div className="flex-1">
          <p className="text-sm font-medium theme-text">
            {review.type === "self" ? "Self Review" : `Review of ${review.reviewee_name}`}
          </p>
          <p className="text-xs theme-text-muted">By {review.reviewer_name} · {review.type}</p>
        </div>
        {review.overall_score && renderStars(review.overall_score)}
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[review.status]}`}>{review.status.replace("_"," ")}</span>
        {isMine && review.status !== "submitted" && (
          open ? <ChevronUp className="w-4 h-4 theme-text-muted" /> : <ChevronDown className="w-4 h-4 theme-text-muted" />
        )}
        {review.status === "submitted" && <Check className="w-4 h-4 text-green-500" />}
      </div>

      {open && isMine && (
        <div className="border-t theme-border px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium theme-text mb-1">Overall Rating</label>
            {renderStars()}
          </div>
          {[
            { key: "strengths", label: "Strengths", placeholder: "What does this person do well?" },
            { key: "improvements", label: "Areas for Improvement", placeholder: "What could be improved?" },
            { key: "goals_next", label: "Goals for Next Period", placeholder: "What should they focus on next?" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium theme-text mb-1">{label}</label>
              <textarea
                value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} rows={3}
                className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text"
              />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => save(false)} disabled={saving} className="px-3 py-2 border theme-border rounded-lg text-sm theme-text">
              Save Draft
            </button>
            <button onClick={() => save(true)} disabled={saving} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
              {saving ? "Submitting…" : "Submit Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
