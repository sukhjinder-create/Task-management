import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, LogOut, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../api";
import AppBrand from "../components/AppBrand";
import { Button, EmptyState, Modal, Spinner } from "../components/ui";

const SESSION_KEY = "asystence.clientPortalSession";
const inputClass = "login-input h-11 w-full rounded-[8px] border border-[color:var(--border)] bg-[var(--surface)] px-3 text-[13px] text-[color:var(--text)] outline-none placeholder:text-[color:var(--text-soft)]";
const STATE_META = {
  in_progress: { label: "In progress", tone: "text-[color:var(--text-muted)]" },
  completed: { label: "Completed", tone: "text-[color:var(--primary)]" },
  awaiting_your_review: { label: "Your review is needed", tone: "text-[color:var(--score-warning)]" },
  awaiting_client_review: { label: "Awaiting assigned approver", tone: "text-[color:var(--score-warning)]" },
  accepted: { label: "Accepted", tone: "text-[color:var(--score-good)]" },
  changes_requested: { label: "Changes requested", tone: "text-[color:var(--score-danger)]" },
};

function apiUrl(path) {
  return `${String(API_BASE_URL || "").replace(/\/$/, "")}/client-portal${path}`;
}

async function portalRequest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(apiUrl(path), {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The client portal request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function formatDate(value) {
  if (!value) return "No target date";
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(date)
    : value;
}

export default function ClientPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkToken = searchParams.get("token");
  const [sessionToken, setSessionToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(linkToken || sessionToken));
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [focusReviewId, setFocusReviewId] = useState(null);
  const exchangeRequest = useRef(null);

  const load = useCallback(async (token = sessionToken) => {
    if (!token) return;
    try {
      const result = await portalRequest("/commitments", { token });
      setData(result);
      setError("");
    } catch (requestError) {
      if (requestError.status === 401 || requestError.status === 403) {
        sessionStorage.removeItem(SESSION_KEY);
        setSessionToken("");
      }
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    let active = true;
    if (!linkToken) {
      if (sessionToken) load(sessionToken);
      else setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    if (exchangeRequest.current?.token !== linkToken) {
      exchangeRequest.current = {
        token: linkToken,
        promise: portalRequest("/auth/exchange", { method: "POST", body: { token: linkToken } }),
      };
    }
    exchangeRequest.current.promise
      .then((result) => {
        if (!active) return;
        sessionStorage.setItem(SESSION_KEY, result.sessionToken);
        setSessionToken(result.sessionToken);
        setFocusReviewId(result.focusReviewId || null);
        navigate("/client-portal", { replace: true });
      })
      .catch((requestError) => {
        if (!active) return;
        navigate("/client-portal", { replace: true });
        setError(requestError.message);
        setLoading(false);
      });
    return () => { active = false; };
  }, [linkToken, load, navigate, sessionToken]);

  useEffect(() => {
    if (!focusReviewId || !data) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`client-review-${focusReviewId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [data, focusReviewId]);

  const requestAccess = async (event) => {
    event.preventDefault();
    setRequesting(true);
    try {
      await portalRequest("/auth/request", { method: "POST", body: { email } });
      setRequestSent(true);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRequesting(false);
    }
  };

  const decide = async (event) => {
    event.preventDefault();
    if (!decisionDialog) return;
    setDeciding(true);
    try {
      await portalRequest(`/reviews/${decisionDialog.review.id}/decision`, {
        method: "POST",
        token: sessionToken,
        body: { decision: decisionDialog.decision, note: decisionNote },
      });
      setDecisionDialog(null);
      setDecisionNote("");
      await load(sessionToken);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeciding(false);
    }
  };

  const logout = async () => {
    try { await portalRequest("/auth/logout", { method: "POST", token: sessionToken }); } catch { /* local logout still closes access */ }
    sessionStorage.removeItem(SESSION_KEY);
    setSessionToken("");
    setData(null);
    setRequestSent(false);
    setError("");
  };

  const groups = useMemo(() => {
    const grouped = new Map();
    for (const commitment of data?.commitments || []) {
      if (!grouped.has(commitment.projectName)) grouped.set(commitment.projectName, []);
      grouped.get(commitment.projectName).push(commitment);
    }
    return [...grouped.entries()];
  }, [data]);

  if (loading) {
    return <div className="login-page flex min-h-screen items-center justify-center bg-[var(--background)]"><Spinner size="lg" /></div>;
  }

  if (!sessionToken || !data) {
    return (
      <main className="login-page relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-12">
        <div className="login-page-grid pointer-events-none absolute inset-0" />
        <section className="login-card relative w-full max-w-[440px] rounded-[14px] border border-[color:var(--border)] bg-[var(--surface)] p-7 sm:p-9">
          <AppBrand />
          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">Client portal</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text)]">Your shared outcomes, in one place.</h1>
            <p className="mt-2 text-[13px] leading-6 text-[color:var(--text-muted)]">No password or workspace seat is required. We will email a one-time secure link to your approved client account.</p>
          </div>
          {requestSent ? (
            <div className="mt-6 rounded-[10px] border border-[color:var(--border)] bg-[var(--surface-soft)] p-5">
              <Mail className="h-5 w-5 text-[color:var(--primary)]" />
              <p className="mt-3 text-[13px] font-semibold text-[color:var(--text)]">Check your email</p>
              <p className="mt-1 text-[12px] leading-5 text-[color:var(--text-muted)]">If this client account exists, a secure link is on its way. It expires in 20 minutes.</p>
              <Button className="mt-4" variant="secondary" onClick={() => setRequestSent(false)}>Use another account</Button>
            </div>
          ) : (
            <form onSubmit={requestAccess} className="mt-6 space-y-4">
              <label className="block text-[12px] font-semibold text-[color:var(--text)]">Approved client email
                <span className="mt-1.5 block"><input type="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@client.com" maxLength={320} autoComplete="email" required /></span>
              </label>
              <Button type="submit" loading={requesting} className="w-full" rightIcon={<Mail className="h-4 w-4" />}>Email secure link</Button>
            </form>
          )}
          {error && <p role="alert" className="mt-4 text-[12px] text-[color:var(--score-danger)]">{error}</p>}
          <p className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[color:var(--text-soft)]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Only outcomes explicitly shared with your client company are shown. Internal tasks, team data, scores, and evidence history stay private.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page min-h-screen bg-[var(--background)]">
      <header className="border-b border-[color:var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <AppBrand />
          <Button variant="ghost" size="sm" onClick={logout} leftIcon={<LogOut className="h-3.5 w-3.5" />}>Sign out</Button>
        </div>
      </header>
      <div className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--primary)]">{data.account.workspaceName} · Client assurance</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--text)]">Welcome, {data.account.contactName}</h1>
        <p className="mt-1 text-[13px] text-[color:var(--text-muted)]">All outcomes shared with {data.account.clientName}, grouped by project.</p>
        {error && <p role="alert" className="mt-4 rounded-[8px] border border-[color:var(--score-danger)] p-3 text-[12px] text-[color:var(--score-danger)]">{error}</p>}

        {groups.length ? <div className="mt-8 space-y-7">{groups.map(([projectName, commitments]) => (
          <section key={projectName}>
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">{projectName}</h2>
            <div className="mt-3 space-y-3">{commitments.map((commitment) => {
              const meta = STATE_META[commitment.state] || STATE_META.in_progress;
              return (
                <article key={commitment.id} id={commitment.review ? `client-review-${commitment.review.id}` : undefined} className="rounded-[10px] border border-[color:var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1"><p className={`text-[11px] font-semibold ${meta.tone}`}>{meta.label}</p><h3 className="mt-1 text-[17px] font-semibold text-[color:var(--text)]">{commitment.title}</h3></div>
                    <span className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-soft)]"><Clock3 className="h-3.5 w-3.5" />{formatDate(commitment.targetDate)}</span>
                  </div>
                  <p className="mt-3 text-[12px] leading-5 text-[color:var(--text-muted)]"><span className="font-semibold text-[color:var(--text)]">Agreed result:</span> {commitment.successMeasure}</p>
                  {commitment.review?.resultSummary && <div className="mt-4 rounded-[8px] bg-[var(--surface-soft)] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-soft)]">Result submitted</p><p className="mt-2 text-[13px] leading-6 text-[color:var(--text)]">{commitment.review.resultSummary}</p>{commitment.review.message && <p className="mt-2 text-[12px] leading-5 text-[color:var(--text-muted)]">{commitment.review.message}</p>}</div>}
                  {commitment.review?.decisionNote && <p className="mt-3 flex items-start gap-2 text-[12px] text-[color:var(--text-muted)]"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />{commitment.review.decisionNote}</p>}
                  {commitment.review?.canDecide && <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => { setDecisionDialog({ review: commitment.review, decision: "changes_requested", title: commitment.title }); setDecisionNote(""); }}>Request changes</Button><Button variant="success" onClick={() => { setDecisionDialog({ review: commitment.review, decision: "accepted", title: commitment.title }); setDecisionNote(""); }} leftIcon={<CheckCircle2 className="h-4 w-4" />}>Accept outcome</Button></div>}
                </article>
              );
            })}</div>
          </section>
        ))}</div> : <div className="mt-10"><EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No shared outcomes yet" description="When the workspace shares an outcome with your client company, it will appear here." /></div>}
      </div>

      <Modal isOpen={Boolean(decisionDialog)} onClose={() => setDecisionDialog(null)} size="sm">
        <Modal.Header><div><Modal.Title>{decisionDialog?.decision === "accepted" ? "Accept this outcome?" : "Request changes"}</Modal.Title><p className="mt-1 text-[11px] text-[color:var(--text-muted)]">{decisionDialog?.title}</p></div></Modal.Header>
        <form onSubmit={decide}>
          <Modal.Body className="space-y-4">
            {decisionDialog?.decision === "accepted" ? <p className="text-[12px] leading-6 text-[color:var(--text-muted)]">This records your acceptance in the workspace assurance trail. The workspace will be notified immediately.</p> : <label className="block text-[12px] font-semibold text-[color:var(--text)]">What needs to change?<textarea className={`${inputClass} mt-2 h-28 resize-none py-3`} value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} maxLength={2000} autoFocus required /></label>}
          </Modal.Body>
          <Modal.Footer><Button variant="ghost" onClick={() => setDecisionDialog(null)}>Cancel</Button><Button type="submit" variant={decisionDialog?.decision === "accepted" ? "success" : "primary"} loading={deciding}>{decisionDialog?.decision === "accepted" ? "Confirm acceptance" : "Send change request"}</Button></Modal.Footer>
        </form>
      </Modal>
    </main>
  );
}
