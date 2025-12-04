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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[999]">
      <div className="bg-white rounded-lg shadow-xl w-96 p-5 text-sm">
        <h2 className="text-base font-semibold mb-3">Create new channel</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Channel name
            </label>
            <input
              type="text"
              placeholder="#marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border px-3 py-2 rounded focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              id="privateChannel"
            />
            <label htmlFor="privateChannel" className="text-xs text-slate-600">
              Make this channel private (invite-only)
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 border rounded hover:bg-slate-50 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs disabled:bg-blue-300"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
