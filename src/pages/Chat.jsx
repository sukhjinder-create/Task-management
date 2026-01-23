// src/pages/Chat.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  generateUserKeyPair,
  encryptForRecipients,
  decryptEnvelopeIfNeeded,
} from "../crypto/chatCrypto";
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
import { useHuddle } from "../context/HuddleContext";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import CreateChannelModal from "../components/CreateChannelModal";
import ChannelSettingsModal from "../components/ChannelSettingsModal";

// ----- CONFIG -----
const GENERAL_CHANNEL_KEY = "team-general";
const AVAILABILITY_CHANNEL_KEY = "availability-updates";
const PROJECT_MANAGER_CHANNEL_KEY = "project-manager";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

const quillModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
  ],
};
const quillFormats = ["bold", "italic", "underline", "list", "bullet", "link"];

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function createUniqueId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

/* -------------------------
   Simple emoji shortcode map
   - non-exhaustive, safe, extendable
---------------------------- */
const EMOJI_MAP = {
  smile: "😄",
  grin: "😁",
  thumbsup: "👍",
  "+1": "👍",
  heart: "❤️",
  tada: "🎉",
  laugh: "😂",
  joy: "😂",
  open_mouth: "😮",
  cry: "😢",
  wave: "👋",
  check: "✅",
  clock1: "🕐",
  pause_button: "⏸️",
  plate_with_cutlery: "🍽️",
};

/**
 * Convert colon shortcodes like :smile: into unicode emoji.
 * Leaves unknown shortcodes untouched.
 * Works on plain text or HTML (it just replaces textual tokens).
 */
function convertEmojiShortcodes(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/:([a-z0-9_+\-]+):/gi, (match, name) => {
    const key = name.toLowerCase();
    if (EMOJI_MAP[key]) return EMOJI_MAP[key];
    return match; // leave as-is if unknown
  });
}

/**
 * Apply emoji conversion to message object fields that will be displayed.
 * Non-destructive.
 */
function applyEmojiToMessage(msg) {
  if (!msg) return msg;
  const copy = { ...msg };
  if (copy.textHtml) copy.textHtml = convertEmojiShortcodes(copy.textHtml);
  if (copy.text) copy.text = convertEmojiShortcodes(copy.text);
  if (copy.fallbackText) copy.fallbackText = convertEmojiShortcodes(copy.fallbackText);
  return copy;
}

export default function Chat() {
  const { auth } = useAuth();
  const api = useApi();
  const user = auth.user;

  const huddleCtx = useHuddle();
  const activeHuddle = huddleCtx?.activeHuddle;
  const setActiveHuddle = huddleCtx?.setActiveHuddle;
  const setChannelForHuddle = huddleCtx?.setChannelForHuddle;
  const rtc = huddleCtx?.rtc;

  const {
    joined: huddleJoined = false,
    connecting: huddleConnecting = false,
    error: huddleError = "",
  } = rtc || {};

  // ----- STATE -----
  const [connected, setConnected] = useState(false);
  const [joining, setJoining] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userKeysById, setUserKeysById] = useState({});

  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [activeChannelKey, setActiveChannelKey] = useState(() => {
    if (typeof window === "undefined") return GENERAL_CHANNEL_KEY;
    try {
      return localStorage.getItem("chat.activeChannel") || GENERAL_CHANNEL_KEY;
    } catch {
      return GENERAL_CHANNEL_KEY;
    }
  });
  const [activeDmUser, setActiveDmUser] = useState(null);

  // THREAD SIDEBAR
  const [threadParents, setThreadParents] = useState({});
  const [activeThreadKey, setActiveThreadKey] = useState(null);
  const [threadRootMessage, setThreadRootMessage] = useState(null);
  const [threadEditorHtml, setThreadEditorHtml] = useState("");

  // channels list + modals
  const [channels, setChannels] = useState([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);
  const [settingsChannel, setSettingsChannel] = useState(null);

  // presence map: userId -> { status, at }
  const [presenceMap, setPresenceMap] = useState({});

  // Rich editor content (main channel)
  const [editorHtml, setEditorHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);

  // Typing indicators: channelId -> { userId -> { username, at } }
  const [typingByChannel, setTypingByChannel] = useState({});

  // Read receipts: channelId -> { userId -> { at } }
  const [readReceiptsByChannel, setReadReceiptsByChannel] = useState({});

  const [, setTick] = useState(0);

  const listRef = useRef(null);
  const activeChannelRef = useRef(null);

  const fileInputRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  const [openReactionFor, setOpenReactionFor] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingOriginalChannel, setEditingOriginalChannel] = useState(null);

  // -----------------------
  // Superadmin / single-workspace mode
  // Backwards-compatible: keep workspace variables but operate in single-workspace / superadmin mode.
  // We no longer present a workspace selector in the UI; instead we load channels and users globally
  // like a superadmin would. This mirrors the previous Chat.jsx behavior.
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(() => {
    try {
      return localStorage.getItem("chat.workspaceId") || null;
    } catch {
      return null;
    }
  });
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  // Load users (superadmin/global)
  async function loadUsers() {
    try {
      setLoadingUsers(true);
      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load users for chat:", err);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Load channels (global)
  async function loadChannels() {
    try {
      const res = await api.get("/chat/channels");
      setChannels(res.data || []);
    } catch (err) {
      console.error("Failed to load channels:", err);
    }
  }

  // Initial load: channels & users & keys (superadmin/global)
  useEffect(() => {
    // keep loading workspaces for compatibility but we don't show selector
    loadChannels();
    loadUsers();
  }, []);

  // persist active channel key so refresh keeps you in same channel / DM
  useEffect(() => {
    if (!activeChannelKey) return;
    try {
      localStorage.setItem("chat.activeChannel", activeChannelKey);
    } catch {
      // ignore storage errors
    }
  }, [activeChannelKey]);

  // ----- DERIVED -----
  const activeMessages = messagesByChannel[activeChannelKey] || [];

  const teammates = useMemo(
    () => users.filter((u) => u.id !== user.id),
    [users, user.id]
  );

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

  // Combine users info with their public keys (if any)
  const usersWithKeys = useMemo(
    () =>
      users.map((u) => {
        const raw = userKeysById[u.id];
        if (!raw) return u;

        let publicKeyJwk = raw;

        // If backend gave us a JSON string, parse it once here
        if (typeof raw === "string") {
          try {
            publicKeyJwk = JSON.parse(raw);
          } catch (err) {
            console.error("Failed to parse publicKey for user", u.id, err, raw);
            return u; // skip key if broken
          }
        }

        return {
          ...u,
          publicKeyJwk,
        };
      }),
    [users, userKeysById]
  );

  // 🔐 helper: normalize + decrypt incoming message text (channels + DMs)
  const decryptForDisplay = async (rawText, rawMessage, channelId) => {
    try {
      const baseText = rawText || "";

      const decrypted = await decryptEnvelopeIfNeeded(
        baseText,
        { ...rawMessage, channelId },
        user.id,
        usersWithKeys
      );

      // Apply emoji conversion right after decrypt (so UI shows emoji)
      const withEmoji = convertEmojiShortcodes(decrypted || baseText || "");
      return withEmoji;
    } catch (err) {
      console.warn("[E2E] decryptForDisplay failed, using rawText:", err);
      return convertEmojiShortcodes(rawText || "");
    }
  };

  const isGeneralChannel = activeChannelKey === GENERAL_CHANNEL_KEY;
  const isDmChannel = activeChannelKey?.startsWith("dm:");
useEffect(() => {
  if (!activeChannelKey) return;

  // 🔹 Handle DM channel restoration on refresh
  if (activeChannelKey.startsWith("dm:")) {
    const parts = activeChannelKey.split(":");
    if (parts.length !== 3) return;

    const [, userA, userB] = parts;
    const otherUserId =
      String(userA) === String(user.id) ? userB : userA;

    const otherUser = users.find(
      (u) => String(u.id) === String(otherUserId)
    );

    if (otherUser) {
      setActiveDmUser(otherUser);
    }
  } else {
    // 🔹 Not a DM → clear DM state
    setActiveDmUser(null);
  }
}, [activeChannelKey, users, user.id]);

  const activeChannel = useMemo(
    () => channels.find((ch) => ch.key === activeChannelKey) || null,
    [channels, activeChannelKey]
  );

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

  const isHuddleActiveHere =
    activeHuddle && activeHuddle.channelId === activeChannelKey;

  const isHuddleOwner =
    activeHuddle &&
    String(activeHuddle.startedBy?.userId) === String(user.id);

  const activeChannelTitle =
    isDmChannel && activeDmUser
      ? `Direct Message with ${activeDmUser.username}`
      : isGeneralChannel
      ? "Team Chat"
      : activeChannel?.name || activeChannelKey;

  const publicChannels = useMemo(
    () =>
      (channels || []).filter((ch) => {
        if (!ch) return false;
        const key = ch.key || "";
        const isPrivate = ch.is_private ?? ch.isPrivate ?? false;
        return (
          !isPrivate &&
          key &&
          key !== GENERAL_CHANNEL_KEY &&
          key !== AVAILABILITY_CHANNEL_KEY &&
          key !== PROJECT_MANAGER_CHANNEL_KEY &&
          !key.startsWith("dm:") &&
          !key.startsWith("thread:")
        );
      }),
    [channels]
  );

  const privateChannels = useMemo(
    () =>
      (channels || []).filter((ch) => {
        if (!ch) return false;
        const key = ch.key || "";
        const isPrivate = ch.is_private ?? ch.isPrivate ?? false;
        return (
          isPrivate &&
          key &&
          key !== GENERAL_CHANNEL_KEY &&
          !key.startsWith("dm:") &&
          !key.startsWith("thread:")
        );
      }),
    [channels]
  );

  // thread derived
  const threadMessages = activeThreadKey
    ? messagesByChannel[activeThreadKey] || []
    : [];

  const threadParentChannelKey =
    activeThreadKey && threadParents[activeThreadKey]
      ? threadParents[activeThreadKey]
      : null;

  const threadParentChannel =
    threadParentChannelKey &&
    channels.find((ch) => ch.key === threadParentChannelKey);

  // 🔐 Figure out which user IDs should be able to read a given channel's messages
  const getRecipientIdsForChannelKey = (channelKey) => {
    // Only users that have a public key are valid recipients for E2E
    const usersWithPub = usersWithKeys.filter((u) => !!u.publicKeyJwk);
    const idsWithPub = new Set(usersWithPub.map((u) => String(u.id)));

    const ensureSelfIncludedWithKeys = (ids) => {
      const set = new Set(ids.map((id) => String(id)));
      set.add(String(user.id)); // always include self
      // final list: only those who actually have a public key
      return Array.from(set).filter((id) => idsWithPub.has(id));
    };

    // DM: channelKey is like "dm:userA:userB"
    if (channelKey && channelKey.startsWith("dm:")) {
      const parts = channelKey.split(":").slice(1); // [userA, userB]
      return ensureSelfIncludedWithKeys(parts);
    }

    // General "team" channel => everyone with a key
    if (channelKey === GENERAL_CHANNEL_KEY) {
      return ensureSelfIncludedWithKeys(usersWithPub.map((u) => u.id));
    }

    // Other channels: use explicit members if available
    const ch = channels.find((c) => c.key === channelKey);
    if (ch && Array.isArray(ch.members) && ch.members.length > 0) {
      const memberIds = ch.members.map((m) => m.user_id || m.id);
      return ensureSelfIncludedWithKeys(memberIds);
    }

    // Fallback: all users who have keys
    return ensureSelfIncludedWithKeys(usersWithPub.map((u) => u.id));
  };

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [activeMessages]);

  // Load user public keys for E2E crypto
  useEffect(() => {
    let cancelled = false;

    async function loadUserKeys() {
      try {
        const res = await api.get("/crypto/public-keys");
        if (cancelled) return;

        const map = {};
        (res.data || []).forEach((row) => {
          if (row.publicKey) {
            map[row.userId] = row.publicKey;
          }
        });

        setUserKeysById(map);
        console.log("[E2E] Loaded public keys for users:", Object.keys(map));
      } catch (err) {
        console.error("Failed to load user public keys:", err);
      }
    }

    loadUserKeys();

    return () => {
      cancelled = true;
    };
  }, [api]);

  // 🔐 Ensure we have a keypair AND that our public key is uploaded to backend
  useEffect(() => {
    let cancelled = false;

    async function ensureKeys() {
      try {
        let publicKeyJwk;
        let privateKeyJwk;

        const stored = localStorage.getItem("chatKeyPair");

        if (stored) {
          // we already have a keypair locally → just reuse it
          const parsed = JSON.parse(stored);
          publicKeyJwk = parsed.publicKeyJwk;
          privateKeyJwk = parsed.privateKeyJwk;
        } else {
          // generate a brand-new keypair
          const generated = await generateUserKeyPair();
          if (cancelled) return;

          publicKeyJwk = generated.publicKeyJwk;
          privateKeyJwk = generated.privateKeyJwk;

          localStorage.setItem(
            "chatKeyPair",
            JSON.stringify({ publicKeyJwk, privateKeyJwk })
          );
        }

        if (cancelled) return;

        // ✅ ALWAYS upload the public key (idempotent because backend upserts)
        await api.post("/crypto/public-key", {
          publicKey: publicKeyJwk,
        });

        console.log("[E2E] Public key uploaded for user", user.id);
      } catch (err) {
        console.error("Failed to ensure E2E key pair:", err);
      }
    }

    if (auth?.token && user?.id) {
      ensureKeys();
    }

    return () => {
      cancelled = true;
    };
  }, [api, auth?.token, user?.id]);

  // ----- SOCKET SETUP -----
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

    const handleHistory = async (payload) => {
  if (!payload || !payload.channelId) return;
  const channelId = payload.channelId;
  const rawMessages = payload.messages || [];
  console.log("[chat:history] payload", payload);

  const history = await Promise.all(
    rawMessages.map(async (m) => {
      const base = {
        id: m.id || createUniqueId("msg"),
        channelId,
        textHtml: m.textHtml || m.text_html || m.text || "",
        userId: m.userId || m.user_id,
        username: m.username,
        createdAt: m.createdAt || m.created_at,
        updatedAt: m.updatedAt || m.updated_at,
        deletedAt: m.deletedAt || m.deleted_at,
        parentId: m.parentId || m.parent_id || null,
        reactions: m.reactions || {},
        attachments: m.attachments || [],
        encrypted: m.encrypted,
        senderPublicKeyJwk:
          m.senderPublicKeyJwk || m.sender_public_key,
        fallbackText: m.fallbackText || m.fallback_text,
      };

      const decryptedText = await decryptForDisplay(
        base.textHtml,
        m,
        channelId
      );

      // ✅ FIX 3: detect attendance/system messages safely
      const isSystem =
  m.system === true ||
  m.username === "System" ||
  channelId === AVAILABILITY_CHANNEL_KEY;

      const result = {
        ...base,
        system: isSystem,
        textHtml: decryptedText,
      };

      return applyEmojiToMessage(result);
    })
  );

  // ✅ FIX 1: merge history instead of replacing
  setMessagesByChannel((prev) => {
    const existing = prev[channelId] || [];

    const map = new Map();
    [...existing, ...history].forEach((m) => {
      map.set(m.id, m);
    });

    return {
      ...prev,
      [channelId]: Array.from(map.values()).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      ),
    };
  });

  setLoadingHistory(false);
};

   const handleChatMessage = async (msg) => {
  if (!msg) return;

  // 🔥 Normalize channel id (AI / legacy / normal messages)
  const channelId = msg.channelId || msg.channelKey || msg.channel;
  if (!channelId) return;

  const decryptedText = await decryptForDisplay(
    msg.textHtml || msg.text_html || msg.text || "",
    msg,
    channelId
  );

  // 🔥 Detect system / attendance messages safely
  const isSystem =
    msg.system === true ||
    msg.username === "System" ||
    channelId === AVAILABILITY_CHANNEL_KEY;

  const normalized = {
    id: msg.id || msg.tempId || createUniqueId("msg"),
    channelId,
    system: isSystem,
    textHtml: decryptedText,
    userId: msg.userId || msg.user_id,
    username: msg.username,
    createdAt: msg.createdAt || msg.created_at,
    updatedAt: msg.updatedAt || msg.updated_at,
    deletedAt: msg.deletedAt || msg.deleted_at,
    parentId: msg.parentId || msg.parent_id || null,
    reactions: msg.reactions || {},
    attachments: msg.attachments || [],
  };

  const normalizedWithEmoji = applyEmojiToMessage(normalized);

  setMessagesByChannel((prev) => {
    const existing = prev[channelId] || [];
    const next = [...existing];

    // 🔁 tempId replacement
    if (msg.tempId) {
      const idxTemp = next.findIndex((m) => m.id === msg.tempId);
      if (idxTemp !== -1) {
        next[idxTemp] = {
          ...next[idxTemp],
          ...normalizedWithEmoji,
        };
        return { ...prev, [channelId]: next };
      }
    }

    // 🔁 id replacement
    if (msg.id) {
      const idx = next.findIndex((m) => m.id === msg.id);
      if (idx !== -1) {
        next[idx] = { ...next[idx], ...normalizedWithEmoji };
        return { ...prev, [channelId]: next };
      }
    }

    // 🛑 FINAL SAFETY DEDUPE (socket echo of own optimistic message)
const isDuplicate = next.some((m) => {
  if (!m || m.system) return false;

  const sameUser =
    String(m.userId) === String(normalizedWithEmoji.userId);

  const sameText =
    (m.textHtml || "").trim() ===
    (normalizedWithEmoji.textHtml || "").trim();

  const timeDiff =
    Math.abs(
      new Date(m.createdAt || 0).getTime() -
      new Date(normalizedWithEmoji.createdAt || 0).getTime()
    ) < 2000; // 2s window

  return sameUser && sameText && timeDiff;
});

if (isDuplicate) {
  return prev;
}

    // ➕ otherwise push
    next.push(normalizedWithEmoji);
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
            textHtml: convertEmojiShortcodes(txt),
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

    const handleHuddleStarted = (payload) => {
      if (!payload || !payload.channelId || !payload.huddleId) return;
      if (!setActiveHuddle) return;

      setActiveHuddle({
        channelId: payload.channelId,
        huddleId: payload.huddleId,
        startedBy: payload.startedBy,
        at: payload.at,
      });
    };

    const handleHuddleEnded = (payload) => {
      if (!payload || !payload.channelId || !payload.huddleId) return;
      if (!setActiveHuddle) return;

      setActiveHuddle((prev) => {
        if (
          prev &&
          prev.channelId === payload.channelId &&
          prev.huddleId === payload.huddleId
        ) {
          if (rtc) rtc.leaveHuddle?.();
          return null;
        }
        return prev;
      });
    };

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

    const handleMessageEdited = async (payload = {}) => {
      const {
        channelId,
        id,
        messageId,
        textHtml: incomingTextHtml,
        text: incomingText,
        updatedAt,
        updated_at,
      } = payload;
      const msgId = id || messageId;
      if (!channelId || !msgId) return;

      try {
        const rawText = incomingTextHtml ?? incomingText ?? null;

        if (!rawText) {
          setMessagesByChannel((prev) => {
            const channelMessages = prev[channelId] || [];
            const next = channelMessages.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    updatedAt: updatedAt || updated_at || m.updatedAt,
                  }
                : m
            );
            return { ...prev, [channelId]: next };
          });
          return;
        }

        let displayText = rawText;
        try {
          displayText = await decryptForDisplay(rawText, payload, channelId);
          displayText = String(displayText || "");
        } catch (err) {
          console.warn("decryptForDisplay failed for edited message:", err);
          displayText = convertEmojiShortcodes(String(rawText));
        }

        setMessagesByChannel((prev) => {
          const channelMessages = prev[channelId] || [];
          const next = channelMessages.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  textHtml: displayText,
                  updatedAt: updatedAt || updated_at || m.updatedAt,
                }
              : m
          );
          return { ...prev, [channelId]: next };
        });
      } catch (err) {
        console.error("handleMessageEdited error:", err);
      }
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
                deletedAt:
                  deletedAt || deleted_at || new Date().toISOString(),
              }
            : m
        );
        return { ...prev, [channelId]: next };
      });
    };

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

    socket.onAny((event, payload) => {
  console.log("[SOCKET EVENT]", event, payload);
});


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
  }, [auth.token, user.id, setActiveHuddle, rtc, usersWithKeys]);

  // JOIN / LEAVE main channel
useEffect(() => {
  const socket = getSocket();
  if (!socket || !activeChannelKey) return;

  setLoadingHistory(true);

  // 1️⃣ Join channel rooms
  joinChatChannel(activeChannelKey);

  // 2️⃣ 🔥 EXPLICITLY request history
  socket.emit("chat:open", activeChannelKey);

  activeChannelRef.current = activeChannelKey;

  return () => {
    leaveChatChannel(activeChannelKey);
  };
}, [activeChannelKey]);

  // JOIN / LEAVE thread channel (sidebar)
  useEffect(() => {
    let socket = getSocket();
    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }
    if (!socket) return;
    if (!activeThreadKey) return;

    joinChatChannel(activeThreadKey);

    return () => {
      if (activeThreadKey) {
        leaveChatChannel(activeThreadKey);
      }
    };
  }, [activeThreadKey, auth.token]);

  // ----- THREAD HANDLERS (SIDEBAR) -----
  const handleOpenThread = (message) => {
    if (!message?.id) return;
    const threadKey = `thread:${message.id}`;

    setThreadParents((prev) => ({
      ...prev,
      [threadKey]:
        activeChannelKey && !activeChannelKey.startsWith("thread:")
          ? activeChannelKey
          : prev[threadKey] || GENERAL_CHANNEL_KEY,
    }));

    setActiveThreadKey(threadKey);
    setThreadRootMessage(message);
    setOpenReactionFor(null);
  };

  const handleCloseThread = () => {
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
  };

  // ----- SEND MESSAGE (MAIN CHANNEL / DM) -----
  const handleSend = async (e) => {
    e.preventDefault();
    const html = (editorHtml || "").trim();
    if (activeChannelKey === AVAILABILITY_CHANNEL_KEY) {
  toast.error("This channel is read-only.");
  return;
}

    if (!html) return;
    if (!connected) return;

    // EDIT MODE
    if (editingMessageId) {
      const channelId = editingOriginalChannel || activeChannelKey;
      const messageId = editingMessageId;

      // Locally update with plaintext (also apply emoji conversion)
      const plainWithEmoji = convertEmojiShortcodes(html);

      setMessagesByChannel((prev) => {
        const channelMessages = prev[channelId] || [];
        const next = channelMessages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                textHtml: plainWithEmoji,
                updatedAt: new Date().toISOString(),
              }
            : m
        );
        return { ...prev, [channelId]: next };
      });

      // 🔐 Encrypt updated text before sending to server
      let encryptedHtml = html;
      try {
        const recipientIds = getRecipientIdsForChannelKey(channelId);
        encryptedHtml = await encryptForRecipients(
          html,
          user.id,
          recipientIds,
          usersWithKeys
        );
      } catch (err) {
        console.error(
          "E2E encrypt (edit) failed, falling back to plaintext:",
          err
        );
      }

      const socket = getSocket();
      if (socket) {
        socket.emit("chat:edit", {
          channelId,
          messageId,
          text: encryptedHtml,
        });
      }

      setEditingMessageId(null);
      setEditingOriginalChannel(null);
      setEditorHtml("");
      setAttachment(null);
      setSending(false);
      return;
    }

    // 🆕 NORMAL SEND (new message, not edit)
    const tempId = createUniqueId("temp");
    setSending(true);

    // Locally show plaintext so UI is snappy (apply emoji conversion)
    const plainWithEmoji = convertEmojiShortcodes(html);

    setMessagesByChannel((prev) => {
      const existing = prev[activeChannelKey] || [];
      const next = [
        ...existing,
        {
          id: tempId,
          channelId: activeChannelKey,
          textHtml: plainWithEmoji,
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString(),
          parentId: null,
          reactions: {},
        },
      ];
      return { ...prev, [activeChannelKey]: next };
    });

    // 🔐 Encrypt for recipients before sending to backend
    let encryptedHtml = html;
    try {
      const recipientIds = getRecipientIdsForChannelKey(activeChannelKey);
      encryptedHtml = await encryptForRecipients(
        html,
        user.id,
        recipientIds,
        usersWithKeys
      );
    } catch (err) {
      console.error("E2E encrypt failed, sending plaintext:", err);
    }

    sendChatMessage({
      channelId: activeChannelKey,
      text: encryptedHtml,
      tempId,
      parentId: null,
    });

    setEditorHtml("");
    setAttachment(null);
    setSending(false);
  };

  // ----- SEND MESSAGE IN THREAD -----
  const handleThreadEditorChange = (value) => {
    setThreadEditorHtml(value);
  };

  const handleSendThread = async (e) => {
    e.preventDefault();
    const html = (threadEditorHtml || "").trim();
    if (!html || !connected || !activeThreadKey || !threadRootMessage?.id) {
      return;
    }

    const tempId = createUniqueId("temp");
    const channelId = activeThreadKey;
    const parentId = threadRootMessage.id;

    // Locally show plaintext (apply emoji conversion)
    const plainWithEmoji = convertEmojiShortcodes(html);

    setMessagesByChannel((prev) => {
      const existing = prev[channelId] || [];
      const next = [
        ...existing,
        {
          id: tempId,
          channelId,
          textHtml: plainWithEmoji,
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString(),
          parentId,
          reactions: {},
        },
      ];
      return { ...prev, [channelId]: next };
    });

    // 🔐 Encrypt for recipients of the *parent channel*
    let encryptedHtml = html;
    try {
      const parentKey = threadParentChannelKey || activeChannelKey;
      const recipientIds = getRecipientIdsForChannelKey(parentKey);
      encryptedHtml = await encryptForRecipients(
        html,
        user.id,
        recipientIds,
        usersWithKeys
      );
    } catch (err) {
      console.error("E2E encrypt (thread) failed, sending plaintext:", err);
    }

    sendChatMessage({
      channelId,
      text: encryptedHtml,
      tempId,
      parentId,
    });

    setThreadEditorHtml("");
  };

  // ----- CHANNEL / DM SELECT -----
  const handleSelectDm = (otherUser) => {
    const key = dmKeyFor(user.id, otherUser.id);
    setActiveChannelKey(key);
    setActiveDmUser(otherUser);
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
  };

  const handleSelectGeneral = () => {
    setActiveChannelKey(GENERAL_CHANNEL_KEY);
    setActiveDmUser(null);
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
  };

  const handleSelectChannel = (channelKey) => {
    setActiveChannelKey(channelKey);
    setActiveDmUser(null);
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
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

  // Typing in main composer
  const handleEditorChange = (value) => {
    setEditorHtml(value);
    const now = Date.now();
    if (activeChannelKey === AVAILABILITY_CHANNEL_KEY) return;
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

  const typingUsersForActive = typingByChannel[activeChannelKey] || {};
  const typingUsernames = Object.values(typingUsersForActive)
    .filter((entry) => {
      if (!entry || !entry.at) return false;
      const diff = Date.now() - new Date(entry.at).getTime();
      return diff < 4000;
    })
    .map((entry) => entry.username)
    .filter((name) => name && name !== user.username);

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

  useEffect(() => {
    if (!connected) return;
    if (!activeMessages.length) return;
    const last = activeMessages[activeMessages.length - 1];
    const at = last.createdAt || new Date().toISOString();
    if (!activeChannelKey) return;
    sendReadReceipt(activeChannelKey, at);
  }, [connected, activeChannelKey, activeMessages]);

  const handleToggleHuddle = () => {
    if (!connected || !rtc) return;

    if (activeChannelKey === AVAILABILITY_CHANNEL_KEY) return;


    if (activeHuddle) {
      if (isHuddleOwner) {
        endHuddle(activeHuddle.channelId, activeHuddle.huddleId);
      }
      rtc.leaveHuddle();
      if (setActiveHuddle) setActiveHuddle(null);
      return;
    }

    const huddleId = createUniqueId("huddle");
    startHuddle(activeChannelKey, huddleId);

    if (setActiveHuddle) {
      setActiveHuddle({
        channelId: activeChannelKey,
        huddleId,
        startedBy: { userId: user.id, username: user.username },
        at: new Date().toISOString(),
      });
    }

    rtc.joinHuddle();
  };

  const handleToggleReaction = (messageId, emoji) => {
    if (!activeChannelKey) return;

    const currentMessages = messagesByChannel[activeChannelKey] || [];
    const msg = currentMessages.find((m) => m.id === messageId);
    const currentReactions = msg?.reactions || {};
    const existing = currentReactions[emoji];
    const existingUserIds = existing?.userIds || [];
    const hasReacted = existingUserIds.includes(user.id);
    const action = hasReacted ? "remove" : "add";

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

  let huddleButtonLabel = "Start huddle";
  if (isHuddleActiveHere) {
    if (huddleJoined || huddleConnecting) {
      huddleButtonLabel = isHuddleOwner ? "End huddle" : "Leave huddle";
    } else {
      huddleButtonLabel = "Join huddle";
    }
  } else if (activeHuddle) {
    huddleButtonLabel = "Huddle in another channel";
  }

  return (
    <div className="h-full flex gap-4">
      {/* LEFT: CHANNELS + DMS */}
      <aside className="w-64 bg-white rounded-xl shadow p-3 flex flex-col text-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] font-semibold text-slate-500">
              Channels
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-1">
              <span
                className={`w-2 h-2 rounded-full ${statusDotClass}`}
              ></span>
              <span>{statusLabel}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="text-[14px] leading-none px-2 hover:bg-slate-100 rounded"
            title="Create channel"
          >
            +
          </button>
        </div>

        {/* GENERAL */}
        <button
          type="button"
          onClick={handleSelectGeneral}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs mb-2 ${
            isGeneralChannel
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">#</span>
            <span>team-general</span>
          </span>
        </button>

        {/* SYSTEM CHANNELS (pinned) */}
        <button
          type="button"
          onClick={() => handleSelectChannel(AVAILABILITY_CHANNEL_KEY)}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs mb-1 ${
            activeChannelKey === AVAILABILITY_CHANNEL_KEY
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">#</span>
            <span>availability-updates</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleSelectChannel(PROJECT_MANAGER_CHANNEL_KEY)}
          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs mb-2 ${
            activeChannelKey === PROJECT_MANAGER_CHANNEL_KEY
              ? "bg-blue-50 text-blue-700"
              : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-base">#</span>
            <span>project-manager</span>
          </span>
        </button>

        {/* PUBLIC CHANNELS */}
        {publicChannels.length > 0 && (
          <div className="mb-3 space-y-1">
            {publicChannels.map((ch) => {
              const isActive = activeChannelKey === ch.key;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChannel(ch.key)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">#</span>
                    <span>{ch.name}</span>
                  </span>

                  {/* settings control - span instead of button */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsChannel(ch);
                      setOpenSettings(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSettingsChannel(ch);
                        setOpenSettings(true);
                      }
                    }}
                    className="text-[12px] hover:text-slate-900 cursor-pointer"
                    title="Channel settings"
                    aria-label={`Channel settings for ${ch.name}`}
                  >
                    ⋮
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* PRIVATE CHANNELS */}
        {privateChannels.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              Private <span className="text-[9px]">🔒</span>
            </div>

            {privateChannels.map((ch) => {
              const isActive = activeChannelKey === ch.key;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => handleSelectChannel(ch.key)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>🔒</span>
                    <span>{ch.name}</span>
                  </span>

                  {/* settings control - span instead of button */}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSettingsChannel(ch);
                      setOpenSettings(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        setSettingsChannel(ch);
                        setOpenSettings(true);
                      }
                    }}
                    className="text-[12px] cursor-pointer"
                    title="Channel settings"
                    aria-label={`Channel settings for ${ch.name}`}
                  >
                    ⋮
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* DMs */}
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

      {/* CENTER: MAIN CHAT */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Header */}
        <section className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{activeChannelTitle}</h1>
            <p className="text-xs text-slate-500">
              {isDmChannel
                ? "Private 1:1 conversation between you and your teammate."
                : "Team or channel-wide real-time chat."}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* DM presence pill */}
            {!isGeneralChannel && isDmChannel && activeDmUser && (
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
              className="text-xs border rounded-full px-2 py-[2px] w-40 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />

            {/* Huddle button */}
            {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
            <button
              type="button"
              onClick={handleToggleHuddle}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-[4px] text-[11px] hover:bg-slate-50"
            >
              <span>🔊</span>
              <span>{huddleButtonLabel}</span>
            </button>
            )}

            {/* Connection status pill */}
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px]">
              <span
                className={`w-2 h-2 rounded-full ${statusDotClass}`}
              ></span>
              <span className="text-[11px]">{statusLabel}</span>
            </span>

            {/* Signed-in user */}
            <span className="text-slate-500 text-[11px]">
              You are signed in as{" "}
              <span className="font-semibold">{user.username}</span>
            </span>
          </div>
        </section>

        {/* MAIN CHAT BODY */}
        <section className="bg-white rounded-xl shadow p-4 flex-1 flex flex-col min-h-0">
          {/* Huddle banner in this channel */}
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
                    onClick={() => rtc?.joinHuddle?.()}
                    className="text-[10px] border border-amber-300 rounded px-2 py-1 hover:bg-amber-100"
                  >
                    Join huddle
                  </button>
                )}
                {huddleJoined && (
                  <span className="text-[10px] text-amber-700">
                    You&apos;re in this huddle (see floating window)
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

          {/* Messages List */}
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
  const time = m.createdAt
    ? new Date(m.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      key={m.id}
      className="w-full text-center text-[10px] text-slate-500 my-2"
    >
      <span className="opacity-80">
        — {m.textHtml || m.text} —
      </span>
      {time && (
        <span className="ml-2 text-[9px] text-slate-400">
          {time}
        </span>
      )}
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
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                        isOwn
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                      }`}
                    >
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

                      {m.deletedAt ? (
                        <div className="text-[10px] italic text-slate-300">
                          This message was deleted.
                        </div>
                      ) : (
                        <>
                          <div
                            className="text-[11px] whitespace-pre-wrap break-words prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: m.textHtml || m.text || "",
                            }}
                          />

                          {/* Reactions */}
                          {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && reactionEntries.length > 0 && (
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
                          {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
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
                          )}

                          {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && openReactionFor === m.id && (
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

                          {/* Thread + Edit/Delete */}
                          {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
                          <div
                            className={`mt-1 flex ${
                              isOwn ? "justify-end" : "justify-start"
                            } gap-2 text-[10px] opacity-80`}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenThread(m)}
                              className="underline hover:no-underline"
                            >
                              Reply in thread
                            </button>

                            {isOwn && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleStartEditMessage(m)}
                                  className="underline hover:no-underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteMessage(m.id)
                                  }
                                  className="underline hover:no-underline"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                          )}

                          {/* Read receipts */}
                          {isLastOwn && !m.deletedAt && (
                            <div className="mt-1 text-[9px] text-blue-100">
                              {readers.length === 0
                                ? "Delivered"
                                : `Seen by ${readers
                                    .map((r) => r.username)
                                    .join(", ")}`}
                            </div>
                          )}
                        </>
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

          {/* Typing indicator */}
          {typingUsernames.length > 0 && (
            <div className="mt-1 text-[10px] text-slate-500">
              {typingUsernames.length === 1
                ? `${typingUsernames[0]} is typing...`
                : `${typingUsernames.join(", ")} are typing...`}
            </div>
          )}

          {/* Main composer */}
          {/* Main composer */}
<form
  onSubmit={handleSend}
  className="mt-3 text-xs"
>
  {activeChannelKey !== AVAILABILITY_CHANNEL_KEY ? (
    <>
      <div className="flex items-end gap-2">
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
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleAttachmentChange}
      />
    </>
  ) : (
    <div className="text-[11px] text-slate-400 italic">
      This channel is read-only. Attendance updates are posted automatically.
    </div>
  )}
</form>

        </section>
      </div>

      {/* RIGHT: THREAD SIDEBAR */}
      {activeThreadKey && threadRootMessage && (
        <aside className="w-[340px] bg-white rounded-xl shadow flex flex-col text-xs">
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-700">
                Thread
              </span>
              <span className="text-[10px] text-slate-400">
                in{" "}
                {threadParentChannel
                  ? `#${threadParentChannel.name}`
                  : "this channel"}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCloseThread}
              className="text-[12px] text-slate-400 hover:text-slate-700"
              title="Close thread"
            >
              ✕
            </button>
          </div>

          {/* Root message */}
          <div className="px-4 py-3 border-b bg-slate-50">
            <div className="text-[10px] font-semibold mb-1">
              {threadRootMessage.username === user.username
                ? "You"
                : threadRootMessage.username || "User"}
            </div>
            <div
              className="text-[11px] whitespace-pre-wrap break-words"
              dangerouslySetInnerHTML={{
                __html:
                  threadRootMessage.textHtml ||
                  threadRootMessage.text ||
                  "",
              }}
            />
          </div>

          {/* Thread messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 bg-white">
            {threadMessages.length === 0 ? (
              <div className="text-[11px] text-slate-400">
                No replies yet. Start the conversation.
              </div>
            ) : (
              threadMessages.map((m) => {
                const isOwn =
                  String(m.userId || m.user_id) === String(user.id);
                const time = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString()
                  : "";
                return (
                  <div
                    key={m.id}
                    className={`flex ${
                      isOwn ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 shadow-sm ${
                        isOwn
                          ? "bg-blue-600 text-white"
                          : "bg-slate-50 border border-slate-200 text-slate-800"
                      }`}
                    >
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
                      <div
                        className="text-[11px] whitespace-pre-wrap break-words"
                        dangerouslySetInnerHTML={{
                          __html: m.textHtml || m.text || "",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Thread composer */}
          
          <form
            onSubmit={handleSendThread}
            className="border-t px-3 py-2 flex flex-col gap-2"
          >
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <ReactQuill
                theme="snow"
                value={threadEditorHtml}
                onChange={handleThreadEditorChange}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Reply in thread..."
                className="text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!connected || !(threadEditorHtml || "").trim()}
                className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[11px] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reply
              </button>
            </div>
          </form>
        </aside>
      )}

      {/* CHANNEL MODALS */}
      <CreateChannelModal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={(channel) => {
          setChannels((prev) => [...prev, channel]);
          setActiveChannelKey(channel.key);
        }}
      />

      <ChannelSettingsModal
        open={openSettings}
        channel={settingsChannel}
        currentUser={user}
        onClose={() => setOpenSettings(false)}
        onUpdate={() => loadChannels()}
        onLeave={(channelKey) => {
          setOpenSettings(false);
          if (activeChannelKey === channelKey) {
            setActiveChannelKey(GENERAL_CHANNEL_KEY);
          }
          loadChannels();
        }}
        onDelete={(channelKey) => {
          setOpenSettings(false);
          if (activeChannelKey === channelKey) {
            setActiveChannelKey(GENERAL_CHANNEL_KEY);
          }
          loadChannels();
        }}
      />
    </div>
  );
}
