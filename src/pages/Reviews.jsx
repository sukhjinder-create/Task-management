// src/pages/Reviews.jsx
// Performance Reviews — fully automated 360° review system
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import {
  Star, Plus, Check, Users, Calendar, ChevronDown, ChevronUp,
  UserCheck, Clock, TrendingUp, Zap,
} from "lucide-react";

const STATUS_COLOR = {
  pending:     "bg-amber-500/10 text-amber-500",
  in_progress: "bg-blue-500/10 text-blue-500",
  submitted:   "bg-green-500/10 text-green-500",
};
const CYCLE_STATUS_COLOR = {
  draft:     "bg-gray-500/10 text-gray-500",
  active:    "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
};
const TYPE_LABEL = { self: "Self", peer: "Peer", manager: "Manager", upward: "Upward" };
const TYPE_COLOR = {
  self:    "bg-purple-500/10 text-purple-500",
  peer:    "bg-indigo-500/10 text-indigo-500",
  manager: "bg-blue-500/10 text-blue-500",
  upward:  "bg-orange-500/10 text-orange-500",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  return diff;
}

export default function Reviews() {
  const api = useApi();
  const { auth } = useAuth();
  const isAdmin = ["admin", "owner"].includes(auth?.user?.role);

  const [tab, setTab] = useState("pending");
  const [pendingReviews, setPendingReviews] = useState([]);
  const [aboutMeReviews, setAboutMeReviews] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [team, setTeam] = useState([]);
  // Cycle create form
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [cycleForm, setCycleForm] = useState({ name: "", type: "quarterly", start_date: "", end_date: "", peer_review_count: 2 });
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [triggeringQuarter, setTriggeringQuarter] = useState(false);

  // Summary modal
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [modalTab, setModalTab] = useState("submitted"); // "submitted" | "pending"

  const loadPending = useCallback(() => {
    api.get("/reviews/pending").then(r => setPendingReviews(r.data || [])).catch(() => {});
  }, [api]);

  const loadAboutMe = useCallback(() => {
    api.get("/reviews/about-me").then(r => setAboutMeReviews(r.data || [])).catch(() => {});
  }, [api]);

  const loadCycles = useCallback(() => {
    api.get("/reviews/cycles").then(r => setCycles(r.data || [])).catch(() => {});
  }, [api]);

  const loadTeam = useCallback(() => {
    if (!isAdmin) return;
    api.get("/reviews/team").then(r => setTeam(r.data || [])).catch(() => {});
  }, [api, isAdmin]);

  useEffect(() => {
    loadPending();
    loadAboutMe();
    if (isAdmin) { loadCycles(); loadTeam(); }
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "pending") loadPending();
    if (t === "aboutme") loadAboutMe();
    if (t === "cycles") loadCycles();
    if (t === "team") loadTeam();
  };

  const createCycle = async () => {
    if (!cycleForm.name || !cycleForm.start_date || !cycleForm.end_date)
      return toast.error("Name and dates are required");
    setCreatingCycle(true);
    try {
      await api.post("/reviews/cycles", cycleForm);
      loadCycles();
      setShowNewCycle(false);
      setCycleForm({ name: "", type: "quarterly", start_date: "", end_date: "", peer_review_count: 2 });
      toast.success("Cycle created");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setCreatingCycle(false);
  };

  const activateCycle = async (id) => {
    try {
      await api.patch(`/reviews/cycles/${id}/status`, { status: "active" });
      toast.success("Cycle activated — reviews are being assigned");
      loadCycles();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const completeCycle = async (id) => {
    try {
      await api.patch(`/reviews/cycles/${id}/status`, { status: "completed" });
      toast.success("Cycle marked complete");
      loadCycles();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
  };

  const triggerQuarter = async () => {
    setTriggeringQuarter(true);
    try {
      const r = await api.post("/reviews/trigger-quarter");
      toast.success(`Quarterly cycle started — ${r.data.reviewerCount} reviewers notified`);
      loadCycles();
      setTab("cycles");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setTriggeringQuarter(false);
  };

  const openSummary = async (cycle) => {
    setSummaryLoading(true);
    setSummaryData(null);
    setModalTab("submitted");
    try {
      const [summaryRes, reviewsRes] = await Promise.all([
        api.get(`/reviews/cycles/${cycle.id}/summary`),
        api.get(`/reviews/cycles/${cycle.id}/reviews`),
      ]);
      setSummaryData({ cycle, stats: summaryRes.data || [], reviews: reviewsRes.data || [] });
    } catch { toast.error("Failed to load cycle detail"); }
    setSummaryLoading(false);
  };

  const setManager = async (userId, managerId) => {
    try {
      await api.patch(`/reviews/team/${userId}/manager`, { manager_id: managerId || null });
      setTeam(prev => prev.map(m => {
        if (m.user_id !== userId) return m;
        const mgr = team.find(t => t.user_id === managerId);
        return { ...m, manager_id: managerId || null, manager_name: mgr?.username || null };
      }));
    } catch { toast.error("Failed to save"); }
  };

  const pendingCount = pendingReviews.length;
  const avgAboutMe = aboutMeReviews.length
    ? (aboutMeReviews.reduce((s, r) => s + (r.overall_score || 0), 0) / aboutMeReviews.length).toFixed(1)
    : null;

  const TABS = [
    { key: "pending",  label: "To Review",  icon: <Clock className="w-4 h-4" />,      badge: pendingCount || null },
    { key: "aboutme",  label: "About Me",   icon: <UserCheck className="w-4 h-4" /> },
    ...(isAdmin ? [
      { key: "cycles", label: "Cycles",     icon: <Calendar className="w-4 h-4" /> },
      { key: "team",   label: "Team",       icon: <Users className="w-4 h-4" /> },
    ] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold theme-text flex items-center gap-2">
            <Star className="w-6 h-6 text-indigo-500" /> Performance Reviews
          </h1>
          <p className="theme-text-muted text-sm mt-1">
            Quarterly cycles are created automatically — self, peer & manager reviews assigned
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={triggerQuarter}
            disabled={triggeringQuarter}
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 shrink-0"
          >
            <Zap className="w-4 h-4" />
            {triggeringQuarter ? "Starting…" : "Start This Quarter"}
          </button>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending for You" value={pendingCount} color="amber" icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Reviews About Me" value={aboutMeReviews.length} color="indigo" icon={<UserCheck className="w-4 h-4" />} />
        <StatCard label="My Avg Score" value={avgAboutMe ? `${avgAboutMe}/5` : "—"} color="green" icon={<Star className="w-4 h-4" />} />
        <StatCard label="Active Cycles" value={cycles.filter(c => c.status === "active").length} color="blue" icon={<Calendar className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b theme-border">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === t.key
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent theme-text-muted hover:theme-text"}`}
          >
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TO REVIEW ───────────────────────────────────────────────────────── */}
      {tab === "pending" && (
        <div>
          {pendingReviews.length === 0 ? (
            <EmptyState icon={<Check className="w-10 h-10 text-green-400" />}
              title="All caught up!" subtitle="No pending reviews assigned to you right now." />
          ) : (
            <div className="space-y-3">
              {/* Group by cycle */}
              {groupBy(pendingReviews, "cycle_name").map(([cycleName, reviews]) => {
                const daysLeft = daysUntil(reviews[0]?.cycle_end_date);
                return (
                  <div key={cycleName}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold theme-text">{cycleName}</p>
                      {daysLeft !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${daysLeft <= 1 ? "bg-red-500/10 text-red-500" : daysLeft <= 7 ? "bg-amber-500/10 text-amber-500" : "bg-gray-500/10 text-gray-500"}`}>
                          {daysLeft <= 0 ? "Overdue" : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                    {reviews.map(r => (
                      <ReviewCard
                        key={r.id} review={r}
                        onRefresh={loadPending}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ABOUT ME ────────────────────────────────────────────────────────── */}
      {tab === "aboutme" && (
        <div>
          {aboutMeReviews.length === 0 ? (
            <EmptyState icon={<Star className="w-10 h-10 text-indigo-200" />}
              title="No reviews yet" subtitle="Submitted reviews about you will appear here once a cycle closes." />
          ) : (
            <div>
              {/* Avg score banner */}
              {avgAboutMe && (
                <div className="theme-surface-card border theme-border rounded-xl px-5 py-4 mb-5 flex items-center gap-4">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-5 h-5 ${n <= Math.round(avgAboutMe) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <div>
                    <p className="text-xl font-bold theme-text">{avgAboutMe} <span className="text-sm font-normal theme-text-muted">/ 5 average</span></p>
                    <p className="text-xs theme-text-muted">{aboutMeReviews.length} submitted review{aboutMeReviews.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {groupBy(aboutMeReviews, "cycle_name").map(([cycleName, reviews]) => (
                  <div key={cycleName}>
                    <p className="text-xs font-semibold theme-text-muted uppercase tracking-wide mb-2">{cycleName}</p>
                    {reviews.map(r => (
                      <AboutMeCard key={r.id} review={r} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CYCLES (admin) ──────────────────────────────────────────────────── */}
      {tab === "cycles" && isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm theme-text-muted">
              Quarterly cycles are auto-created each quarter. You can also create custom cycles manually.
            </p>
            <button onClick={() => setShowNewCycle(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 border theme-border rounded-lg text-sm theme-text hover:bg-[var(--surface-soft)]">
              <Plus className="w-4 h-4" /> New Cycle
            </button>
          </div>

          {showNewCycle && (
            <div className="theme-surface-card rounded-xl p-4 border theme-border mb-4 space-y-3">
              <h3 className="text-sm font-semibold theme-text">Create Review Cycle</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={cycleForm.name} onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Cycle name (e.g. Q2 2026)" className="col-span-2 px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <select value={cycleForm.type} onChange={e => setCycleForm(f => ({ ...f, type: e.target.value }))}
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text">
                  {["quarterly","annual","360"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" min="0" max="5" value={cycleForm.peer_review_count}
                  onChange={e => setCycleForm(f => ({ ...f, peer_review_count: Number(e.target.value) }))}
                  placeholder="Peer reviews per person"
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <input type="date" value={cycleForm.start_date} onChange={e => setCycleForm(f => ({ ...f, start_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
                <input type="date" value={cycleForm.end_date} onChange={e => setCycleForm(f => ({ ...f, end_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text" />
              </div>
              <div className="flex gap-2">
                <button onClick={createCycle} disabled={creatingCycle}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {creatingCycle ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowNewCycle(false)} className="px-4 py-2 border theme-border rounded-lg text-sm theme-text">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {cycles.length === 0 && (
              <EmptyState icon={<Calendar className="w-10 h-10 text-indigo-200" />}
                title="No cycles yet"
                subtitle='Click "Start This Quarter" to auto-create and assign reviews instantly.' />
            )}
            {cycles.map(c => {
              const daysLeft = daysUntil(c.end_date);
              return (
                <div
                  key={c.id}
                  onClick={() => openSummary(c)}
                  className="theme-surface-card rounded-xl border theme-border p-4 cursor-pointer hover:border-indigo-400/50 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold theme-text group-hover:text-indigo-500 transition-colors">{c.name}</p>
                        {c.auto_generated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-medium">AUTO</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CYCLE_STATUS_COLOR[c.status]}`}>{c.status}</span>
                      </div>
                      <p className="text-xs theme-text-muted mt-0.5">
                        {c.type} · {c.start_date} → {c.end_date}
                        {daysLeft !== null && c.status === "active" && (
                          <span className={`ml-2 ${daysLeft <= 3 ? "text-red-500" : daysLeft <= 7 ? "text-amber-500" : ""}`}>
                            · {daysLeft <= 0 ? "Overdue" : `${daysLeft}d remaining`}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <ProgressBar done={Number(c.submitted_count)} total={Number(c.review_count)} />
                        <span className="text-xs theme-text-muted shrink-0">
                          {c.submitted_count}/{c.review_count} submitted
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {c.status === "draft" && (
                        <button onClick={() => activateCycle(c.id)}
                          className="px-2.5 py-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500/15 rounded-lg text-xs font-medium">
                          Activate
                        </button>
                      )}
                      {c.status === "active" && (
                        <button onClick={() => completeCycle(c.id)}
                          className="px-2.5 py-1 bg-green-500/10 text-green-500 hover:bg-green-500/15 rounded-lg text-xs font-medium">
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cycle detail modal */}
          {(summaryData || summaryLoading) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="theme-surface rounded-2xl border theme-border w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b theme-border shrink-0">
                  <div>
                    <h3 className="font-semibold theme-text">{summaryData?.cycle?.name || "Cycle Detail"}</h3>
                    {summaryData && (
                      <p className="text-xs theme-text-muted mt-0.5">
                        {summaryData.stats.length} member{summaryData.stats.length !== 1 ? "s" : ""} ·{" "}
                        {summaryData.stats.reduce((s,r) => s + Number(r.submitted), 0)}/
                        {summaryData.stats.reduce((s,r) => s + Number(r.total), 0)} reviews submitted
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSummaryData(null)} className="theme-text-muted hover:theme-text text-xl leading-none">✕</button>
                </div>

                {summaryLoading ? (
                  <div className="py-16 text-center theme-text-muted text-sm">Loading reviews…</div>
                ) : (() => {
                  // Pre-compute per-member submitted/pending counts
                  const memberData = summaryData.stats.map(member => {
                    const memberReviews = summaryData.reviews.filter(r => r.reviewee_id === member.reviewee_id);
                    const submitted = memberReviews.filter(r => r.status === "submitted");
                    const pending   = memberReviews.filter(r => r.status !== "submitted");
                    return { member, memberReviews, submitted, pending };
                  });
                  const totalSubmitted = memberData.reduce((s, m) => s + m.submitted.length, 0);
                  const totalPending   = memberData.reduce((s, m) => s + m.pending.length, 0);

                  return (
                    <>
                      {/* Modal-level tabs */}
                      <div className="flex border-b theme-border shrink-0">
                        {[
                          { key: "submitted", label: "Submitted",     count: totalSubmitted, activeColor: "border-green-500 text-green-500",  badgeColor: "bg-green-500/10 text-green-500" },
                          { key: "pending",   label: "Not Submitted", count: totalPending,   activeColor: "border-amber-500 text-amber-500",  badgeColor: "bg-amber-500/10 text-amber-500" },
                        ].map(t => (
                          <button
                            key={t.key}
                            onClick={() => setModalTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                              ${modalTab === t.key ? t.activeColor : "border-transparent theme-text-muted hover:theme-text"}`}
                          >
                            {t.label}
                            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${modalTab === t.key ? t.badgeColor : "bg-[var(--surface-strong)] theme-text-muted"}`}>
                              {t.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="overflow-y-auto flex-1 p-4 space-y-3">
                        {summaryData.stats.length === 0 && (
                          <p className="text-center theme-text-muted text-sm py-8">No reviews in this cycle yet.</p>
                        )}

                        {/* Submitted tab — member cards with only submitted reviews */}
                        {modalTab === "submitted" && memberData
                          .filter(m => m.submitted.length > 0)
                          .map(({ member, submitted }) => (
                            <MemberReviewGroup
                              key={member.reviewee_id}
                              member={member}
                              reviews={submitted}
                              mode="submitted"
                            />
                          ))
                        }
                        {modalTab === "submitted" && memberData.every(m => m.submitted.length === 0) && (
                          <p className="text-center theme-text-muted text-sm py-8">No reviews submitted yet.</p>
                        )}

                        {/* Pending tab — member cards with only pending reviews */}
                        {modalTab === "pending" && memberData
                          .filter(m => m.pending.length > 0)
                          .map(({ member, pending }) => (
                            <MemberReviewGroup
                              key={member.reviewee_id}
                              member={member}
                              reviews={pending}
                              mode="pending"
                            />
                          ))
                        }
                        {modalTab === "pending" && memberData.every(m => m.pending.length === 0) && (
                          <p className="text-center theme-text-muted text-sm py-8">Everyone has submitted — all done!</p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TEAM / REPORTING LINES (admin) ──────────────────────────────────── */}
      {tab === "team" && isAdmin && (
        <div>
          <p className="text-sm theme-text-muted mb-4">
            Set who each person reports to. This drives automatic <strong>manager reviews</strong> in every cycle.
          </p>
          <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-soft)] border-b theme-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold theme-text-muted">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold theme-text-muted">Reports To</th>
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m.user_id} className="border-b theme-border hover:bg-[var(--surface-soft)]">
                    <td className="px-4 py-3">
                      <p className="font-medium theme-text">{m.username}</p>
                      <p className="text-xs theme-text-muted">{m.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={m.manager_id || ""}
                        onChange={e => setManager(m.user_id, e.target.value || null)}
                        className="px-2 py-1.5 rounded-lg border theme-border theme-surface text-sm theme-text max-w-[200px]"
                      >
                        <option value="">— No manager —</option>
                        {team.filter(t => t.user_id !== m.user_id).map(t => (
                          <option key={t.user_id} value={t.user_id}>{t.username}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-8 text-center text-sm theme-text-muted">No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── REVIEW CARD (to fill) ────────────────────────────────────────────────────

function ReviewCard({ review, onRefresh }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [form, setForm] = useState({
    overall_score: review.overall_score || 0,
    strengths: review.strengths || "",
    improvements: review.improvements || "",
    goals_next: review.goals_next || "",
  });
  const [saving, setSaving] = useState(false);

  const loadContext = async () => {
    if (context || review.type === "self") return;
    try {
      const r = await api.get(`/reviews/user-context/${review.reviewee_id}`);
      setContext(r.data);
    } catch { /* no context */ }
  };

  const toggleOpen = () => {
    if (!open) loadContext();
    setOpen(o => !o);
  };

  const save = async (submit = false) => {
    setSaving(true);
    try {
      await api.put(`/reviews/reviews/${review.id}`, {
        ...form,
        status: submit ? "submitted" : "in_progress",
      });
      if (submit) { toast.success("Review submitted!"); onRefresh(); setOpen(false); }
      else toast.success("Draft saved");
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={toggleOpen}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium theme-text">
              {review.type === "self" ? "Self Review" : `Review of ${review.reviewee_name}`}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[review.type]}`}>
              {TYPE_LABEL[review.type]}
            </span>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[review.status]}`}>
          {review.status.replace("_", " ")}
        </span>
        {open ? <ChevronUp className="w-4 h-4 theme-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 theme-text-muted shrink-0" />}
      </div>

      {open && (
        <div className="border-t theme-border">
          {/* Intelligence context */}
          {context && (
            <div className="px-4 py-3 bg-indigo-500/5 border-b border-indigo-500/10">
              <p className="text-[11px] font-semibold text-indigo-500 mb-1.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Intelligence Context — {context.month}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs theme-text-muted">Score</span>
                  <span className={`text-sm font-bold ${context.score >= 70 ? "text-green-500" : context.score >= 40 ? "text-amber-500" : "text-red-500"}`}>
                    {context.score}/100
                  </span>
                </div>
                {context.breakdown?.attendance && (
                  <span className="text-xs theme-text-muted">
                    Attendance <strong className="theme-text">{context.breakdown.attendance.score}/100</strong>
                  </span>
                )}
                {context.breakdown?.productivity && (
                  <span className="text-xs theme-text-muted">
                    Tasks <strong className="theme-text">{context.breakdown.productivity.score}/100</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="px-4 py-4 space-y-4">
            {/* Star rating */}
            <div>
              <label className="block text-sm font-medium theme-text mb-2">Overall Rating</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setForm(f => ({ ...f, overall_score: n }))}>
                    <Star className={`w-7 h-7 transition-colors ${n <= form.overall_score ? "text-amber-400 fill-amber-400" : "text-gray-300 hover:text-amber-300"}`} />
                  </button>
                ))}
                {form.overall_score > 0 && (
                  <span className="ml-2 self-center text-sm font-medium theme-text-muted">{form.overall_score}/5</span>
                )}
              </div>
            </div>

            {[
              { key: "strengths",    label: "Strengths",              placeholder: "What does this person do really well?" },
              { key: "improvements", label: "Areas for Improvement",  placeholder: "Where can they grow?" },
              { key: "goals_next",   label: "Goals for Next Quarter", placeholder: "What should they focus on next?" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-medium theme-text mb-1">{label}</label>
                <textarea
                  value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} rows={3}
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-surface text-sm theme-text resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <button onClick={() => save(false)} disabled={saving}
                className="px-4 py-2 border theme-border rounded-lg text-sm theme-text hover:bg-[var(--surface-soft)] disabled:opacity-60">
                Save Draft
              </button>
              <button onClick={() => save(true)} disabled={saving || !form.overall_score}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {saving ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ABOUT ME CARD ────────────────────────────────────────────────────────────

function AboutMeCard({ review }) {
  const [open, setOpen] = useState(false);
  const isPeer = review.type === "peer";

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium theme-text">
              {isPeer ? "Anonymous peer" : review.reviewer_name}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[review.type]}`}>
              {TYPE_LABEL[review.type]}
            </span>
            <span className="text-xs theme-text-muted">· {review.cycle_name}</span>
          </div>
        </div>
        {review.overall_score && (
          <div className="flex gap-0.5 shrink-0">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-4 h-4 ${n <= review.overall_score ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
            ))}
          </div>
        )}
        {open ? <ChevronUp className="w-4 h-4 theme-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 theme-text-muted shrink-0" />}
      </div>

      {open && (
        <div className="border-t theme-border px-4 py-4 space-y-3">
          {[
            { key: "strengths", label: "Strengths" },
            { key: "improvements", label: "Areas for Improvement" },
            { key: "goals_next", label: "Goals for Next Quarter" },
          ].map(({ key, label }) => review[key] && (
            <div key={key}>
              <p className="text-xs font-semibold theme-text-muted uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm theme-text">{review[key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: MEMBER REVIEW GROUP (inside cycle detail modal) ──────────────────

// mode="submitted" → reviews are all submitted; mode="pending" → reviews are all pending
function MemberReviewGroup({ member, reviews, mode = "submitted" }) {
  const [expanded, setExpanded] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  // Summary data — only relevant in submitted mode
  const byType = ["self", "manager", "peer"].map(type => {
    const typed = reviews.filter(r => r.type === type && r.overall_score);
    if (!typed.length) return null;
    const avg = (typed.reduce((s, r) => s + Number(r.overall_score), 0) / typed.length).toFixed(1);
    return { type, avg, count: typed.length };
  }).filter(Boolean);

  const allStrengths    = reviews.map(r => r.strengths).filter(Boolean);
  const allImprovements = reviews.map(r => r.improvements).filter(Boolean);
  const allGoals        = reviews.map(r => r.goals_next).filter(Boolean);
  const hasSummary      = mode === "submitted" && (byType.length > 0 || allStrengths.length > 0);

  return (
    <div className="theme-surface-card rounded-xl border theme-border overflow-hidden">
      {/* Member header */}
      <div className="px-4 py-3 border-b theme-border flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold theme-text">{member.username}</p>
          <p className="text-xs theme-text-muted">
            {mode === "submitted"
              ? `${reviews.length} review${reviews.length !== 1 ? "s" : ""} submitted`
              : `${reviews.length} review${reviews.length !== 1 ? "s" : ""} not submitted`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "submitted" && member.avg_score && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(member.avg_score) ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
                ))}
              </div>
              <span className="text-sm font-bold theme-text">{member.avg_score}/5</span>
            </div>
          )}
          {hasSummary && (
            <button
              onClick={() => setShowSummary(s => !s)}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${showSummary ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" : "border-[var(--border)] theme-text-muted hover:theme-text"}`}
            >
              {showSummary ? "Hide Summary" : "Summary"}
            </button>
          )}
        </div>
      </div>

      {/* ── Per-user summary panel ── */}
      {showSummary && (
        <div className="px-4 py-4 bg-indigo-500/5 border-b border-indigo-500/10 space-y-4">
          {byType.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wide mb-2">Score Breakdown</p>
              <div className="flex gap-3 flex-wrap">
                {byType.map(({ type, avg, count }) => (
                  <div key={type} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${TYPE_COLOR[type]}`} style={{background:"var(--surface-soft)"}}>
                    <span className="text-xs font-medium">{TYPE_LABEL[type]}</span>
                    <span className="text-sm font-bold">{avg}/5</span>
                    {count > 1 && <span className="text-[10px] opacity-60">({count})</span>}
                  </div>
                ))}
              </div>
              {(() => {
                const self = byType.find(t => t.type === "self");
                const ext  = byType.filter(t => t.type !== "self");
                if (!self || !ext.length) return null;
                const extAvg = (ext.reduce((s,t) => s + Number(t.avg), 0) / ext.length).toFixed(1);
                const diff   = (Number(self.avg) - Number(extAvg)).toFixed(1);
                return (
                  <p className="text-xs theme-text-muted mt-1.5">
                    Self-assessed <strong className="theme-text">{Number(diff) > 0 ? `+${diff}` : diff}</strong> vs others' average
                    {" · "}{Number(diff) > 0.5 ? "may be overestimating" : Number(diff) < -0.5 ? "may be underestimating" : "well-calibrated"}
                  </p>
                );
              })()}
            </div>
          )}

          {allStrengths.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-green-500 uppercase tracking-wide mb-2">
                Strengths · <span className="normal-case font-normal">{allStrengths.length} reviewer{allStrengths.length !== 1 ? "s" : ""}</span>
              </p>
              <div className="space-y-2">
                {allStrengths.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm theme-text">
                    <span className="text-green-500 shrink-0">•</span>
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allImprovements.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-2">
                Areas for Improvement · <span className="normal-case font-normal">{allImprovements.length} reviewer{allImprovements.length !== 1 ? "s" : ""}</span>
              </p>
              <div className="space-y-2">
                {allImprovements.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm theme-text">
                    <span className="text-amber-500 shrink-0">•</span>
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allGoals.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-2">
                Goals for Next Quarter · <span className="normal-case font-normal">{allGoals.length} reviewer{allGoals.length !== 1 ? "s" : ""}</span>
              </p>
              <div className="space-y-2">
                {allGoals.map((s, i) => (
                  <div key={i} className="flex gap-2 text-sm theme-text">
                    <span className="text-blue-500 shrink-0">→</span>
                    <span className="leading-relaxed">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Submitted mode: expandable review cards ── */}
      {mode === "submitted" && (
        <div className="divide-y theme-border">
          {reviews.map(r => (
            <div key={r.id}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-soft)] transition-colors text-left"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[r.type]}`}>
                  {TYPE_LABEL[r.type]}
                </span>
                <span className="text-sm theme-text flex-1">by <strong>{r.reviewer_name}</strong></span>
                {r.overall_score && (
                  <div className="flex gap-0.5 shrink-0">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.overall_score ? "text-amber-400 fill-amber-400" : "text-gray-200"}`} />
                    ))}
                  </div>
                )}
                {expanded === r.id
                  ? <ChevronUp className="w-4 h-4 theme-text-muted shrink-0" />
                  : <ChevronDown className="w-4 h-4 theme-text-muted shrink-0" />}
              </button>
              {expanded === r.id && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--surface-soft)]">
                  {[
                    { key: "strengths",    label: "Strengths" },
                    { key: "improvements", label: "Areas for Improvement" },
                    { key: "goals_next",   label: "Goals for Next Quarter" },
                  ].map(({ key, label }) => r[key] && (
                    <div key={key}>
                      <p className="text-[11px] font-semibold theme-text-muted uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm theme-text leading-relaxed">{r[key]}</p>
                    </div>
                  ))}
                  {!r.strengths && !r.improvements && !r.goals_next && (
                    <p className="text-sm theme-text-muted italic">No written feedback provided.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Pending mode: simple list ── */}
      {mode === "pending" && (
        <div className="divide-y theme-border">
          {reviews.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[r.type]}`}>
                {TYPE_LABEL[r.type]}
              </span>
              <span className="text-sm theme-text flex-1">by {r.reviewer_name}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[r.status]}`}>
                {r.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }) {
  const colors = {
    amber:  "bg-amber-500/10 text-amber-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
    green:  "bg-green-500/10 text-green-500",
    blue:   "bg-blue-500/10 text-blue-500",
  };
  return (
    <div className="theme-surface-card rounded-xl border theme-border px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold theme-text">{value ?? "—"}</p>
        <p className="text-xs theme-text-muted">{label}</p>
      </div>
    </div>
  );
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-[var(--surface-strong)] rounded-full overflow-hidden">
      <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-3 w-fit">{icon}</div>
      <p className="font-semibold theme-text mb-1">{title}</p>
      <p className="text-sm theme-text-muted max-w-xs mx-auto">{subtitle}</p>
    </div>
  );
}

function groupBy(arr, key) {
  const map = new Map();
  for (const item of arr) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return [...map.entries()];
}
