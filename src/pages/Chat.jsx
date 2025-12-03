// src/pages/Chat.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../api";
import {
  getSocket,
  initSocket,
  joinChatChannel,
  leaveChatChannel,
  sendChatMessage,
  sendTyping,
  sendReadReceipt,
  startHuddle,
  endHuddle,
  sendReaction,
} from "../socket";
import useHuddleWebRTC from "../webrtc/huddleRTC"; // NOTE: default import now
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

// ----- CONFIG -----
const GENERAL_CHANNEL_KEY = "general";

// Quick reactions for the mini emoji picker
const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

// Rich editor config (minimal, Slack-ish)
const quillModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
  ],
};
const quillFormats = ["bold", "italic", "underline", "list", "bullet", "link"];

// Helpers
function createUniqueId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Always sort ids so dm key is stable (dm:userA:userB)
function dmKeyFor(userIdA, userIdB) {
  const [a, b] = [userIdA, userIdB].sort();
  return `dm:${a}:${b}`;
}

function presenceColor(status) {
  if (status === "online" || status === "available") return "bg-green-500";
  if (status === "aws") return "bg-amber-500";
  if (status === "lunch") return "bg-blue-500";
  if (status === "signed-off") return "bg-slate-400";
  return "bg-slate-300";
}

function presenceLabel(status) {
  if (status === "online" || status === "available") return "Available";
  if (status === "aws") return "Away from system";
  if (status === "lunch") return "On lunch break";
  if (status === "signed-off") return "Signed off";
  if (status === "offline") return "Offline";
  return "Unknown";
}

// Small reusable video tile for huddles
function HuddleVideoTile({ stream, label, isYou, muted }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center border border-slate-700">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-400 text-xs py-6">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center mb-2">
            {label?.[0]?.toUpperCase() || "?"}
          </div>
          <span>{isYou ? "Waiting for your media..." : "Connecting..."}</span>
        </div>
      )}
      <div className="absolute bottom-1 left-2 text-[10px] px-2 py-[2px] rounded-full bg-black/60 text-slate-100">
        {isYou ? "You" : label || "Teammate"}
      </div>
    </div>
  );
}

export default function Chat() {
  const { auth } = useAuth();
  const api = useApi();
  const user = auth.user;

  // ----- STATE -----
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // channelKey -> [messages]
  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [activeChannelKey, setActiveChannelKey] = useState(GENERAL_CHANNEL_KEY);
  const [activeDmUser, setActiveDmUser] = useState(null);

  // presence map: userId -> { status, at }
  const [presenceMap, setPresenceMap] = useState({});

  // Rich editor content
  const [editorHtml, setEditorHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);

  // Typing indicators: channelId -> { userId -> { username, at } }
  const [typingByChannel, setTypingByChannel] = useState({});

  // Read receipts: channelId -> { userId -> { at } }
  const [readReceiptsByChannel, setReadReceiptsByChannel] = useState({});

  // Huddle metadata (GLOBAL: can be from any channel)
  const [activeHuddle, setActiveHuddle] = useState(null);

  // small tick just to let typing timeouts refresh
  const [, setTick] = useState(0);

  const listRef = useRef(null);
  const activeChannelRef = useRef(GENERAL_CHANNEL_KEY);
  const fileInputRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  // For draggable huddle panel
  const huddlePanelRef = useRef(null);
  const huddleLastMousePosRef = useRef({ x: 0, y: 0 });
  const [huddleDrag, setHuddleDrag] = useState({
    dragging: false,
    x: 0,
    y: 0,
  });

  // NEW: fullscreen state for huddle panel
  const [isHuddleFullscreen, setIsHuddleFullscreen] = useState(false);

  // Which message's emoji picker is open
  const [openReactionFor, setOpenReactionFor] = useState(null);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingOriginalChannel, setEditingOriginalChannel] = useState(null);

  // ----- DERIVED -----
  const activeMessages = messagesByChannel[activeChannelKey] || [];

  const teammates = useMemo(
    () => users.filter((u) => u.id !== user.id),
    [users, user.id]
  );

  // sort teammates by presence then name
  const sortedTeammates = useMemo(() => {
    return [...teammates].sort((a, b) => {
      const pa = presenceMap[a.id]?.status || "offline";
      const pb = presenceMap[b.id]?.status || "offline";
      const score = (s) =>
        s === "online" || s === "available"
          ? 3
          : s === "aws" || s === "lunch"
          ? 2
          : s === "signed-off"
          ? 1
          : 0;
      const diff = score(pb) - score(pa);
      if (diff !== 0) return diff;
      return a.username.localeCompare(b.username);
    });
  }, [teammates, presenceMap]);

  const isGeneralChannel = activeChannelKey === GENERAL_CHANNEL_KEY;
  const isThreadChannel = activeChannelKey.startsWith("thread:");

  const activeChannelTitle = isThreadChannel
    ? "Thread"
    : isGeneralChannel
    ? "Team Chat"
    : activeDmUser
    ? `Direct Message with ${activeDmUser.username}`
    : "Direct Message";

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const messagesToRender = useMemo(() => {
    if (!normalizedSearch) return activeMessages;
    return activeMessages.filter((m) => {
      const text = (m.textHtml || m.text || "").toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [activeMessages, normalizedSearch]);

  const lastMessageId =
    activeMessages.length > 0
      ? activeMessages[activeMessages.length - 1].id
      : null;

  // ----- Huddle WebRTC hook (multi-user, join button) -----
  const {
    joined: huddleJoined,
    connecting: huddleConnecting,
    error: huddleError,
    localStream,
    remotePeers,
    isMuted,
    isCameraOff,
    isScreenSharing,
    joinHuddle,
    leaveHuddle,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  } = useHuddleWebRTC({
    channelId: activeChannelKey, // view channel
    user,
    activeHuddle, // source of truth for actual huddle channel/id
  });

  const isHuddleActiveHere =
    activeHuddle && activeHuddle.channelId === activeChannelKey;

  const isHuddleOwner =
    activeHuddle &&
    String(activeHuddle.startedBy?.userId) === String(user.id);

  // force re-render to allow typing timers to expire
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 🔹 Keep fullscreen state in sync if user presses ESC
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsHuddleFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // ----- SCROLL ON NEW MESSAGES -----
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [activeMessages]);

  // ----- LOAD USERS ONE TIME -----
  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        setLoadingUsers(true);
        const res = await api.get("/users");
        if (cancelled) return;
        setUsers(res.data || []);
      } catch (err) {
        console.error("Failed to load users for chat:", err);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    }

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [api]);

  // ----- SOCKET SETUP: CONNECTION + LISTENERS -----
  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }

    if (!socket) {
      setConnected(false);
      setJoining(false);
      return;
    }

    const handleConnect = () => {
      setConnected(true);
      setJoining(false);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleHistory = (payload) => {
      if (!payload || !payload.channelId) return;
      const channelId = payload.channelId;
      const history = (payload.messages || []).map((m) => ({
        id: m.id || createUniqueId("msg"),
        channelId,
        textHtml: m.textHtml || m.text_html || m.text || "",
        userId: m.userId || m.user_id,
        username: m.username,
        createdAt: m.createdAt || m.created_at,
        updatedAt: m.updatedAt || m.updated_at,
        deletedAt: m.deletedAt || m.deleted_at,
        reactions: m.reactions || {},
        attachments: m.attachments || [],
      }));

      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: history,
      }));

      setLoadingHistory(false);
    };

    const handleChatMessage = (msg) => {
      if (!msg || !msg.channelId) return;
      const channelId = msg.channelId;

      setMessagesByChannel((prev) => {
        const existing = prev[channelId] || [];
        const next = [...existing];

        // optimistic reconciliation if tempId
        if (msg.tempId) {
          const idxTemp = next.findIndex((m) => m.id === msg.tempId);
          if (idxTemp !== -1) {
            next[idxTemp] = {
              ...next[idxTemp],
              ...msg,
              id: msg.id || msg.tempId,
            };
            return { ...prev, [channelId]: next };
          }
        }

        if (msg.id) {
          const idx = next.findIndex((m) => m.id === msg.id);
          if (idx !== -1) {
            next[idx] = { ...next[idx], ...msg };
            return { ...prev, [channelId]: next };
          }
        }

        const safeId = msg.id || msg.tempId || createUniqueId("msg");
        next.push({
          id: safeId,
          channelId,
          textHtml: msg.textHtml || msg.text_html || msg.text || "",
          userId: msg.userId || msg.user_id,
          username: msg.username,
          createdAt: msg.createdAt || msg.created_at,
          updatedAt: msg.updatedAt || msg.updated_at,
          deletedAt: msg.deletedAt || msg.deleted_at,
          reactions: msg.reactions || {},
          attachments: msg.attachments || [],
        });

        return { ...prev, [channelId]: next };
      });
    };

    const handleSystem = (payload) => {
      if (!payload || !payload.channelId) return;
      const channelId = payload.channelId;
      let txt = "";
      if (payload.type === "join") {
        txt = `${payload.username || "Someone"} joined the channel`;
      } else if (payload.type === "leave") {
        txt = `${payload.username || "Someone"} left the channel`;
      } else {
        return;
      }

      // de-duplicate very recent identical system messages
      setMessagesByChannel((prev) => {
        const existing = prev[channelId] || [];
        const last = existing[existing.length - 1];

        const createdAt = payload.at || new Date().toISOString();

        if (
          last &&
          last.system &&
          last.textHtml === txt &&
          last.channelId === channelId
        ) {
          const lastTime = new Date(last.createdAt || 0).getTime();
          const thisTime = new Date(createdAt).getTime();
          if (thisTime - lastTime < 2000) {
            return prev;
          }
        }

        const next = [
          ...existing,
          {
            id: createUniqueId("sys"),
            channelId,
            system: true,
            textHtml: txt,
            createdAt,
          },
        ];
        return { ...prev, [channelId]: next };
      });
    };

    const handlePresenceUpdate = (payload) => {
      if (!payload || !payload.userId) return;
      setPresenceMap((prev) => ({
        ...prev,
        [payload.userId]: {
          status: payload.status || "unknown",
          at: payload.at || new Date().toISOString(),
        },
      }));
    };

    // Typing from others
    const handleTyping = (payload) => {
      if (!payload || !payload.channelId) return;
      const channelId = payload.channelId;
      const typingUserId = payload.userId || payload.user_id;
      if (!typingUserId) return;
      if (String(typingUserId) === String(user.id)) return;

      const username = payload.username || "Someone";
      const at = payload.at || new Date().toISOString();

      setTypingByChannel((prev) => {
        const current = prev[channelId] || {};
        return {
          ...prev,
          [channelId]: {
            ...current,
            [typingUserId]: { username, at },
          },
        };
      });
    };

    // Read receipts from others
    const handleRead = (payload) => {
      if (!payload || !payload.channelId || !payload.userId) return;
      const channelId = payload.channelId;
      const readerId = payload.userId;
      if (String(readerId) === String(user.id)) return;

      const at = payload.at || new Date().toISOString();

      setReadReceiptsByChannel((prev) => {
        const channelReads = prev[channelId] || {};
        const prevAtStr = channelReads[readerId]?.at;
        const prevAt = prevAtStr ? new Date(prevAtStr).getTime() : 0;
        const nextAt = new Date(at).getTime();
        if (nextAt <= prevAt) return prev;

        return {
          ...prev,
          [channelId]: {
            ...channelReads,
            [readerId]: { at },
          },
        };
      });
    };

    // Huddle events
    const handleHuddleStarted = (payload) => {
      if (!payload || !payload.channelId || !payload.huddleId) return;

      // This is GLOBAL: if a huddle starts in any channel, remember it
      setActiveHuddle({
        channelId: payload.channelId,
        huddleId: payload.huddleId,
        startedBy: payload.startedBy,
        at: payload.at,
      });
    };

    const handleHuddleEnded = (payload) => {
      if (!payload || !payload.channelId || !payload.huddleId) return;

      // If this is the same huddle we know about, clear it
      setActiveHuddle((prev) => {
        if (
          prev &&
          prev.channelId === payload.channelId &&
          prev.huddleId === payload.huddleId
        ) {
          // Also leave WebRTC locally
          leaveHuddle();
          return null;
        }
        return prev;
      });
    };

    // Reactions from others
    const handleReaction = (payload = {}) => {
      const { channelId, messageId, emoji, action, userId: reactorId } =
        payload;
      if (!channelId || !messageId || !emoji || !action || !reactorId) return;

      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        const nextChannelMessages = channelMessages.map((msg) => {
          if (msg.id !== messageId) return msg;
          const current = msg.reactions || {};
          const existing = current[emoji] || { count: 0, userIds: [] };
          const userIdsSet = new Set(existing.userIds || []);
          if (action === "add") {
            userIdsSet.add(reactorId);
          } else if (action === "remove") {
            userIdsSet.delete(reactorId);
          }
          const newUserIds = Array.from(userIdsSet);
          const newReactions = { ...current };
          if (newUserIds.length === 0) {
            delete newReactions[emoji];
          } else {
            newReactions[emoji] = {
              count: newUserIds.length,
              userIds: newUserIds,
            };
          }
          return { ...msg, reactions: newReactions };
        });

        return {
          ...prev,
          [channelId]: nextChannelMessages,
        };
      });
    };

    const handleMessageEdited = (payload = {}) => {
      const {
        channelId,
        id,
        messageId,
        textHtml,
        text,
        updatedAt,
        updated_at,
      } = payload;
      const msgId = id || messageId;
      if (!channelId || !msgId) return;

      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        const next = channelMessages.map((m) =>
          m.id === msgId
            ? {
                ...m,
                textHtml: textHtml || text || m.textHtml,
                updatedAt: updatedAt || updated_at || m.updatedAt,
              }
            : m
        );
        return { ...prev, [channelId]: next };
      });
    };

    const handleMessageDeleted = (payload = {}) => {
      const { channelId, id, messageId, deletedAt, deleted_at } = payload;
      const msgId = id || messageId;
      if (!channelId || !msgId) return;

      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        const next = channelMessages.map((m) =>
          m.id === msgId
            ? {
                ...m,
                deletedAt: deletedAt || deleted_at || new Date().toISOString(),
              }
            : m
        );
        return { ...prev, [channelId]: next };
      });
    };

    // WebRTC signaling handled inside useHuddleWebRTC via socket.on("huddle:signal")

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:history", handleHistory);
    socket.on("chat:message", handleChatMessage);
    socket.on("chat:system", handleSystem);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:read", handleRead);
    socket.on("huddle:started", handleHuddleStarted);
    socket.on("huddle:ended", handleHuddleEnded);
    socket.on("chat:reaction", handleReaction);
    socket.on("chat:messageEdited", handleMessageEdited);
    socket.on("chat:messageDeleted", handleMessageDeleted);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:history", handleHistory);
      socket.off("chat:message", handleChatMessage);
      socket.off("chat:system", handleSystem);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:read", handleRead);
      socket.off("huddle:started", handleHuddleStarted);
      socket.off("huddle:ended", handleHuddleEnded);
      socket.off("chat:reaction", handleReaction);
      socket.off("chat:messageEdited", handleMessageEdited);
      socket.off("chat:messageDeleted", handleMessageDeleted);
    };
  }, [auth.token, user.id, leaveHuddle]);

  // ----- JOIN / LEAVE WHEN ACTIVE CHANNEL CHANGES -----
  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }
    if (!socket) return;

    const prev = activeChannelRef.current;
    if (prev && prev !== activeChannelKey) {
      leaveChatChannel(prev);
    }

    setLoadingHistory(true);
    joinChatChannel(activeChannelKey);
    activeChannelRef.current = activeChannelKey;

    // clear typing indicator for new channel
    setTypingByChannel((prev) => ({
      ...prev,
      [activeChannelKey]: {},
    }));

    // ❗️IMPORTANT: we NO LONGER clear activeHuddle here
    // This keeps the huddle global across channels

    // close any open reaction picker
    setOpenReactionFor(null);
  }, [activeChannelKey, auth.token]);

  // ----- SEND MESSAGE -----
  const handleSend = async (e) => {
    e.preventDefault();
    const html = (editorHtml || "").trim();
    if (!html) return;
    if (!connected) return;

    // EDIT MODE
    if (editingMessageId) {
      const channelId = editingOriginalChannel || activeChannelKey;
      const messageId = editingMessageId;

      // optimistic update
      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        const next = channelMessages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                textHtml: html,
                updatedAt: new Date().toISOString(),
              }
            : m
        );
        return { ...prev, [channelId]: next };
      });

      const socket = getSocket();
      if (socket) {
        socket.emit("chat:edit", {
          channelId,
          messageId,
          text: html,
        });
      }

      setEditingMessageId(null);
      setEditingOriginalChannel(null);
      setEditorHtml("");
      setAttachment(null);
      setSending(false);
      return;
    }

    const tempId = createUniqueId("temp");

    setSending(true);

    // optimistic UI
    setMessagesByChannel((prev) => {
      const existing = prev[activeChannelKey] || [];
      const next = [
        ...existing,
        {
          id: tempId,
          channelId: activeChannelKey,
          textHtml: html,
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString(),
          reactions: {},
        },
      ];
      return { ...prev, [activeChannelKey]: next };
    });

    sendChatMessage({
      channelId: activeChannelKey,
      text: html,
      tempId,
    });

    setEditorHtml("");
    setAttachment(null);
    setSending(false);
  };

  const handleSelectDm = (otherUser) => {
    const key = dmKeyFor(user.id, otherUser.id);
    setActiveChannelKey(key);
    setActiveDmUser(otherUser);
  };

  const handleSelectGeneral = () => {
    setActiveChannelKey(GENERAL_CHANNEL_KEY);
    setActiveDmUser(null);
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAttachmentChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }
    setAttachment(file);
  };

  // Typing: send "chat:typing" with throttle
  const handleEditorChange = (value) => {
    setEditorHtml(value);
    const now = Date.now();
    if (
      connected &&
      activeChannelKey &&
      now - lastTypingSentRef.current > 1000
    ) {
      sendTyping(activeChannelKey);
      lastTypingSentRef.current = now;
    }
  };

  const statusLabel = connected
    ? "Connected"
    : joining
    ? "Connecting..."
    : "Offline";

  const statusDotClass = connected ? "bg-green-500" : "bg-red-500";

  const dmPresence =
    activeDmUser && presenceMap[activeDmUser.id]
      ? presenceMap[activeDmUser.id].status
      : "unknown";

  const dmPresenceClass = presenceColor(dmPresence);
  const dmPresenceText = presenceLabel(dmPresence);

  // Typing usernames for active channel
  const typingUsersForActive = typingByChannel[activeChannelKey] || {};
  const typingUsernames = Object.values(typingUsersForActive)
    .filter((entry) => {
      if (!entry || !entry.at) return false;
      const diff = Date.now() - new Date(entry.at).getTime();
      return diff < 4000;
    })
    .map((entry) => entry.username)
    .filter((name) => name && name !== user.username);

  // helper: readers for a given message
  const getReadersForMessage = (createdAt) => {
    const channelReads = readReceiptsByChannel[activeChannelKey] || {};
    const msgTime = createdAt ? new Date(createdAt).getTime() : 0;

    return users.filter((u) => {
      if (String(u.id) === String(user.id)) return false;
      const info = channelReads[u.id];
      if (!info || !info.at) return false;
      const readTime = new Date(info.at).getTime();
      return readTime >= msgTime;
    });
  };

  // Send our read receipt whenever we see latest message
  useEffect(() => {
    if (!connected) return;
    if (!activeMessages.length) return;
    const last = activeMessages[activeMessages.length - 1];
    const at = last.createdAt || new Date().toISOString();
    if (!activeChannelKey) return;
    sendReadReceipt(activeChannelKey, at);
  }, [connected, activeChannelKey, activeMessages]);

  // Huddle start/end handler (GLOBAL)
  const handleToggleHuddle = () => {
    if (!connected) return;

    // If there is an active huddle (in ANY channel)
    if (activeHuddle) {
      // If I own it, end for everyone on the original channel
      if (isHuddleOwner) {
        endHuddle(activeHuddle.channelId, activeHuddle.huddleId);
      }
      // Leave locally
      leaveHuddle();
      setActiveHuddle(null);
      setIsHuddleFullscreen(false);
      return;
    }

    // No huddle yet -> start one in the CURRENT channel and auto-join
    const huddleId = createUniqueId("huddle");
    startHuddle(activeChannelKey, huddleId);
    setActiveHuddle({
      channelId: activeChannelKey,
      huddleId,
      startedBy: { userId: user.id, username: user.username },
      at: new Date().toISOString(),
    });
    // creator joins immediately
    joinHuddle();
  };

  // Toggle reaction for a message
  const handleToggleReaction = (messageId, emoji) => {
    if (!activeChannelKey) return;

    const currentMessages = messagesByChannel[activeChannelKey] || [];
    const msg = currentMessages.find((m) => m.id === messageId);
    const currentReactions = msg?.reactions || {};
    const existing = currentReactions[emoji];
    const existingUserIds = existing?.userIds || [];
    const hasReacted = existingUserIds.includes(user.id);
    const action = hasReacted ? "remove" : "add";

    // optimistic local update
    setMessagesByChannel((prev) => {
      const channelMessages = prev[activeChannelKey] || [];
      const nextChannelMessages = channelMessages.map((m) => {
        if (m.id !== messageId) return m;
        const current = m.reactions || {};
        const r = current[emoji] || { count: 0, userIds: [] };
        const userIdsSet = new Set(r.userIds || []);
        if (action === "add") {
          userIdsSet.add(user.id);
        } else {
          userIdsSet.delete(user.id);
        }
        const newUserIds = Array.from(userIdsSet);
        const newReactions = { ...current };
        if (newUserIds.length === 0) {
          delete newReactions[emoji];
        } else {
          newReactions[emoji] = {
            count: newUserIds.length,
            userIds: newUserIds,
          };
        }
        return { ...m, reactions: newReactions };
      });
      return {
        ...prev,
        [activeChannelKey]: nextChannelMessages,
      };
    });

    // notify server
    sendReaction({
      channelId: activeChannelKey,
      messageId,
      emoji,
      action,
    });
  };

  const handleOpenReactionPicker = (messageId) => {
    setOpenReactionFor((prev) => (prev === messageId ? null : messageId));
  };

  const handleAddReactionFromPicker = (messageId, emoji) => {
    handleToggleReaction(messageId, emoji);
    setOpenReactionFor(null);
  };

  const handleStartEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditingOriginalChannel(activeChannelKey);
    setEditorHtml(message.textHtml || message.text || "");
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingOriginalChannel(null);
    setEditorHtml("");
  };

  const handleDeleteMessage = (messageId) => {
    if (!connected) return;
    if (!window.confirm("Delete this message for everyone?")) return;

    const channelId = activeChannelKey;

    setMessagesByChannel((prev) => {
      const channelMessages = prev[channelId] || [];
      const next = channelMessages.map((m) =>
        m.id === messageId
          ? { ...m, deletedAt: new Date().toISOString() }
          : m
      );
      return { ...prev, [channelId]: next };
    });

    const socket = getSocket();
    if (socket) {
      socket.emit("chat:delete", { channelId, messageId });
    }

    if (editingMessageId === messageId) {
      handleCancelEdit();
    }
  };

  // Header huddle button label
  let huddleButtonLabel = "Start huddle";
  if (isHuddleActiveHere) {
    if (huddleJoined || huddleConnecting) {
      huddleButtonLabel = isHuddleOwner ? "End huddle" : "Leave huddle";
    } else {
      huddleButtonLabel = "Join huddle";
    }
  } else if (activeHuddle) {
    // huddle active in another channel
    huddleButtonLabel = "Huddle in another channel";
  }

  // ----- DRAG HANDLERS FOR HUDDLE PANEL -----
  const handleHuddleMouseDown = (e) => {
    if (isHuddleFullscreen) return; // no dragging in fullscreen
    e.preventDefault();
    huddleLastMousePosRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
    setHuddleDrag((prev) => ({ ...prev, dragging: true }));
  };

  useEffect(() => {
    if (!huddleDrag.dragging) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      const { x: lastX, y: lastY } = huddleLastMousePosRef.current;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      huddleLastMousePosRef.current = { x: e.clientX, y: e.clientY };

      setHuddleDrag((prev) => ({
        ...prev,
        x: prev.x + dx,
        y: prev.y + dy,
      }));
    };

    const handleMouseUp = () => {
      setHuddleDrag((prev) => ({ ...prev, dragging: false }));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [huddleDrag.dragging]);

  // ----- FULLSCREEN HANDLERS -----
  const handleEnterHuddleFullscreen = () => {
    setIsHuddleFullscreen(true);
    const el = huddlePanelRef.current;
    if (el && el.requestFullscreen) {
      try {
        el.requestFullscreen();
      } catch {
        // ignore
      }
    }
  };

  const handleExitHuddleFullscreen = () => {
    setIsHuddleFullscreen(false);
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="h-[calc(100vh-80px)] flex gap-4">
      {/* LEFT: channels + DMs */}
      <aside className="w-64 bg-white rounded-xl shadow p-3 flex flex-col text-xs">
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">
            Channels
          </div>
          <button
            type="button"
            onClick={handleSelectGeneral}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs ${
              isGeneralChannel
                ? "bg-blue-50 text-blue-700"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-base">#</span>
              <span>team-general</span>
            </span>

            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
              <span className={`w-2 h-2 rounded-full ${statusDotClass}`} />
              {statusLabel}
            </span>
          </button>
        </div>

        {/* DMs with proper scroll / no shifting */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="text-[11px] font-semibold text-slate-500 mb-1">
            Direct messages
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto pr-1 pb-6">
            {loadingUsers ? (
              <div className="text-[11px] text-slate-400">
                Loading teammates...
              </div>
            ) : sortedTeammates.length === 0 ? (
              <div className="text-[11px] text-slate-400">
                No teammates found.
              </div>
            ) : (
              sortedTeammates.map((u) => {
                const presence = presenceMap[u.id]?.status || "offline";
                const color = presenceColor(presence);
                const label = presenceLabel(presence);
                const key = dmKeyFor(user.id, u.id);
                const isActive = activeChannelKey === key;

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectDm(u)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[11px] font-semibold">
                        {u.username?.[0]?.toUpperCase() || "?"}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium truncate">
                          {u.username}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {label}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`w-2 h-2 rounded-full ${color}`}
                    ></span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Header */}
        <section className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{activeChannelTitle}</h1>
            <p className="text-xs text-slate-500">
              {isThreadChannel
                ? "Threaded conversation for a specific message."
                : isGeneralChannel
                ? "Team-wide real-time chat. Everyone sees the same messages."
                : "Private 1:1 conversation between you and your teammate."}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {!isGeneralChannel && activeDmUser && (
              <div className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full ${dmPresenceClass}`}
                ></span>
                <span className="text-slate-600">{dmPresenceText}</span>
              </div>
            )}

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in channel..."
              className="text-xs border rounded-full px-2 py-[2px] w-40 focus:outline-none焦 focus:ring-1 focus:ring-blue-400"
            />

            <button
              type="button"
              onClick={handleToggleHuddle}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-[4px] text-[11px] hover:bg-slate-50"
            >
              <span>🔊</span>
              <span>{huddleButtonLabel}</span>
            </button>

            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px]">
              <span
                className={`w-2 h-2 rounded-full ${statusDotClass}`}
              ></span>
              <span className="text-[11px]">{statusLabel}</span>
            </span>

            <span className="text-slate-500 text-[11px]">
              You are signed in as{" "}
              <span className="font-semibold">{user.username}</span>
            </span>
          </div>
        </section>

        {/* CHAT BODY */}
        <section className="bg-white rounded-xl shadow p-4 flex-1 flex flex-col min-h-0">
          {/* Huddle Banner (only in the channel where huddle started) */}
          {isHuddleActiveHere && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] flex items-center justify-between">
              <div className="flex flex-col">
                <span>
                  🔊 Huddle in progress{" "}
                  <span className="font-semibold">
                    (started by {activeHuddle.startedBy?.username})
                  </span>
                </span>
                {huddleError && (
                  <span className="text-[10px] text-red-600 mt-1">
                    {huddleError}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {huddleConnecting && (
                  <span className="text-[10px] text-slate-500">
                    Joining...
                  </span>
                )}
                {!huddleJoined && !huddleConnecting && (
                  <button
                    type="button"
                    onClick={joinHuddle}
                    className="text-[10px] border border-amber-300 rounded px-2 py-1 hover:bg-amber-100"
                  >
                    Join huddle
                  </button>
                )}
                {huddleJoined && (
                  <span className="text-[10px] text-amber-700">
                    You&apos;re in this huddle
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Editing indicator */}
          {editingMessageId && (
            <div className="mb-2 text-[10px] text-amber-600 flex items-center gap-2">
              <span>Editing a message...</span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="underline hover:no-underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* MESSAGES LIST */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto border border-slate-100 bg-slate-50 rounded-lg p-3 space-y-2 text-xs"
          >
            {loadingHistory && activeMessages.length === 0 ? (
              <div className="text-[11px] text-slate-400">
                Loading conversation...
              </div>
            ) : messagesToRender.length === 0 ? (
              <div className="text-[11px] text-slate-400">
                No messages yet. Say hi 👋
              </div>
            ) : (
              messagesToRender.map((m) => {
                const isSystem = m.system;
                const isOwn =
                  !m.system &&
                  String(m.userId || m.user_id) === String(user.id);
                const time = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString()
                  : "";

                if (isSystem) {
                  return (
                    <div
                      key={m.id}
                      className="w-full text-center text-[10px] text-slate-500 my-1"
                    >
                      — {m.textHtml || m.text} —{" "}
                    </div>
                  );
                }

                const isLastOwn = isOwn && m.id === lastMessageId;
                const readers = isLastOwn
                  ? getReadersForMessage(m.createdAt)
                  : [];

                const reactions = m.reactions || {};
                const reactionEntries = Object.entries(reactions);

                return (
                  <div
                    key={m.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                        isOwn
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold">
                          {isOwn ? "You" : m.username || "User"}
                        </span>
                        <span
                          className={`text-[9px] ${
                            isOwn ? "text-blue-100" : "text-slate-400"
                          }`}
                        >
                          {time}
                        </span>
                      </div>

                      {/* Deleted state */}
                      {m.deletedAt ? (
                        <div className="text-[10px] italic text-slate-300">
                          This message was deleted.
                        </div>
                      ) : (
                        <>
                          {/* Message Text */}
                          <div
                            className="text-[11px] whitespace-pre-wrap break-words prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: m.textHtml || m.text || "",
                            }}
                          />

                          {/* Reactions */}
                          {reactionEntries.length > 0 && (
                            <div
                              className={`mt-1 flex flex-wrap gap-1 ${
                                isOwn ? "justify-end" : "justify-start"
                              }`}
                            >
                              {reactionEntries.map(([emoji, info]) => {
                                const userIds = info.userIds || [];
                                const count =
                                  typeof info.count === "number"
                                    ? info.count
                                    : userIds.length;
                                const hasReacted = userIds.includes(user.id);

                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() =>
                                      handleToggleReaction(m.id, emoji)
                                    }
                                    className={`px-2 py-[2px] rounded-full text-[10px] border flex items-center gap-1 ${
                                      hasReacted
                                        ? isOwn
                                          ? "bg-blue-500 border-blue-300 text-white"
                                          : "bg-blue-50 border-blue-300 text-blue-700"
                                        : isOwn
                                        ? "bg-blue-700 border-blue-500 text-blue-50"
                                        : "bg-slate-100 border-slate-300 text-slate-700"
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Add Reaction */}
                          <div
                            className={`mt-1 flex ${
                              isOwn ? "justify-end" : "justify-start"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenReactionPicker(m.id)}
                              className={`text-[10px] px-2 py-[2px] rounded-full border ${
                                isOwn
                                  ? "border-blue-500 text-blue-100 hover:bg-blue-500/40"
                                  : "border-slate-300 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              ➕ Add reaction
                            </button>
                          </div>

                          {/* Mini Reaction Picker */}
                          {openReactionFor === m.id && (
                            <div
                              className={`mt-1 inline-flex flex-wrap gap-1 px-2 py-1 rounded-full ${
                                isOwn ? "bg-blue-700/40" : "bg-slate-100"
                              }`}
                            >
                              {QUICK_REACTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    handleAddReactionFromPicker(m.id, emoji)
                                  }
                                  className="text-[12px] px-1"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Edit / Delete for own messages */}
                          {isOwn && (
                            <div
                              className={`mt-1 flex ${
                                isOwn ? "justify-end" : "justify-start"
                              } gap-2 text-[10px] opacity-80`}
                            >
                              <button
                                type="button"
                                onClick={() => handleStartEditMessage(m)}
                                className="underline hover:no-underline"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="underline hover:no-underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {/* READ RECEIPTS */}
                      {isLastOwn && !m.deletedAt && (
                        <div className="mt-1 text-[9px] text-blue-100">
                          {readers.length === 0
                            ? "Delivered"
                            : `Seen by ${readers
                                .map((r) => r.username)
                                .join(", ")}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Attachment preview */}
          {attachment && (
            <div className="mt-2 text-[11px] text-slate-600">
              Attachment selected:{" "}
              <span className="font-medium">{attachment.name}</span>{" "}
              <span className="text-slate-400">
                (sending files can be wired later)
              </span>
            </div>
          )}

          {/* Typing Indicator */}
          {typingUsernames.length > 0 && (
            <div className="mt-1 text-[10px] text-slate-500">
              {typingUsernames.length === 1
                ? `${typingUsernames[0]} is typing...`
                : `${typingUsernames.join(", ")} are typing...`}
            </div>
          )}

          {/* COMPOSER */}
          <form
            onSubmit={handleSend}
            className="mt-3 flex items-end gap-2 text-xs"
          >
            <div className="flex-1 border border-slate-300 rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={editorHtml}
                onChange={handleEditorChange}
                modules={quillModules}
                formats={quillFormats}
                placeholder={
                  connected
                    ? "Write a message... (Ctrl+Enter to send)"
                    : "Connect to chat..."
                }
                className="text-xs"
              />
            </div>

            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleAttachmentClick}
                className="text-[11px] border border-slate-300 rounded px-2 py-1 bg-white hover:bg-slate-50"
              >
                📎 Attach
              </button>

              <button
                type="submit"
                disabled={!connected || !editorHtml.trim() || sending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending
                  ? "Sending..."
                  : editingMessageId
                  ? "Save"
                  : "Send"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleAttachmentChange}
            />
          </form>
        </section>
      </div>

      {/* FLOATING, DRAGGABLE HUDDLE PANEL (GLOBAL, BIGGER + FULLSCREEN) */}
      {activeHuddle && huddleJoined && (
        <div
          ref={huddlePanelRef}
          className={`fixed bg-slate-900 text-slate-100 shadow-2xl border border-slate-700 z-30 flex flex-col ${
            isHuddleFullscreen
              ? "inset-0 m-0 w-screen h-screen rounded-none"
              : "bottom-6 right-6 w-[480px] max-w-[90vw] h-[320px] rounded-2xl"
          }`}
          style={{
            transform: isHuddleFullscreen
              ? undefined
              : `translate(${huddleDrag.x}px, ${huddleDrag.y}px)`,
            cursor:
              huddleDrag.dragging && !isHuddleFullscreen
                ? "grabbing"
                : "default",
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-2 border-b border-slate-800 select-none"
            onMouseDown={handleHuddleMouseDown}
          >
            <div className="flex flex-col">
              <span className="text-xs font-semibold">
                Huddle in{" "}
                {activeHuddle.channelId === "general"
                  ? "#team-general"
                  : activeChannelTitle}
              </span>
              <span className="text-[10px] text-slate-400">
                {isHuddleOwner
                  ? "You started this huddle"
                  : "You’re in this huddle"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Fullscreen toggle button */}
              {!isHuddleFullscreen ? (
                <button
                  type="button"
                  onClick={handleEnterHuddleFullscreen}
                  className="text-[10px] px-2 py-[3px] rounded-full bg-slate-800 hover:bg-slate-700"
                  title="Go fullscreen"
                >
                  ⛶
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleExitHuddleFullscreen}
                  className="text-[10px] px-2 py-[3px] rounded-full bg-slate-800 hover:bg-slate-700"
                  title="Exit fullscreen"
                >
                  ⤢
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleHuddle}
                className="text-[10px] px-2 py-[3px] rounded-full bg-slate-800 hover:bg-slate-700"
              >
                {isHuddleOwner ? "Leave & end" : "Leave"}
              </button>
            </div>
          </div>

          <div
            className={`p-3 grid gap-2 flex-1 ${
              remotePeers.length > 0 ? "grid-cols-2" : "grid-cols-1"
            }`}
          >
            {/* Remote peers */}
            {remotePeers.map((p) => (
              <HuddleVideoTile
                key={p.userId}
                stream={p.stream}
                label={p.username}
                isYou={false}
                muted={false}
              />
            ))}

            {/* Your tile */}
            <HuddleVideoTile
              stream={localStream}
              label={user.username}
              isYou
              muted
            />
          </div>

          <div className="px-4 pt-1 pb-3 flex items-center justify-center gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={toggleMute}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                isMuted ? "bg-red-600" : "bg-slate-700"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? "🔇" : "🎙️"}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                isCameraOff ? "bg-red-600" : "bg-slate-700"
              }`}
              title={isCameraOff ? "Turn camera on" : "Turn camera off"}
            >
              {isCameraOff ? "📷" : "🎥"}
            </button>
            <button
              type="button"
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                isScreenSharing ? "bg-blue-600" : "bg-slate-700"
              }`}
              title={
                isScreenSharing ? "Stop screen share" : "Start screen share"
              }
            >
              🖥️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
