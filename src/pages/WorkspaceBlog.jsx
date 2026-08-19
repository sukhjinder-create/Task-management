// src/pages/WorkspaceBlog.jsx
//
// Workspace-admin authoring for Asystence Insights.
//
// An admin here can write and submit; they cannot publish. The furthest this
// page can move an article is `in_review`, after which a Super Admin decides.
// That boundary is enforced by the backend — this UI only reflects it.

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import api from "../api";
import BlogEditor, { CATEGORY_LABELS } from "../components/BlogEditor";

const STATUS_STYLES = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
  in_review: { label: "In review", className: "bg-amber-100 text-amber-800" },
  changes_requested: { label: "Changes requested", className: "bg-orange-100 text-orange-800" },
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

export default function WorkspaceBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/blog");
      setPosts(data.posts || []);
    } catch (error) {
      toast.error(errorMessage(error, "Could not load your articles"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPost = useCallback(async (id) => {
    try {
      const { data } = await api.get(`/blog/${id}`);
      setSelected(data);
    } catch (error) {
      toast.error(errorMessage(error, "Could not open that article"));
    }
  }, []);

  const createDraft = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/blog", { title: "Untitled article" });
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
    if (!selected) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/blog/${selected.id}`, draft);
      setSelected((current) => ({ ...current, ...data }));
      await load();
      toast.success("Saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/blog/${selected.id}/submit`);
      setSelected((current) => ({ ...current, ...data }));
      await load();
      toast.success("Submitted for Super Admin review");
    } catch (error) {
      // A 422 carries the specific readiness failures, which are worth showing
      // in full rather than collapsing into "submission failed".
      toast.error(errorMessage(error, "Could not submit"));
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/blog/${selected.id}/withdraw`);
      setSelected((current) => ({ ...current, ...data }));
      await load();
      toast.success("Withdrawn — you can edit it again");
    } catch (error) {
      toast.error(errorMessage(error, "Could not withdraw"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (post) => {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/blog/${post.id}`);
      if (selected?.id === post.id) setSelected(null);
      await load();
      toast.success("Deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete"));
    }
  };

  const editable = useMemo(
    () => selected && ["draft", "changes_requested"].includes(selected.status),
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
          <ArrowLeft className="h-4 w-4" /> All articles
        </button>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{selected.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusPill status={selected.status} />
              <span className="text-xs text-gray-500">
                {CATEGORY_LABELS[selected.category]} &middot; rev {selected.revision}
              </span>
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

        {selected.status === "changes_requested" && selected.review_note && (
          <div className="mb-5 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm font-semibold text-orange-900">A Super Admin requested changes</p>
            <p className="mt-1 text-sm text-orange-800">{selected.review_note}</p>
          </div>
        )}

        {selected.status === "in_review" && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <Clock className="h-4 w-4 shrink-0" />
            Awaiting Super Admin review. Withdraw it to make further edits.
          </div>
        )}

        {selected.status === "published" && (
          <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            This article is live. Further edits are made by a Super Admin.
          </div>
        )}

        <BlogEditor
          post={selected}
          onSave={save}
          saving={saving}
          readOnly={!editable}
          readiness={selected.readiness || []}
          actions={
            <>
              {editable && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Submit for review
                </button>
              )}
              {selected.status === "in_review" && (
                <button
                  type="button"
                  onClick={withdraw}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Undo2 className="h-4 w-4" /> Withdraw
                </button>
              )}
            </>
          }
        />
      </div>
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Asystence Insights</h1>
          <p className="mt-1 text-sm text-gray-600">
            Write articles for the public publication. A Super Admin reviews and publishes them.
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
            <Plus className="h-4 w-4" /> New article
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <FileText className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No articles yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Start a draft and submit it when it meets the publication standard.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {posts.map((post) => (
            <div key={post.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
              <button onClick={() => openPost(post.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-gray-900">{post.title}</p>
                <p className="mt-1 truncate text-xs text-gray-500">
                  {CATEGORY_LABELS[post.category]} &middot; {post.reading_minutes} min read
                  {post.published_at && ` · published ${new Date(post.published_at).toLocaleDateString()}`}
                </p>
              </button>
              <StatusPill status={post.status} />
              {post.status !== "published" && (
                <button
                  onClick={() => remove(post)}
                  className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
