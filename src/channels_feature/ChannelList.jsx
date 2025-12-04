// src/channels_feature/ChannelList.jsx
import React, { useEffect, useState } from "react";
import api from "../api";
import { getSocket } from "../socket";

function ChannelCreateForm({ onCreated, onCancel }) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [membersText, setMembersText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!key.trim() || !name.trim()) {
      setError("Key and Name are required");
      return;
    }

    const members = membersText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const res = await api.post("/chat", {
        key: key.trim(),
        name: name.trim(),
        type: "channel",
        isPrivate,
        members,
      });

      onCreated?.(res.data);
    } catch (err) {
      console.error("Create channel error", err);
      setError(err.response?.data?.message || "Failed to create channel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-800 p-3 space-y-2 text-xs bg-slate-950/90"
    >
      <div className="font-semibold text-slate-100 text-sm">
        Create a channel
      </div>

      {error && <div className="text-red-400 text-xs">{error}</div>}

      <div className="space-y-1">
        <label className="text-slate-300">Key</label>
        <input
          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
          placeholder="general, team-sales, etc."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-slate-300">Name</label>
        <input
          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
          placeholder="General chat"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private channel
      </label>

      <div className="space-y-1">
        <label className="text-slate-300">
          Member IDs (comma separated, optional)
        </label>
        <input
          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
          placeholder="user-id-1, user-id-2"
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          className="px-2 py-1 rounded border border-slate-600 text-slate-200"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
}

/**
 * ChannelList
 *
 * Props:
 *  - currentUserId: logged-in user's UUID
 *  - selectedKey: currently selected channel key
 *  - onSelect(key, channelObj): callback when user picks a channel
 */
export default function ChannelList({
  currentUserId,
  selectedKey,
  onSelect,
}) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function loadChannels() {
    setLoading(true);
    try {
      const res = await api.get("/chat/for-user");
      setChannels(res.data || []);
    } catch (err) {
      console.error("Failed to load channels", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChannels();

    const socket = getSocket();
    if (!socket) return;

    function handleChannelCreated(ch) {
      setChannels((prev) => {
        if (prev.find((c) => c.id === ch.id)) return prev;
        return [ch, ...prev];
      });
    }

    function handleAddedToChannel({ channelId }) {
      // simplest is to re-fetch
      loadChannels();
    }

    socket.on("chat:channel_created", handleChannelCreated);
    socket.on("chat:added_to_channel", handleAddedToChannel);

    return () => {
      socket.off("chat:channel_created", handleChannelCreated);
      socket.off("chat:added_to_channel", handleAddedToChannel);
    };
  }, [currentUserId]);

  return (
    <div className="w-64 bg-slate-900 text-slate-100 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="text-sm font-semibold">Channels</div>
        <button
          className="text-xs px-2 py-1 bg-slate-700 rounded hover:bg-slate-600"
          onClick={() => setShowCreate((v) => !v)}
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto text-sm">
        {loading ? (
          <div className="p-3 text-xs text-slate-400">Loading channels…</div>
        ) : channels.length === 0 ? (
          <div className="p-3 text-xs text-slate-400">No channels yet.</div>
        ) : (
          <ul>
            {channels.map((ch) => {
              const key = ch.key || ch.name || ch.id;
              const active = key === selectedKey;
              return (
                <li key={ch.id}>
                  <button
                    className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 ${
                      active ? "bg-slate-800 font-semibold" : ""
                    }`}
                    onClick={() => onSelect?.(key, ch)}
                  >
                    <span className="text-slate-400">#</span>
                    <span className="truncate">{ch.name || key}</span>
                    {ch.is_private && (
                      <span className="ml-auto text-[10px] bg-slate-700 px-1 rounded">
                        private
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {showCreate && (
        <ChannelCreateForm
          onCreated={() => {
            setShowCreate(false);
            loadChannels();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
