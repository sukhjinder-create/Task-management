// src/channels/ChannelSettingsModal.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";

export default function ChannelSettingsModal({
  open,
  channel,
  currentUser,
  onClose,
  onUpdate,
  onLeave,
  onDelete,
}) {
  const api = useApi();
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");

  const isAdmin = admins.includes(currentUser.id);

  // Load members + admins + all users
  useEffect(() => {
    if (!open || !channel?.id) return;

    async function load() {
      try {
        setMembersLoading(true);

        const [mRes, aRes, uRes] = await Promise.all([
          api.get(`/chat/channels/${channel.id}/members`),
          api.get(`/chat/channels/${channel.id}/admins`),
          api.get("/users"),
        ]);

        setMembers(mRes.data || []);
        setAdmins((aRes.data || []).map((a) => a.user_id));
        setAllUsers(uRes.data || []);
      } catch (err) {
        toast.error("Failed to load channel members");
      } finally {
        setMembersLoading(false);
      }
    }

    load();
  }, [open, channel?.id, api]);

  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      setAddingUser(true);

      await api.post(`/chat/channels/${channel.id}/members`, {
        user_id: selectedUser,
      });

      toast.success("Member added");

      // update local members list
      setMembers((prev) => [
        ...prev,
        { user_id: selectedUser }, // shape similar to backend row
      ]);
      setSelectedUser("");

      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to add member"
      );
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await api.delete(`/chat/channels/${channel.id}/members/${userId}`);

      setMembers((prev) =>
        prev.filter((m) => m.user_id !== userId && m.id !== userId)
      );
      setAdmins((prev) => prev.filter((a) => a !== userId));

      toast.success("Member removed");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error("Failed to remove member");
    }
  };

  const handlePromote = async (userId) => {
    try {
      await api.post(`/chat/channels/${channel.id}/admins`, {
        user_id: userId,
      });
      setAdmins((prev) => [...prev, userId]);
      toast.success("User promoted to admin");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to promote"
      );
    }
  };

  const handleDemote = async (userId) => {
    try {
      await api.delete(`/chat/channels/${channel.id}/admins/${userId}`);
      setAdmins((prev) => prev.filter((a) => a !== userId));
      toast.success("Admin removed");
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error("Failed to remove admin rights");
    }
  };

  const handleDeleteChannel = async () => {
    if (!window.confirm("Delete this channel for everyone permanently?")) return;
    try {
      await api.delete(`/chat/channels/${channel.id}`);
      toast.success("Channel deleted");
      if (onDelete) onDelete(channel.key);
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to delete channel"
      );
    }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this channel?")) return;
    try {
      await api.post(`/chat/channels/${channel.id}/leave`);
      toast.success("Left channel");
      if (onLeave) onLeave(channel.key);
    } catch (err) {
      toast.error("Failed to leave channel");
    }
  };

  if (!open || !channel) return null;

  // users that are NOT already members (for dropdown)
  const memberIds = new Set(
    members.map((m) => m.user_id || m.id)
  );
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-[440px] p-5 text-sm">
        <h2 className="text-base font-semibold mb-2 flex justify-between items-center">
          Channel Settings
          <button onClick={onClose} className="text-xs px-2 py-1">
            ✖
          </button>
        </h2>

        <p className="text-slate-500 text-xs mb-4">
          {channel.name} ({channel.is_private ? "Private" : "Public"})
        </p>

        {/* Members list */}
        <div className="border rounded p-3 mb-4 max-h-52 overflow-y-auto">
          <div className="text-[11px] text-slate-500 mb-2">Members</div>

          {membersLoading ? (
            <div className="text-[11px] text-slate-400">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-[11px] text-slate-400">No members yet.</div>
          ) : (
            members.map((m) => {
              const user = allUsers.find(
                (u) => u.id === m.user_id || u.id === m.id
              );
              if (!user) return null;

              const isUserAdmin = admins.includes(user.id);

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between border-b py-1 text-xs"
                >
                  <span>{user.username}</span>

                  <div className="flex gap-2 items-center">
                    {isUserAdmin && (
                      <span className="bg-blue-100 text-blue-600 px-2 py-[2px] rounded text-[10px]">
                        Admin
                      </span>
                    )}

                    {isAdmin && user.id !== currentUser.id && (
                      <>
                        {isUserAdmin ? (
                          <button
                            onClick={() => handleDemote(user.id)}
                            className="text-[10px] underline text-slate-500"
                          >
                            Remove admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePromote(user.id)}
                            className="text-[10px] underline text-slate-500"
                          >
                            Make admin
                          </button>
                        )}

                        <button
                          onClick={() => handleRemoveMember(user.id)}
                          className="text-[10px] underline text-red-500"
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add member dropdown */}
        {isAdmin && (
          <div className="mb-4">
            <div className="text-[11px] text-slate-500 mb-1">Add member</div>
            <div className="flex gap-2">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="border px-2 py-1 rounded flex-1 text-xs"
              >
                <option value="">Select user...</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                disabled={addingUser || !selectedUser}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs disabled:bg-blue-300"
              >
                {addingUser ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={handleLeave}
            className="text-xs px-3 py-1 border border-slate-300 rounded hover:bg-slate-50"
          >
            Leave channel
          </button>

          {isAdmin && (
            <button
              onClick={handleDeleteChannel}
              className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete channel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
