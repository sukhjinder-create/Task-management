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
    <div className="flex items-center gap-3 mt-2 pt-2 border-t">
      {/* Vote button */}
      <button
        onClick={toggleVote}
        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors ${
          voteData.voted
            ? "bg-indigo-100 border-indigo-300 text-indigo-700"
            : "bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
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
            ? "bg-amber-50 border-amber-300 text-amber-700"
            : "bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600"
        }`}
        title={watchData.watching ? "Stop watching" : "Watch this task"}
      >
        {watchData.watching ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        <span>{watchData.watching ? "Watching" : "Watch"}</span>
      </button>

      {/* Watchers list */}
      {watchData.watchers.length > 0 && (
        <button
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
          onClick={() => setShowWatchers(v => !v)}
          title="View watchers"
        >
          <Users className="w-3 h-3" />
          <span>{watchData.watchers.length} watcher{watchData.watchers.length !== 1 ? "s" : ""}</span>
        </button>
      )}

      {/* Watcher names */}
      {showWatchers && watchData.watchers.length > 0 && (
        <div className="absolute mt-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 text-[11px] space-y-1 min-w-[140px]">
          {watchData.watchers.map(w => (
            <div key={w.user_id} className="text-slate-700">{w.name || w.email}</div>
          ))}
        </div>
      )}
    </div>
  );
}
