// src/channels/CreateChannelModal.jsx
import { useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function ChannelCreateModal({ open, onClose, onCreated }) {
  const api = useApi();
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

 const handleCreate = async (e) => {
  e.preventDefault();
  if (!name.trim()) return toast.error("Name required.");

  try {
    setLoading(true);

    const payload = {
      name: name.trim(),
      is_private: isPrivate,
    };

    const res = await api.post("/chat/channels", payload);

    toast.success(`Channel ${name} created.`);

    if (onCreated) onCreated(res.data);
    onClose();
    setName("");
    setIsPrivate(false);
  } catch (err) {
    toast.error(err.response?.data?.error || "Failed to create channel");
  } finally {
    setLoading(false);
  }
};


  if (!open) return null;

  return (
    <div className="bg-black/60 fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-6 shadow-xl w-full max-w-md text-sm">
        <h2 className="text-base font-semibold mb-3 text-[color:var(--text)]">Create new channel</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[color:var(--text-muted)] mb-1">
              Channel name
            </label>
            <input
              type="text"
              placeholder="#marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-3 py-2 w-full focus:outline-none focus:border-[color:var(--primary)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              id="privateChannel"
            />
            <label htmlFor="privateChannel" className="text-xs text-[color:var(--text-muted)]">
              Make this channel private (invite-only)
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-[color:var(--border)] text-[color:var(--text-muted)] px-4 py-2 rounded-lg text-sm hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
