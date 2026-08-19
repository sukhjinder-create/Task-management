// src/pages/SuperadminBlog.jsx
//
// The editorial console. Two jobs in one page:
//
//   1. The review queue — workspace submissions awaiting a decision. Publish
//      puts the article live immediately; requesting changes returns it to its
//      author with a note.
//   2. First-party authoring — a Super Admin writes and publishes directly,
//      with no review step, because they are the reviewer.

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  EyeOff,
  FileText,
  Inbox,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
} from "lucide-react";
import superadminApi from "../superadminApi";
import BlogEditor, { CATEGORY_LABELS } from "../components/BlogEditor";

const FILTERS = [
  { key: "in_review", label: "Awaiting review" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "changes_requested", label: "Returned" },
  { key: "archived", label: "Unpublished" },
  { key: "", label: "All" },
];

const STATUS_STYLES = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  in_review: { label: "In review", className: "bg-amber-100 text-amber-800" },
  changes_requested: { label: "Returned", className: "bg-orange-100 text-orange-800" },
  published: { label: "Published", className: "bg-emerald-100 text-emerald-800" },
  archived: { label: "Unpublished", className: "bg-slate-100 text-slate-600" },
};

function StatusPill({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

function errorMessage(error, fallback) {
  const data = error?.response?.data;
  if (data?.details?.length) return `${data.error}: ${data.details.join("; ")}`;
  return data?.error || fallback;
}

export default function SuperadminBlog() {
  const [posts, setPosts] = useState([]);
  const [counts, setCounts] = useState({});
  const [filter, setFilter] = useState("in_review");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, queue] = await Promise.all([
        superadminApi.get("/superadmin/blog", { params: filter ? { status: filter } : {} }),
        superadminApi.get("/superadmin/blog/queue"),
      ]);
      setPosts(list.data.posts || []);
      setCounts(queue.data.counts || {});
    } catch (error) {
      toast.error(errorMessage(error, "Could not load the editorial queue"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openPost = useCallback(async (id) => {
    try {
      const { data } = await superadminApi.get(`/superadmin/blog/${id}`);
      setSelected(data);
    } catch (error) {
      toast.error(errorMessage(error, "Could not open that article"));
    }
  }, []);

  const createDraft = async () => {
    setBusy(true);
    try {
      const { data } = await superadminApi.post("/superadmin/blog", { title: "Untitled article" });
      await load();
      await openPost(data.id);
      toast.success("Draft created");
    } catch (error) {
      toast.error(errorMessage(error, "Could not create a draft"));
    } finally {
      setBusy(false);
    }
  };

  const save = async (draft) => {
    setSaving(true);
    try {
      const { data } = await superadminApi.put(`/superadmin/blog/${selected.id}`, draft);
      setSelected((current) => ({ ...current, ...data }));
      await load();
      toast.success(data.status === "published" ? "Saved — live copy updated" : "Saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const act = async (path, body, successMessage) => {
    setBusy(true);
    try {
      const { data } = await superadminApi.post(`/superadmin/blog/${selected.id}/${path}`, body);
      setSelected((current) => ({ ...current, ...data }));
      await load();
      toast.success(successMessage);
    } catch (error) {
      toast.error(errorMessage(error, "That action failed"));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => act("publish", {}, "Published — live now");
  const unpublish = () => {
    if (!window.confirm("Take this article off the public site?")) return;
    act("unpublish", {}, "Unpublished");
  };
  const requestChanges = () => {
    const note = window.prompt("What needs to change before this can be published?");
    if (!note?.trim()) return;
    act("request-changes", { note }, "Returned to the author");
  };

  const remove = async (post) => {
    if (!window.confirm(`Delete “${post.title}” permanently?`)) return;
    try {
      await superadminApi.delete(`/superadmin/blog/${post.id}`);
      if (selected?.id === post.id) setSelected(null);
      await load();
      toast.success("Deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete"));
    }
  };

  const pending = counts.in_review || 0;
  const canPublish = useMemo(
    () => selected && selected.status !== "published" && (selected.readiness || []).length === 0,
    [selected]
  );

  // ── Editor ────────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <button
          onClick={() => { setSelected(null); load(); }}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> Editorial queue
        </button>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{selected.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusPill status={selected.status} />
              <span className="text-xs text-gray-500">{CATEGORY_LABELS[selected.category]}</span>
              {selected.origin === "workspace" && (
                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                  <Building2 className="h-3.5 w-3.5" />
                  {selected.author_workspace_name || "Unknown workspace"}
                  {selected.author_username && ` · ${selected.author_username}`}
                </span>
              )}
              {selected.origin === "platform" && (
                <span className="text-xs text-gray-500">Written in-house</span>
              )}
            </div>
          </div>
          {selected.public_url && (
            <a
              href={`https://asystence.com${selected.public_url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View live <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <BlogEditor
          post={selected}
          onSave={save}
          saving={saving}
          readiness={selected.readiness || []}
          actions={
            <>
              <button
                type="button"
                onClick={publish}
                disabled={busy || !canPublish}
                title={canPublish ? "" : "Resolve the readiness problems first"}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Rocket className="h-4 w-4" />
                {selected.status === "in_review" ? "Approve & publish" : "Publish"}
              </button>

              {selected.status === "in_review" && (
                <button
                  type="button"
                  onClick={requestChanges}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                >
                  <MessageSquareWarning className="h-4 w-4" /> Request changes
                </button>
              )}

              {selected.status === "published" && (
                <button
                  type="button"
                  onClick={unpublish}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <EyeOff className="h-4 w-4" /> Unpublish
                </button>
              )}
            </>
          }
        />

        {selected.history?.length > 0 && (
          <div className="mt-8 border-t border-gray-200 pt-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">History</h3>
            <ul className="space-y-2">
              {selected.history.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-xs text-gray-600">
                  <span className="font-medium text-gray-800">{event.action.replace(/_/g, " ")}</span>
                  <span>
                    by {event.actor_username || event.actor_superadmin_email || event.actor_type}
                  </span>
                  <span className="text-gray-400">{new Date(event.created_at).toLocaleString()}</span>
                  {event.note && <span className="w-full text-gray-500">“{event.note}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Asystence Insights</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review workspace submissions and publish to the public site. Publishing is live
            immediately — no deploy needed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={createDraft}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Write an article
          </button>
        </div>
      </div>

      {pending > 0 && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Inbox className="h-4 w-4 shrink-0" />
          {pending} article{pending === 1 ? "" : "s"} awaiting your review.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <button
            key={entry.key || "all"}
            onClick={() => setFilter(entry.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === entry.key
                ? "bg-gray-900 text-white"
                : "border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {entry.label}
            {entry.key && counts[entry.key] ? ` (${counts[entry.key]})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">Nothing here</p>
          <p className="mt-1 text-sm text-gray-500">No articles match this filter.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <button onClick={() => openPost(post.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-gray-900">{post.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 truncate text-xs text-gray-500">
                  <span>{CATEGORY_LABELS[post.category]}</span>
                  <span>&middot;</span>
                  <span>
                    {post.origin === "workspace"
                      ? post.author_workspace_name || "Workspace"
                      : "In-house"}
                  </span>
                  {post.submitted_at && (
                    <>
                      <span>&middot;</span>
                      <span>submitted {new Date(post.submitted_at).toLocaleDateString()}</span>
                    </>
                  )}
                </p>
              </button>

              {post.status === "published" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              )}
              <StatusPill status={post.status} />
              <button
                onClick={() => remove(post)}
                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
