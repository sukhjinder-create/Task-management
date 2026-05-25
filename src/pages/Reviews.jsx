// src/pages/Reviews.jsx
// Performance Reviews — self-review first, then manager review unlocks
import { useState, useEffect, useCallback } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Star, Plus, Check, Users, Calendar, ChevronDown, ChevronUp,
  UserCheck, Clock, TrendingUp, Zap, Lock, Shield,
} from "lucide-react";
import { getUserProfilePath } from "../utils/userProfiles";

const STATUS_COLOR = {
  pending:     "text-[color:var(--primary)]",
  in_progress: "text-blue-400",
  submitted:   "text-[color:var(--score-good)]",
  missed:      "text-[color:var(--score-danger)]",
};
const CYCLE_STATUS_COLOR = {
  draft:     "text-[color:var(--text-muted)]",
  active:    "text-blue-400",
  completed: "text-[color:var(--score-good)]",
};
const TYPE_LABEL = { self: "Self", manager: "Manager" };
const TYPE_COLOR  = {
  self:    "bg-[var(--surface-soft)] text-[color:var(--text-muted)]",
  manager: "bg-[var(--surface-soft)] text-[color:var(--primary)]",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export default function Reviews() {
  const api     = useApi();
  const { auth } = useAuth();
  const isAdmin  = ["admin", "owner"].includes(auth?.user?.role);

  const [searchParams] = useSearchParams();
  const [tab, setTab]  = useState(() => searchParams.get("tab") || "pending");
  const [pendingReviews, setPendingReviews] = useState([]);
  const [aboutMeReviews, setAboutMeReviews] = useState([]);
  const [cycles, setCycles]               = useState([]);
  const [team, setTeam]                   = useState([]);
  const [myTeamProgress, setMyTeamProgress] = useState(null); // null = loading

  // Cycle create form
  const [showNewCycle, setShowNewCycle]   = useState(false);
  const [cycleForm, setCycleForm]         = useState({ name: "", type: "quarterly", start_date: "", end_date: "" });
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [triggeringQuarter, setTriggeringQuarter] = useState(false);

  // Cycle detail modal
  const [summaryData, setSummaryData]     = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [modalTab, setModalTab]           = useState("submitted");

  // ── Data loaders ──────────────────────────────────────────────────────────

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

  const loadMyTeamProgress = useCallback(() => {
    api.get("/reviews/my-team-progress")
      .then(r => setMyTeamProgress(r.data || { cycle: null, team: [] }))
      .catch(() => setMyTeamProgress({ cycle: null, team: [] }));
  }, [api]);

  useEffect(() => {
    loadPending();
    loadAboutMe();
    loadMyTeamProgress();
    if (isAdmin) { loadCycles(); loadTeam(); }
  }, []);

  const handleTabChange = (t) => {
    setTab(t);
    if (t === "pending")  loadPending();
    if (t === "aboutme")  loadAboutMe();
    if (t === "myteam")   loadMyTeamProgress();
    if (t === "cycles")   loadCycles();
    if (t === "team")     loadTeam();
  };

  const isManager = (myTeamProgress?.team?.length ?? 0) > 0;

  // ── Cycle actions ─────────────────────────────────────────────────────────

  const createCycle = async () => {
    if (!cycleForm.name || !cycleForm.start_date || !cycleForm.end_date)
      return toast.error("Name and dates are required");
    setCreatingCycle(true);
    try {
      await api.post("/reviews/cycles", cycleForm);
      loadCycles();
      setShowNewCycle(false);
      setCycleForm({ name: "", type: "quarterly", start_date: "", end_date: "" });
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

  // ── Derived stats ─────────────────────────────────────────────────────────

  const pendingCount = pendingReviews.length;
  const scoredReviews = aboutMeReviews.filter(r => r.status === "submitted" && r.overall_score);
  const avgAboutMe    = scoredReviews.length
    ? (scoredReviews.reduce((s, r) => s + Number(r.overall_score), 0) / scoredReviews.length).toFixed(1)
    : null;

  const TABS = [
    { key: "pending", label: "To Review",  icon: <Clock className="w-4 h-4" />,      badge: pendingCount || null },
    { key: "aboutme", label: "About Me",   icon: <UserCheck className="w-4 h-4" /> },
    ...((isManager || isAdmin) ? [
      { key: "myteam", label: "My Team",   icon: <Users className="w-4 h-4" /> },
    ] : []),
    ...(isAdmin ? [
      { key: "cycles", label: "Cycles",    icon: <Calendar className="w-4 h-4" /> },
      { key: "team",   label: "Team",      icon: <Shield className="w-4 h-4" /> },
    ] : []),
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--primary)] font-semibold mb-1">People</p>
          <h1 className="text-[26px] font-semibold tracking-tight text-[color:var(--text)] leading-tight">Performance Reviews</h1>
          <p className="text-[13px] text-[color:var(--text-muted)] mt-1">
            Two-phase cycle: employees complete their self-review first, then manager reviews unlock automatically.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={triggerQuarter}
            disabled={triggeringQuarter}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0"
          >
            <Zap className="w-4 h-4" />
            {triggeringQuarter ? "Starting…" : "Start This Quarter"}
          </button>
        )}
      </header>

      {/* Phase explainer (subtle) */}
      <div className="flex items-center gap-3 mb-5 px-4 py-3 border border-[color:var(--border)] rounded-lg">
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] font-medium">
          <span className="w-5 h-5 rounded-full border border-[color:var(--border)] flex items-center justify-center text-[10px] font-bold text-[color:var(--primary)]">1</span>
          Self-Review
        </div>
        <div className="flex-1 h-px bg-[var(--border)]" />
        <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)] font-medium">
          <span className="w-5 h-5 rounded-full border border-[color:var(--border)] flex items-center justify-center text-[10px] font-bold text-[color:var(--primary)]">2</span>
          Manager Review
        </div>
        <Lock className="w-3.5 h-3.5 text-[color:var(--text-soft)] -ml-1" />
        <span className="text-[10px] text-[color:var(--text-muted)]">unlocks after Phase 1</span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Pending for You"  value={pendingCount}                               color="amber"  icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Reviews About Me" value={aboutMeReviews.filter(r => r.status === "submitted").length} color="indigo" icon={<UserCheck className="w-4 h-4" />} />
        <StatCard label="My Avg Score"     value={avgAboutMe ? `${avgAboutMe}/5` : "—"}       color="green"  icon={<Star className="w-4 h-4" />} />
        <StatCard label="Active Cycles"    value={cycles.filter(c => c.status === "active").length} color="blue"   icon={<Calendar className="w-4 h-4" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[color:var(--border)]">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${tab === t.key
                ? "border-[color:var(--primary)] text-[color:var(--primary)]"
                : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}
          >
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full border border-[color:var(--score-danger)] text-[color:var(--score-danger)] text-[10px] font-bold px-1">
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
            <EmptyState icon={<Check className="w-10 h-10 text-[color:var(--score-good)]" />}
              title="All caught up!" subtitle="No pending reviews assigned to you right now." />
          ) : (
            <div className="space-y-3">
              {groupBy(pendingReviews, "cycle_name").map(([cycleName, reviews]) => {
                const daysLeft = daysUntil(reviews[0]?.cycle_end_date);
                return (
                  <div key={cycleName}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-[color:var(--text)]">{cycleName}</p>
                      {daysLeft !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          daysLeft <= 1 ? "text-[color:var(--score-danger)]"
                          : daysLeft <= 7 ? "text-[color:var(--primary)]"
                          : "text-[color:var(--text-muted)]"
                        }`}>
                          {daysLeft <= 0 ? "Overdue" : `${daysLeft}d left`}
                        </span>
                      )}
                    </div>
                    {reviews.map(r => (
                      <ReviewCard key={r.id} review={r} onRefresh={() => { loadPending(); loadMyTeamProgress(); }} />
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
            <EmptyState icon={<Star className="w-10 h-10 text-[color:var(--text-muted)]" />}
              title="No reviews yet" subtitle="Submitted reviews about you will appear here once a cycle closes." />
          ) : (
            <div>
              {avgAboutMe && (
                <div className="border border-[color:var(--border)] rounded-lg px-5 py-4 mb-5 flex items-center gap-4">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-5 h-5 ${n <= Math.round(avgAboutMe) ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
                    ))}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[color:var(--text)]">{avgAboutMe} <span className="text-sm font-normal text-[color:var(--text-muted)]">/ 5 average</span></p>
                    <p className="text-xs text-[color:var(--text-muted)]">{aboutMeReviews.length} submitted review{aboutMeReviews.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {groupBy(aboutMeReviews, "cycle_name").map(([cycleName, reviews]) => (
                  <div key={cycleName}>
                    <p className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide mb-2">{cycleName}</p>
                    {reviews.map(r => <AboutMeCard key={r.id} review={r} />)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MY TEAM ─────────────────────────────────────────────────────────── */}
      {tab === "myteam" && (isManager || isAdmin) && (
        <MyTeamTab progress={myTeamProgress} />
      )}

      {/* ── CYCLES (admin) ──────────────────────────────────────────────────── */}
      {tab === "cycles" && isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[color:var(--text-muted)]">
              Quarterly cycles are auto-created each quarter. You can also create custom cycles manually.
            </p>
            <button onClick={() => setShowNewCycle(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)]">
              <Plus className="w-4 h-4" /> New Cycle
            </button>
          </div>

          {showNewCycle && (
            <div className="border border-[color:var(--border)] rounded-lg p-4 mb-4 space-y-3">
              <h3 className="text-sm font-semibold text-[color:var(--text)]">Create Review Cycle</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={cycleForm.name} onChange={e => setCycleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Cycle name (e.g. Q2 2026)" className="col-span-2 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
                <select value={cycleForm.type} onChange={e => setCycleForm(f => ({ ...f, type: e.target.value }))}
                  className="col-span-2 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]">
                  {["quarterly","annual","360"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="date" value={cycleForm.start_date} onChange={e => setCycleForm(f => ({ ...f, start_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
                <input type="date" value={cycleForm.end_date} onChange={e => setCycleForm(f => ({ ...f, end_date: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]" />
              </div>
              <div className="flex gap-2">
                <button onClick={createCycle} disabled={creatingCycle}
                  className="px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
                  {creatingCycle ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowNewCycle(false)} className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)]">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {cycles.length === 0 && (
              <EmptyState icon={<Calendar className="w-10 h-10 text-[color:var(--text-muted)]" />}
                title="No cycles yet"
                subtitle='Click "Start This Quarter" to auto-create and assign reviews instantly.' />
            )}
            {cycles.map(c => {
              const daysLeft = daysUntil(c.end_date);
              return (
                <div key={c.id} onClick={() => openSummary(c)}
                  className="border border-[color:var(--border)] rounded-lg p-4 cursor-pointer hover:border-[color:var(--primary)] transition-colors group">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[color:var(--text)] group-hover:text-[color:var(--primary)] transition-colors">{c.name}</p>
                        {c.auto_generated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[color:var(--primary)]/10 text-[color:var(--primary)] font-medium">AUTO</span>
                        )}
                        <span className={`text-xs font-medium ${CYCLE_STATUS_COLOR[c.status]}`}>{c.status}</span>
                      </div>
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                        {c.type} · {c.start_date} → {c.end_date}
                        {daysLeft !== null && c.status === "active" && (
                          <span className={`ml-2 ${daysLeft <= 3 ? "text-[color:var(--score-danger)]" : daysLeft <= 7 ? "text-[color:var(--primary)]" : ""}`}>
                            · {daysLeft <= 0 ? "Overdue" : `${daysLeft}d remaining`}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <ProgressBar done={Number(c.submitted_count)} total={Number(c.review_count)} />
                        <span className="text-xs text-[color:var(--text-muted)] shrink-0">
                          {c.submitted_count}/{c.review_count} submitted
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {c.status === "draft" && (
                        <button onClick={() => activateCycle(c.id)}
                          className="px-2.5 py-1 bg-[var(--surface-soft)] text-[color:var(--primary)] hover:border-[color:var(--primary)] border border-[color:var(--border)] rounded-lg text-xs font-medium">
                          Activate
                        </button>
                      )}
                      {c.status === "active" && (
                        <button onClick={() => completeCycle(c.id)}
                          className="px-2.5 py-1 bg-[color:var(--score-good)]/10 text-[color:var(--score-good)] hover:bg-[color:var(--score-good)]/15 rounded-lg text-xs font-medium">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-[var(--surface)] rounded-xl border border-[color:var(--border)] w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)] shrink-0">
                  <div>
                    <h3 className="font-semibold text-[color:var(--text)]">{summaryData?.cycle?.name || "Cycle Detail"}</h3>
                    {summaryData && (
                      <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
                        {summaryData.stats.length} member{summaryData.stats.length !== 1 ? "s" : ""} ·{" "}
                        {summaryData.stats.reduce((s,r) => s + Number(r.submitted), 0)}/
                        {summaryData.stats.reduce((s,r) => s + Number(r.total), 0)} reviews submitted
                      </p>
                    )}
                  </div>
                  <button onClick={() => setSummaryData(null)} className="text-[color:var(--text-muted)] hover:text-[color:var(--text)] text-xl leading-none">✕</button>
                </div>

                {summaryLoading ? (
                  <div className="py-16 text-center text-[color:var(--text-muted)] text-sm">Loading reviews…</div>
                ) : (() => {
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
                      <div className="flex border-b border-[color:var(--border)] shrink-0">
                        {[
                          { key: "submitted", label: "Submitted",     count: totalSubmitted, activeColor: "border-[color:var(--score-good)] text-[color:var(--score-good)]",  badgeColor: "bg-[color:var(--score-good)]/10 text-[color:var(--score-good)]" },
                          { key: "pending",   label: "Not Submitted", count: totalPending,   activeColor: "border-[color:var(--primary)] text-[color:var(--primary)]",  badgeColor: "bg-[color:var(--primary)]/10 text-[color:var(--primary)]" },
                        ].map(t => (
                          <button key={t.key} onClick={() => setModalTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                              ${modalTab === t.key ? t.activeColor : "border-transparent text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>
                            {t.label}
                            <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold px-1.5
                              ${modalTab === t.key ? t.badgeColor : "bg-[var(--surface-soft)] text-[color:var(--text-muted)]"}`}>
                              {t.count}
                            </span>
                          </button>
                        ))}
                      </div>

                      <div className="overflow-y-auto flex-1 p-4 space-y-3">
                        {summaryData.stats.length === 0 && (
                          <p className="text-center text-[color:var(--text-muted)] text-sm py-8">No reviews in this cycle yet.</p>
                        )}

                        {modalTab === "submitted" && memberData
                          .filter(m => m.submitted.length > 0)
                          .map(({ member, submitted }) => (
                            <MemberReviewGroup key={member.reviewee_id} member={member} reviews={submitted} mode="submitted" />
                          ))
                        }
                        {modalTab === "submitted" && memberData.every(m => m.submitted.length === 0) && (
                          <p className="text-center text-[color:var(--text-muted)] text-sm py-8">No reviews submitted yet.</p>
                        )}

                        {modalTab === "pending" && memberData
                          .filter(m => m.pending.length > 0)
                          .map(({ member, pending }) => (
                            <MemberReviewGroup key={member.reviewee_id} member={member} reviews={pending} mode="pending" />
                          ))
                        }
                        {modalTab === "pending" && memberData.every(m => m.pending.length === 0) && (
                          <p className="text-center text-[color:var(--text-muted)] text-sm py-8">Everyone has submitted — all done!</p>
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
          <p className="text-sm text-[color:var(--text-muted)] mb-4">
            Assign reporting lines. Manager reviews unlock only after the employee submits their self-review.
          </p>

          {/* Bulk assign panel */}
          <BulkManagerPanel team={team} onComplete={loadTeam} />

          <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-soft)] border-b border-[color:var(--border)]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--text-soft)] uppercase">Member</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[color:var(--text-soft)] uppercase">Reports To</th>
                </tr>
              </thead>
              <tbody>
                {team.map(m => (
                  <tr key={m.user_id} className="border-b border-[color:var(--border)] hover:bg-[var(--surface-soft)]">
                    <td className="px-4 py-3">
                      <Link to={getUserProfilePath(m.user_id, auth.user?.id)} className="font-medium text-[color:var(--text)] hover:text-[color:var(--primary)]">
                        {m.username}
                      </Link>
                      <p className="text-xs text-[color:var(--text-muted)]">{m.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select value={m.manager_id || ""}
                        onChange={e => setManager(m.user_id, e.target.value || null)}
                        className="px-2 py-1.5 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] max-w-[200px]">
                        <option value="">— No manager —</option>
                        {team.filter(t => t.user_id !== m.user_id).map(t => (
                          <option key={t.user_id} value={t.user_id}>{t.username}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {team.length === 0 && (
                  <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-[color:var(--text-muted)]">No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MY TEAM TAB ──────────────────────────────────────────────────────────────

function MyTeamTab({ progress }) {
  if (!progress) {
    return <div className="py-12 text-center text-sm text-[color:var(--text-muted)]">Loading team data…</div>;
  }

  const { cycle, team } = progress;

  if (!cycle) return (
    <EmptyState icon={<Calendar className="w-10 h-10 text-[color:var(--text-muted)]" />}
      title="No active review cycle"
      subtitle="A review cycle must be active before team progress is visible." />
  );

  if (!team || team.length === 0) return (
    <EmptyState icon={<Users className="w-10 h-10 text-[color:var(--text-muted)]" />}
      title="No direct reports"
      subtitle="Team members who report to you will appear here once manager assignments are configured." />
  );

  const selfDone   = team.filter(m => m.self_review?.status === "submitted").length;
  const managerDone = team.filter(m => m.manager_review?.status === "submitted").length;
  const daysLeft   = daysUntil(cycle.end_date);

  return (
    <div>
      {/* Cycle summary bar */}
      <div className="border border-[color:var(--border)] rounded-lg px-5 py-4 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-[color:var(--text)]">{cycle.name}</p>
            <p className="text-xs text-[color:var(--text-muted)] mt-0.5">
              Closes {cycle.end_date}
              {daysLeft !== null && (
                <span className={`ml-2 font-medium ${daysLeft <= 3 ? "text-[color:var(--score-danger)]" : daysLeft <= 7 ? "text-[color:var(--primary)]" : "text-[color:var(--text-muted)]"}`}>
                  {daysLeft <= 0 ? "· Overdue" : `· ${daysLeft}d remaining`}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-5 text-xs text-[color:var(--text-muted)]">
            <span>
              Self-reviews
              <strong className={`ml-1 ${selfDone === team.length ? "text-[color:var(--score-good)]" : "text-[color:var(--text)]"}`}>
                {selfDone}/{team.length}
              </strong>
            </span>
            <span>
              Manager reviews
              <strong className={`ml-1 ${managerDone === team.length ? "text-[color:var(--score-good)]" : "text-[color:var(--text)]"}`}>
                {managerDone}/{team.length}
              </strong>
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-[color:var(--text-muted)] mb-1">
            <span>Overall progress</span>
            <span>{selfDone + managerDone}/{team.length * 2} reviews</span>
          </div>
          <ProgressBar done={selfDone + managerDone} total={team.length * 2} />
        </div>
      </div>

      <div className="space-y-2">
        {team.map(member => (
          <TeamMemberProgressCard key={member.user_id} member={member} />
        ))}
      </div>
    </div>
  );
}

// ─── TEAM MEMBER PROGRESS CARD ────────────────────────────────────────────────

function TeamMemberProgressCard({ member }) {
  const { auth } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const selfSubmitted = member.self_review?.status === "submitted";

  const selfStatusCfg = {
    pending:     { label: "Pending",     color: "text-[color:var(--primary)]" },
    in_progress: { label: "In Progress", color: "text-blue-400"  },
    submitted:   { label: "Submitted",   color: "text-[color:var(--score-good)]" },
  };
  const mgrStatusCfg = {
    pending:     { label: "Pending",     color: "text-[color:var(--primary)]" },
    in_progress: { label: "In Progress", color: "text-blue-400"  },
    submitted:   { label: "Submitted",   color: "text-[color:var(--score-good)]" },
  };

  const selfStatus = member.self_review?.status || "pending";
  const mgrStatus  = member.manager_review?.status || "pending";
  const mgrLocked  = member.manager_review ? member.manager_review.locked : !selfSubmitted;

  return (
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
      <div
        className={`flex items-center gap-3 px-4 py-3 ${selfSubmitted ? "cursor-pointer hover:bg-[var(--surface-soft)]" : ""}`}
        onClick={() => selfSubmitted && setExpanded(e => !e)}
      >
        {/* Member info */}
        <div className="flex-1 min-w-0">
          <Link to={getUserProfilePath(member.user_id, auth.user?.id)} className="font-medium text-[color:var(--text)] text-sm hover:text-[color:var(--primary)]">
            {member.username}
          </Link>
          <p className="text-xs text-[color:var(--text-muted)]">{member.email}</p>
        </div>

        {/* Phase 1: Self */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[72px]">
          <p className="text-[9px] text-[color:var(--text-muted)] uppercase tracking-wide font-semibold">
            <span className="text-[color:var(--primary)]">①</span> Self
          </p>
          <span className={`text-[10px] font-medium ${selfStatusCfg[selfStatus].color}`}>
            {selfStatusCfg[selfStatus].label}
          </span>
        </div>

        {/* Divider */}
        <div className="w-4 h-px bg-[var(--border)] shrink-0" />

        {/* Phase 2: Manager */}
        <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[80px]">
          <p className="text-[9px] text-[color:var(--text-muted)] uppercase tracking-wide font-semibold">
            <span className="text-blue-400">②</span> Manager
          </p>
          {mgrLocked ? (
            <span className="text-[10px] font-medium text-[color:var(--text-muted)] flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          ) : (
            <span className={`text-[10px] font-medium ${mgrStatusCfg[mgrStatus].color}`}>
              {mgrStatusCfg[mgrStatus].label}
            </span>
          )}
        </div>

        {/* Expand toggle */}
        {selfSubmitted
          ? (expanded ? <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />)
          : <div className="w-4 shrink-0" />
        }
      </div>

      {/* Expanded: self-review content */}
      {expanded && selfSubmitted && member.self_review && (
        <div className="border-t border-[color:var(--border)] px-4 py-4 bg-[var(--surface-soft)] space-y-3">
          <p className="text-[11px] font-semibold text-[color:var(--primary)] uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" /> <Link to={getUserProfilePath(member.user_id, auth.user?.id)} className="hover:underline">{member.username}</Link>'s Self-Review
            {member.self_review.submitted_at && (
              <span className="normal-case font-normal text-[color:var(--text-muted)] ml-1">
                · submitted {new Date(member.self_review.submitted_at).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })}
              </span>
            )}
          </p>

          {member.self_review.overall_score && (
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-4 h-4 ${n <= member.self_review.overall_score ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
                ))}
              </div>
              <span className="text-sm font-semibold text-[color:var(--text)]">{member.self_review.overall_score}/5</span>
              <span className="text-xs text-[color:var(--text-muted)]">self-assessed</span>
            </div>
          )}

          {[
            { key: "strengths",    label: "Strengths",               color: "text-[color:var(--score-good)]"  },
            { key: "improvements", label: "Areas for Improvement",   color: "text-[color:var(--primary)]"  },
            { key: "goals_next",   label: "Goals for Next Quarter",  color: "text-blue-400"   },
          ].map(({ key, label, color }) => member.self_review[key] && (
            <div key={key}>
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${color}`}>{label}</p>
              <p className="text-sm text-[color:var(--text)] leading-relaxed">{member.self_review[key]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── REVIEW CARD (to fill) ────────────────────────────────────────────────────

function ReviewCard({ review, onRefresh }) {
  const api    = useApi();
  const [open, setOpen]                       = useState(false);
  const [context, setContext]                 = useState(null);
  const [selfReviewCtx, setSelfReviewCtx]     = useState(undefined); // undefined = not yet loaded
  const [selfCtxLoaded, setSelfCtxLoaded]     = useState(false);
  const [form, setForm] = useState({
    overall_score: review.overall_score || 0,
    strengths:     review.strengths     || "",
    improvements:  review.improvements  || "",
    goals_next:    review.goals_next    || "",
  });
  const [saving, setSaving] = useState(false);

  // For manager reviews: check if self-review is submitted via `self_review_data` field
  // (returned by GET /pending) before we even open the card
  const selfReviewDataFromPending = review.self_review_data;
  const selfAlreadyKnownSubmitted = selfReviewDataFromPending?.status === "submitted";

  const loadContext = async () => {
    if (context || review.type === "self") return;
    try {
      const r = await api.get(`/reviews/user-context/${review.reviewee_id}`);
      setContext(r.data);
    } catch { /* no context */ }
  };

  const loadSelfReviewCtx = async () => {
    if (review.type !== "manager" || selfCtxLoaded) return;
    setSelfCtxLoaded(true);
    // If we already have it from the pending response, use that
    if (selfAlreadyKnownSubmitted) {
      setSelfReviewCtx(selfReviewDataFromPending);
      return;
    }
    try {
      const r = await api.get(`/reviews/reviews/${review.id}/self-review-context`);
      setSelfReviewCtx(r.data || null);
    } catch { setSelfReviewCtx(null); }
  };

  const toggleOpen = () => {
    if (!open) {
      loadContext();
      loadSelfReviewCtx();
    }
    setOpen(o => !o);
  };

  const isLocked = review.type === "manager" && (
    selfCtxLoaded
      ? !selfReviewCtx
      : !selfAlreadyKnownSubmitted
  );

  const save = async (submit = false) => {
    if (isLocked) return toast.error("Manager review is still locked — waiting for the employee's self-review.");
    if (submit && !form.overall_score) return toast.error("Please select a rating before submitting");
    setSaving(true);
    try {
      await api.put(`/reviews/reviews/${review.id}`, {
        ...form,
        status: submit ? "submitted" : "in_progress",
      });
      if (submit) { toast.success("Review submitted!"); onRefresh(); setOpen(false); }
      else toast.success("Draft saved");
    } catch (err) {
      const msg = err.response?.data?.error || "Failed";
      if (err.response?.status === 423) {
        toast.error("Manager review is locked — the employee hasn't submitted their self-review yet.");
      } else {
        toast.error(msg);
      }
    }
    setSaving(false);
  };

  return (
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-soft)]" onClick={toggleOpen}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[color:var(--text)]">
              {review.type === "self" ? "Self Review" : `Review of ${review.reviewee_name}`}
            </p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[review.type]}`}>
              {TYPE_LABEL[review.type] || review.type}
            </span>
            {review.type === "manager" && !selfAlreadyKnownSubmitted && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-[color:var(--text-muted)] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Awaiting self-review
              </span>
            )}
          </div>
        </div>
        <span className={`text-xs shrink-0 font-medium ${STATUS_COLOR[review.status]}`}>
          {review.status.replace("_", " ")}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />}
      </div>

      {open && (
        <div className="border-t border-[color:var(--border)]">

          {/* Intelligence context (for manager reviews) */}
          {context && (
            <div className="px-4 py-3 bg-[var(--surface-soft)] border-b border-[color:var(--border)]">
              <p className="text-[11px] font-semibold text-[color:var(--primary)] mb-1.5 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Intelligence Context — {context.month}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[color:var(--text-muted)]">Score</span>
                  <span className={`text-sm font-bold ${context.score >= 70 ? "text-[color:var(--score-good)]" : context.score >= 40 ? "text-[color:var(--primary)]" : "text-[color:var(--score-danger)]"}`}>
                    {context.score}/100
                  </span>
                </div>
                {context.breakdown?.attendance && (
                  <span className="text-xs text-[color:var(--text-muted)]">
                    Attendance <strong className="text-[color:var(--text)]">{context.breakdown.attendance.score}/100</strong>
                  </span>
                )}
                {context.breakdown?.productivity && (
                  <span className="text-xs text-[color:var(--text-muted)]">
                    Tasks <strong className="text-[color:var(--text)]">{context.breakdown.productivity.score}/100</strong>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Employee's self-review (for manager reviews, when submitted) */}
          {selfReviewCtx && (
            <div className="px-4 py-3 bg-[var(--surface-soft)] border-b border-[color:var(--border)]">
              <p className="text-[11px] font-semibold text-[color:var(--primary)] mb-2 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> {review.reviewee_name}'s Self-Review
              </p>
              {selfReviewCtx.overall_score && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-4 h-4 ${n <= selfReviewCtx.overall_score ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-[color:var(--text)]">{selfReviewCtx.overall_score}/5 self-assessed</span>
                </div>
              )}
              {[
                { key: "strengths",    label: "Strengths",              color: "text-[color:var(--score-good)]" },
                { key: "improvements", label: "Areas for Improvement",  color: "text-[color:var(--primary)]" },
                { key: "goals_next",   label: "Goals for Next Quarter", color: "text-blue-400"  },
              ].map(({ key, label, color }) => selfReviewCtx[key] && (
                <div key={key} className="mt-1.5">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${color}`}>{label}</p>
                  <p className="text-xs text-[color:var(--text)] leading-relaxed mt-0.5">{selfReviewCtx[key]}</p>
                </div>
              ))}
            </div>
          )}

          {/* Locked state */}
          {review.type === "manager" && selfCtxLoaded && !selfReviewCtx && (
            <div className="px-4 py-8 text-center bg-[var(--surface-soft)]">
              <Lock className="w-6 h-6 text-[color:var(--primary)] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[color:var(--text)]">Manager review is locked</p>
              <p className="text-xs text-[color:var(--text-muted)] mt-1 max-w-xs mx-auto">
                {review.reviewee_name} needs to submit their self-review before you can complete this review.
              </p>
            </div>
          )}

          {/* Form — only shown when not locked */}
          {!isLocked && (
            <div className="px-4 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text)] mb-2">Overall Rating</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => setForm(f => ({ ...f, overall_score: n }))}>
                      <Star className={`w-7 h-7 transition-colors ${n <= form.overall_score ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)] hover:text-amber-300"}`} />
                    </button>
                  ))}
                  {form.overall_score > 0 && (
                    <span className="ml-2 self-center text-sm font-medium text-[color:var(--text-muted)]">{form.overall_score}/5</span>
                  )}
                </div>
              </div>

              {[
                { key: "strengths",    label: "Strengths",              placeholder: "What does this person do really well?" },
                { key: "improvements", label: "Areas for Improvement",  placeholder: "Where can they grow?" },
                { key: "goals_next",   label: "Goals for Next Quarter", placeholder: "What should they focus on next?" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-[color:var(--text)] mb-1">{label}</label>
                  <textarea
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)] resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
                  />
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button onClick={() => save(false)} disabled={saving}
                  className="px-4 py-2 border border-[color:var(--border)] rounded-lg text-sm text-[color:var(--text)] hover:bg-[var(--surface-soft)] disabled:opacity-60">
                  Save Draft
                </button>
                <button onClick={() => save(true)} disabled={saving || !form.overall_score}
                  className="px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60">
                  {saving ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ABOUT ME CARD ────────────────────────────────────────────────────────────

function AboutMeCard({ review }) {
  const [open, setOpen] = useState(false);
  const isMissed = review.status === "missed";

  return (
    <div className={`border rounded-lg overflow-hidden mb-2 ${isMissed ? "border-[color:var(--score-danger)]/30" : "border-[color:var(--border)]"}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 ${!isMissed ? "cursor-pointer hover:bg-[var(--surface-soft)]" : ""}`}
        onClick={() => !isMissed && setOpen(o => !o)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[color:var(--text)]">{review.reviewer_name}</p>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TYPE_COLOR[review.type] || "text-[color:var(--text-muted)]"}`}>
              {TYPE_LABEL[review.type] || review.type}
            </span>
            {isMissed && (
              <span className="text-[10px] font-medium text-[color:var(--score-danger)]">
                Missed — penalty applied
              </span>
            )}
            <span className="text-xs text-[color:var(--text-muted)]">· {review.cycle_name}</span>
          </div>
        </div>
        {!isMissed && review.overall_score && (
          <div className="flex gap-0.5 shrink-0">
            {[1,2,3,4,5].map(n => (
              <Star key={n} className={`w-4 h-4 ${n <= review.overall_score ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
            ))}
          </div>
        )}
        {isMissed
          ? <span className="text-xs text-[color:var(--score-danger)] font-semibold shrink-0">−15 pts</span>
          : (open ? <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />)
        }
      </div>

      {isMissed && (
        <div className="border-t border-[color:var(--score-danger)]/20 px-4 py-3 bg-[color:var(--score-danger)]/5">
          <p className="text-xs text-[color:var(--score-danger)]">
            This self-review was not submitted before the cycle deadline. A 15-point deduction was applied to your monthly performance score for this period.
          </p>
        </div>
      )}

      {!isMissed && open && (
        <div className="border-t border-[color:var(--border)] px-4 py-4 space-y-3">
          {[
            { key: "strengths",    label: "Strengths" },
            { key: "improvements", label: "Areas for Improvement" },
            { key: "goals_next",   label: "Goals for Next Quarter" },
          ].map(({ key, label }) => review[key] && (
            <div key={key}>
              <p className="text-xs font-semibold text-[color:var(--text-soft)] uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm text-[color:var(--text)] leading-relaxed">{review[key]}</p>
            </div>
          ))}
          {!review.strengths && !review.improvements && !review.goals_next && (
            <p className="text-sm text-[color:var(--text-muted)] italic">No written feedback provided.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: MEMBER REVIEW GROUP (inside cycle detail modal) ──────────────────

function MemberReviewGroup({ member, reviews, mode = "submitted" }) {
  const [expanded, setExpanded] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  const byType = ["self", "manager"].map(type => {
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
    <div className="border border-[color:var(--border)] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[color:var(--border)] flex items-center gap-3">
        <div className="flex-1">
          <p className="font-semibold text-[color:var(--text)]">{member.username}</p>
          <p className="text-xs text-[color:var(--text-muted)]">
            {mode === "submitted"
              ? `${reviews.length} review${reviews.length !== 1 ? "s" : ""} submitted`
              : `${reviews.length} review${reviews.length !== 1 ? "s" : ""} pending`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "submitted" && member.avg_score && (
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(n => (
                  <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(member.avg_score) ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-[color:var(--text)]">{member.avg_score}/5</span>
            </div>
          )}
          {hasSummary && (
            <button onClick={() => setShowSummary(s => !s)}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${showSummary ? "bg-[color:var(--primary)]/10 text-[color:var(--primary)] border-[color:var(--primary)]/20" : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"}`}>
              {showSummary ? "Hide" : "Summary"}
            </button>
          )}
        </div>
      </div>

      {showSummary && (
        <div className="px-4 py-4 bg-[var(--surface-soft)] border-b border-[color:var(--border)] space-y-4">
          {byType.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[color:var(--primary)] uppercase tracking-wide mb-2">Score Breakdown</p>
              <div className="flex gap-3 flex-wrap">
                {byType.map(({ type, avg, count }) => (
                  <div key={type} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[color:var(--border)] text-[color:var(--text-muted)]">
                    <span className="text-xs font-medium">{TYPE_LABEL[type]}</span>
                    <span className="text-sm font-bold">{avg}/5</span>
                    {count > 1 && <span className="text-[10px] opacity-60">({count})</span>}
                  </div>
                ))}
              </div>
              {(() => {
                const self = byType.find(t => t.type === "self");
                const mgr  = byType.find(t => t.type === "manager");
                if (!self || !mgr) return null;
                const diff = (Number(self.avg) - Number(mgr.avg)).toFixed(1);
                return (
                  <p className="text-xs text-[color:var(--text-muted)] mt-1.5">
                    Self-assessed <strong className="text-[color:var(--text)]">{Number(diff) > 0 ? `+${diff}` : diff}</strong> vs manager
                    {" · "}{Number(diff) > 0.5 ? "may be overestimating" : Number(diff) < -0.5 ? "may be underestimating" : "well-calibrated"}
                  </p>
                );
              })()}
            </div>
          )}
          {allStrengths.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[color:var(--score-good)] uppercase tracking-wide mb-2">Strengths</p>
              {allStrengths.map((s, i) => (
                <div key={i} className="flex gap-2 text-sm text-[color:var(--text)] mb-1">
                  <span className="text-[color:var(--score-good)] shrink-0">•</span><span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {allImprovements.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[color:var(--primary)] uppercase tracking-wide mb-2">Areas for Improvement</p>
              {allImprovements.map((s, i) => (
                <div key={i} className="flex gap-2 text-sm text-[color:var(--text)] mb-1">
                  <span className="text-[color:var(--primary)] shrink-0">•</span><span>{s}</span>
                </div>
              ))}
            </div>
          )}
          {allGoals.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-2">Goals for Next Quarter</p>
              {allGoals.map((s, i) => (
                <div key={i} className="flex gap-2 text-sm text-[color:var(--text)] mb-1">
                  <span className="text-blue-400 shrink-0">→</span><span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "submitted" && (
        <div className="divide-y divide-[color:var(--border)]">
          {reviews.map(r => (
            <div key={r.id}>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface-soft)] transition-colors text-left"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[r.type] || "text-[color:var(--text-muted)]"}`}>
                  {TYPE_LABEL[r.type] || r.type}
                </span>
                <span className="text-sm text-[color:var(--text)] flex-1">by <strong>{r.reviewer_name}</strong></span>
                {r.overall_score && (
                  <div className="flex gap-0.5 shrink-0">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.overall_score ? "text-amber-400 fill-amber-400" : "text-[color:var(--text-muted)]"}`} />
                    ))}
                  </div>
                )}
                {expanded === r.id ? <ChevronUp className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[color:var(--text-muted)] shrink-0" />}
              </button>
              {expanded === r.id && (
                <div className="px-4 pb-4 pt-1 space-y-3 bg-[var(--surface-soft)]">
                  {[
                    { key: "strengths",    label: "Strengths" },
                    { key: "improvements", label: "Areas for Improvement" },
                    { key: "goals_next",   label: "Goals for Next Quarter" },
                  ].map(({ key, label }) => r[key] && (
                    <div key={key}>
                      <p className="text-[11px] font-semibold text-[color:var(--text-soft)] uppercase tracking-wide mb-1">{label}</p>
                      <p className="text-sm text-[color:var(--text)] leading-relaxed">{r[key]}</p>
                    </div>
                  ))}
                  {!r.strengths && !r.improvements && !r.goals_next && (
                    <p className="text-sm text-[color:var(--text-muted)] italic">No written feedback provided.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mode === "pending" && (
        <div className="divide-y divide-[color:var(--border)]">
          {reviews.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_COLOR[r.type] || "text-[color:var(--text-muted)]"}`}>
                {TYPE_LABEL[r.type] || r.type}
              </span>
              <span className="text-sm text-[color:var(--text)] flex-1">by {r.reviewer_name}</span>
              <span className={`text-[10px] font-medium shrink-0 ${STATUS_COLOR[r.status]}`}>
                {r.status.replace("_", " ")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BULK MANAGER PANEL ───────────────────────────────────────────────────────

function BulkManagerPanel({ team, onComplete }) {
  const api = useApi();
  const [bulkManagerId, setBulkManagerId] = useState("");
  const [applying, setApplying]           = useState(false);
  const [open, setOpen]                   = useState(false);

  const applyBulk = async () => {
    if (!bulkManagerId) return toast.error("Select a manager first");
    setApplying(true);
    try {
      const r = await api.patch("/reviews/team/bulk-manager", {
        manager_id: bulkManagerId,
        user_ids: [],
      });
      toast.success(`Manager assigned to ${r.data.updated} member${r.data.updated !== 1 ? "s" : ""}`);
      setBulkManagerId("");
      setOpen(false);
      onComplete();
    } catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    setApplying(false);
  };

  return (
    <div className="mb-4">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm text-[color:var(--primary)] hover:opacity-80 font-medium mb-2">
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Bulk assign manager
      </button>

      {open && (
        <div className="border border-[color:var(--border)] rounded-lg p-4 space-y-3">
          <p className="text-sm text-[color:var(--text-muted)]">
            Assign one manager as the reviewer for all workspace members at once. Individual assignments can still be changed per-member below.
          </p>
          <div className="flex gap-3 items-center">
            <select value={bulkManagerId} onChange={e => setBulkManagerId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-[color:var(--border)] bg-[var(--surface)] text-sm text-[color:var(--text)]">
              <option value="">— Select a manager —</option>
              {team.map(m => (
                <option key={m.user_id} value={m.user_id}>{m.username} ({m.email})</option>
              ))}
            </select>
            <button onClick={applyBulk} disabled={applying || !bulkManagerId}
              className="px-4 py-2 bg-[var(--primary)] text-[color:var(--primary-contrast)] rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0">
              {applying ? "Applying…" : "Assign to All"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }) {
  const colors = {
    amber:  "text-[color:var(--primary)]",
    indigo: "text-[color:var(--primary)]",
    green:  "text-[color:var(--score-good)]",
    blue:   "text-blue-400",
  };
  const bgColors = {
    amber:  "bg-[var(--surface-soft)]",
    indigo: "bg-[var(--surface-soft)]",
    green:  "bg-[var(--surface-soft)]",
    blue:   "bg-[var(--surface-soft)]",
  };
  return (
    <div className="border border-[color:var(--border)] rounded-lg px-4 py-3 flex items-center gap-3">
      <div className={`p-2 rounded-lg ${bgColors[color]} ${colors[color]}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold text-[color:var(--text)]">{value ?? "—"}</p>
        <p className="text-xs text-[color:var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-[var(--surface-soft)] rounded-full overflow-hidden">
      <div className="h-full bg-[var(--primary)] rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="text-center py-16">
      <div className="mx-auto mb-3 w-fit">{icon}</div>
      <p className="font-semibold text-[color:var(--text)] mb-1">{title}</p>
      <p className="text-sm text-[color:var(--text-muted)] max-w-xs mx-auto">{subtitle}</p>
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
