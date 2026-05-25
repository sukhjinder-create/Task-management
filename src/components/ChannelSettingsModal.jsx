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
    <div className="bg-black/60 fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-xl p-6 shadow-xl w-full max-w-[440px] text-sm">
        <h2 className="text-base font-semibold mb-2 flex justify-between items-center text-[color:var(--text)]">
          Channel Settings
          <button onClick={onClose} className="text-xs px-2 py-1 text-[color:var(--text-muted)] hover:text-[color:var(--text)] transition-colors">
            ✖
          </button>
        </h2>

        <p className="text-[color:var(--text-muted)] text-xs mb-4">
          {channel.name} ({channel.is_private ? "Private" : "Public"})
        </p>

        {/* Members list */}
        <div className="border border-[color:var(--border)] rounded-lg p-3 mb-4 max-h-52 overflow-y-auto">
          <div className="text-[11px] text-[color:var(--text-muted)] mb-2">Members</div>

          {membersLoading ? (
            <div className="text-[11px] text-[color:var(--text-muted)]">Loading…</div>
          ) : members.length === 0 ? (
            <div className="text-[11px] text-[color:var(--text-muted)]">No members yet.</div>
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
                  className="flex items-center justify-between border-b border-[color:var(--border)] py-1 text-xs"
                >
                  <span className="text-[color:var(--text)]">{user.username}</span>

                  <div className="flex gap-2 items-center">
                    {isUserAdmin && (
                      <span className="text-[color:var(--primary)] border border-[color:var(--primary)] px-2 py-[2px] rounded text-[10px]">
                        Admin
                      </span>
                    )}

                    {isAdmin && user.id !== currentUser.id && (
                      <>
                        {isUserAdmin ? (
                          <button
                            onClick={() => handleDemote(user.id)}
                            className="text-[10px] underline text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                          >
                            Remove admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePromote(user.id)}
                            className="text-[10px] underline text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
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
            <div className="text-[11px] text-[color:var(--text-muted)] mb-1">Add member</div>
            <div className="flex gap-2">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="bg-[var(--surface)] border border-[color:var(--border)] text-[color:var(--text)] rounded-lg px-2 py-1 flex-1 text-xs focus:outline-none focus:border-[color:var(--primary)] transition-colors"
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
                className="bg-[color:var(--primary)] text-[color:var(--primary-contrast)] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[color:var(--primary-hover)] transition-colors disabled:opacity-50"
              >
                {addingUser ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-6">
          <button
            onClick={handleLeave}
            className="border border-[color:var(--border)] text-[color:var(--text-muted)] px-4 py-2 rounded-lg text-sm hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors"
          >
            Leave channel
          </button>

          {isAdmin && (
            <button
              onClick={handleDeleteChannel}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Delete channel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
