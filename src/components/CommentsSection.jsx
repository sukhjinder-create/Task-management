import { useEffect, useState } from "react";
import { useApi } from "../api";
import { useAuth } from "../context/AuthContext";

export default function CommentsSection({ taskId }) {
  const api = useApi();
  const { auth } = useAuth();

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    async function fetchComments() {
      try {
        setLoading(true);
        const res = await api.get(`/comments/${taskId}`);
        setComments(res.data || []);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.error || "Failed to load comments");
      } finally {
        setLoading(false);
      }
    }
    fetchComments();
  }, [open, taskId]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setAdding(true);
    setError("");
    try {
      const res = await api.post("/comments", {
        task_id: taskId,
        comment_text: newComment.trim(),
        added_by: auth.user.username,
      });
      setComments((prev) => [res.data, ...prev]);
      setNewComment("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to add comment");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-blue-600 hover:underline"
      >
        {open ? "Hide comments" : `Comments (${comments.length})`}
      </button>

      {open && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-xs text-slate-500">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-slate-500">No comments yet.</div>
          ) : (
            <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="text-xs border border-slate-100 rounded px-2 py-1">
                  <div>{c.comment_text}</div>
                  <div className="text-[10px] text-slate-400">
                    by {c.added_by} •{" "}
                    {c.created_at
                      ? new Date(c.created_at).toLocaleString()
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddComment} className="flex gap-1">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="text-xs bg-blue-600 text-white rounded-lg px-2 py-1 hover:bg-blue-700 disabled:opacity-50"
            >
              {adding ? "..." : "Add"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
