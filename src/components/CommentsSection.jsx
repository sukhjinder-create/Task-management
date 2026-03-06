// src/components/CommentsSection.jsx
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";
import { Button, Badge, Avatar } from "./ui";

export default function CommentsSection({ taskId }) {
  const api = useApi();
  const location = useLocation();

  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get(`/comments/${taskId}`);
        setComments(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [taskId, api]);

  // Deep-link highlight for ?comment=<id>
  useEffect(() => {
    if (!comments || comments.length === 0) return;

    const params = new URLSearchParams(location.search);
    const commentId = params.get("comment");
    if (!commentId) return;

    const exists = comments.some((c) => String(c.id) === commentId);
    if (!exists) return;

    setHighlightId(commentId);

    const el = document.getElementById(`comment-${commentId}`);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timeout = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(timeout);
  }, [comments, location.search]);

  const handleAdd = async (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!text.trim()) return;
  setAdding(true);

  try {
    await api.post(`/comments/${taskId}`, {
      comment_text: text,
    });

    // ✅ Immediately reload comments (so username is included)
    const refreshed = await api.get(`/comments/${taskId}`);
    setComments(refreshed.data || []);

    setText("");
  } catch (err) {
    console.error(err);
    const msg = err.response?.data?.error || "Failed to add comment";
    toast.error(msg);
  } finally {
    setAdding(false);
  }
};

  return (
    <div
      className="mt-4 border-t border-gray-200 pt-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
        {comments.length > 0 && (
          <Badge color="neutral" size="sm">{comments.length}</Badge>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-sm text-gray-400 mb-3">No comments yet. Be the first to comment!</div>
      ) : (
        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <div
              key={c.id}
              id={`comment-${c.id}`}
              className={
                "rounded-lg p-3 transition-colors " +
                (highlightId === String(c.id)
                  ? "bg-warning-50 border border-warning-200"
                  : "bg-gray-50")
              }
            >
              <div className="flex items-start gap-2">
                <Avatar name={c.username || c.added_by} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {c.username || c.added_by}
                    </span>
                    <span className="text-xs text-gray-400">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{c.comment_text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="flex gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment... (use @username to mention)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:ring-primary-500/20"
        />
        <Button
          type="submit"
          disabled={adding}
          loading={adding}
          variant="primary"
          size="sm"
        >
          Add
        </Button>
      </form>
    </div>
  );
}
