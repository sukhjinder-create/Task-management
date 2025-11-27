// src/components/CommentsSection.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function CommentsSection({ taskId }) {
  const api = useApi();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

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

  const handleAdd = async (e) => {
    e.preventDefault();
    // ❗️Important: don't let this click bubble to the card
    e.stopPropagation();

    if (!text.trim()) return;
    setAdding(true);
    try {
      const res = await api.post(`/comments/${taskId}`, {
        comment_text: text,
      });
      setComments((prev) => [...prev, res.data]);
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
      className="mt-2 border-t border-slate-100 pt-2"
      // also block any clicks inside this area from triggering card onClick
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-[11px] font-semibold mb-1">Comments</div>
      {loading ? (
        <div className="text-[11px] text-slate-400">Loading comments...</div>
      ) : comments.length === 0 ? (
        <div className="text-[11px] text-slate-400">No comments yet.</div>
      ) : (
        <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="text-[11px]">
              <span className="font-semibold">{c.username}:</span>{" "}
              <span>{c.comment_text}</span>
              <span className="text-[9px] text-slate-400 ml-1">
                {c.created_at
                  ? new Date(c.created_at).toLocaleString()
                  : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="flex gap-1"
        // extra safety: clicks in form don't bubble to card
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 border rounded-lg px-2 py-1 text-[11px]"
        />
        <button
          type="submit"
          disabled={adding}
          className="text-[11px] border border-slate-300 rounded px-2 py-1 hover:bg-slate-50 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add"}
        </button>
      </form>
    </div>
  );
}
