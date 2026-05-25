// src/components/WatchersVotesBar.jsx
import { useEffect, useState } from "react";
import { Eye, EyeOff, ThumbsUp, Users } from "lucide-react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function WatchersVotesBar({ taskId }) {
  const api = useApi();
  const [watchData, setWatchData] = useState({ watchers: [], watching: false });
  const [voteData, setVoteData] = useState({ count: 0, voted: false });
  const [showWatchers, setShowWatchers] = useState(false);

  useEffect(() => {
    api.get(`/watchers/${taskId}`).then(r => setWatchData(r.data)).catch(() => {});
    api.get(`/votes/${taskId}`).then(r => setVoteData(r.data)).catch(() => {});
  }, [taskId]);

  const toggleWatch = async () => {
    try {
      if (watchData.watching) {
        const res = await api.delete(`/watchers/${taskId}/watch`);
        setWatchData(res.data);
        toast.success("Unwatched");
      } else {
        const res = await api.post(`/watchers/${taskId}/watch`);
        setWatchData(res.data);
        toast.success("Watching");
      }
    } catch {
      toast.error("Failed to update watch");
    }
  };

  const toggleVote = async () => {
    try {
      const res = await api.post(`/votes/${taskId}/toggle`);
      setVoteData(res.data);
    } catch {
      toast.error("Failed to vote");
    }
  };

  return (
    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[color:var(--border)]">
      {/* Vote button */}
      <button
        onClick={toggleVote}
        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors ${
          voteData.voted
            ? "bg-[var(--surface-soft)] border-[color:var(--primary)] text-[color:var(--primary)]"
            : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
        }`}
        title={voteData.voted ? "Remove vote" : "Upvote this issue"}
      >
        <ThumbsUp className="w-3 h-3" />
        <span>{voteData.count}</span>
      </button>

      {/* Watch button */}
      <button
        onClick={toggleWatch}
        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors ${
          watchData.watching
            ? "bg-[var(--surface-soft)] border-[color:var(--primary)] text-[color:var(--primary)]"
            : "border-[color:var(--border)] text-[color:var(--text-muted)] hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
        }`}
        title={watchData.watching ? "Stop watching" : "Watch this task"}
      >
        {watchData.watching ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        <span>{watchData.watching ? "Watching" : "Watch"}</span>
      </button>

      {/* Watchers list */}
      {watchData.watchers.length > 0 && (
        <button
          className="flex items-center gap-1 text-[11px] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          onClick={() => setShowWatchers(v => !v)}
          title="View watchers"
        >
          <Users className="w-3 h-3" />
          <span>{watchData.watchers.length} watcher{watchData.watchers.length !== 1 ? "s" : ""}</span>
        </button>
      )}

      {/* Watcher names */}
      {showWatchers && watchData.watchers.length > 0 && (
        <div className="absolute mt-8 z-20 bg-[var(--surface)] border border-[color:var(--border)] rounded-lg p-2 text-[11px] space-y-1 min-w-[140px]">
          {watchData.watchers.map(w => (
            <div key={w.user_id} className="text-[color:var(--text-soft)]">{w.name || w.email}</div>
          ))}
        </div>
      )}
    </div>
  );
}
