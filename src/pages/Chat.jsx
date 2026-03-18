// src/pages/Chat.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import {
  generateUserKeyPair,
  encryptForRecipients,
  decryptEnvelopeIfNeeded,
} from "../crypto/chatCrypto";
import { useApi, API_BASE_URL } from "../api";
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
import { MessageSquare, Send, Hash, Lock, Users, Settings, Plus, Smile, Menu, X as XIcon, Phone, ChevronLeft, Paperclip } from "lucide-react";
import { Avatar, FetchImg, Button, Badge, Card } from "../components/ui";
import { useIsMobile } from "../hooks/useIsMobile";

import CreateChannelModal from "../components/CreateChannelModal";
import ChannelSettingsModal from "../components/ChannelSettingsModal";
import ReportsModal from "../components/ReportsModal";


// ----- URL RESOLVER -----
// Remaps localhost/127.0.0.1 absolute URLs to the configured backend.
// Critical on mobile where "localhost" means the device, not the PC.
const _BACKEND = API_BASE_URL || import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
function resolveUrl(src) {
  if (!src) return null;
  if (src.startsWith("http://localhost") || src.startsWith("http://127.0.0.1")) {
    return _BACKEND + src.replace(/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, "");
  }
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("blob:") || src.startsWith("data:")) return src;
  return `${_BACKEND}${src}`;
}

// ----- CONFIG -----
const GENERAL_CHANNEL_KEY = "team-general";
const AVAILABILITY_CHANNEL_KEY = "availability-updates";
const PROJECT_MANAGER_CHANNEL_KEY = "project-manager";
const QUICK_REACTIONS = ["👍", "👎", "❤️", "😂", "🎉", "😮", "😢", "🔥", "✅", "👀", "🙏", "💯"];
const quillModules = {
  toolbar: [
    ["bold", "italic"],
    ["link"],
    [{ list: "bullet" }],
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

function normalizeMessage(msg) {
  return {
    ...msg,
    userId: msg.userId || msg.user_id,
    reactions: msg.reactions || {},
  };
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

  // Mobile: two-screen nav ("list" = channel picker, "chat" = active conversation)
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileText, setMobileText] = useState(""); // kept for legacy, mobile now uses editorHtml
  const mobileTextareaRef = useRef(null);
  const mobileQuillRef = useRef(null); // ref to ReactQuill instance for mobile

  // AI preference (per-user, per-workspace)
const [aiReplyEnabled, setAiReplyEnabled] = useState(true);
const [loadingAiPref, setLoadingAiPref] = useState(false);

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
  const [reportsContext, setReportsContext] = useState(null);
const [reportsOpen, setReportsOpen] = useState(false);

  const [activeDmUser, setActiveDmUser] = useState(null);
  const [aiExplainLoading, setAiExplainLoading] = useState(null);

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
const [openReports, setOpenReports] = useState(false);
const [reportContext, setReportContext] = useState(null);

  // presence map: userId -> { status, at }
  const [presenceMap, setPresenceMap] = useState({});

  // Rich editor content (main channel)
  const [editorHtml, setEditorHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null); // legacy single-file preview
  const [pendingAttachments, setPendingAttachments] = useState([]); // uploaded attachments ready to send
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

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
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // Unread counts per channel (cleared when channel is selected)
  const [unreadByChannel, setUnreadByChannel] = useState({});

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, string = query
  const [mentionAnchor, setMentionAnchor] = useState(0); // cursor position of "@"

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingOriginalChannel, setEditingOriginalChannel] = useState(null);
  const [collapsedSlackGroups, setCollapsedSlackGroups] = useState({});

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
      // Strip system/AI users — they must never appear in the user list or mentions
      const humanUsers = (res.data || []).filter(
        (u) => u.role !== "system" && !u.is_system && !u.username?.startsWith("AI_System_")
      );
      setUsers(humanUsers);
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
  let cancelled = false;

  async function loadAiPreference() {
    try {
      const res = await api.get(`/users/${user.id}/ai-preference`);
      if (cancelled) return;

      setAiReplyEnabled(res.data?.aiReplyEnabled === true);
    } catch (err) {
      console.warn("Failed to load AI preference, defaulting ON");
      setAiReplyEnabled(true); // backward compatible
    }
  }

  if (user?.id) {
    loadAiPreference();
  }

  return () => {
    cancelled = true;
  };
}, [api, user?.id]);

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

  // Only top-level messages in main view (parentId === null); thread replies stay in sidebar
  const topLevelMessages = useMemo(
    () => activeMessages.filter((m) => !m.parentId),
    [activeMessages]
  );

  // reply count per message id (derived from all messages in the channel)
  const replyCountById = useMemo(() => {
    const counts = {};
    for (const m of activeMessages) {
      if (m.parentId) {
        counts[m.parentId] = (counts[m.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [activeMessages]);

  const messagesToRender = useMemo(() => {
    if (!normalizedSearch) return topLevelMessages;
    return topLevelMessages.filter((m) => {
      const text = (m.textHtml || m.text || "").toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [topLevelMessages, normalizedSearch]);

  const lastMessageId =
    topLevelMessages.length > 0
      ? topLevelMessages[topLevelMessages.length - 1].id
      : null;

  // Build userId → full avatar URL map (uses module-level resolveUrl)
  const BACKEND_URL = _BACKEND;
  const userAvatarMap = useMemo(() => {
    const map = {};
    for (const u of users) {
      if (u.avatar_url) map[u.id] = resolveUrl(u.avatar_url);
    }
    return map;
  }, [users]);

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
          !key.startsWith("thread:") &&
          !key.startsWith("slack-")
        );
      }),
    [channels]
  );

  // Slack-imported channels grouped by prefix (slack-engineering-*, slack-marketing-*, etc.)
  const slackChannelGroups = useMemo(() => {
    const slack = (channels || []).filter((ch) => {
      if (!ch) return false;
      const key = ch.key || "";
      const isPrivate = ch.is_private ?? ch.isPrivate ?? false;
      return !isPrivate && key.startsWith("slack-");
    });
    const groups = {};
    for (const ch of slack) {
      const parts = ch.key.replace(/^slack-/, "").split(/[-_]/);
      const prefix = parts[0] || "general";
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(ch);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [channels]);

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

  // thread derived — filter replies from the parent channel by parentId
  const threadMessages = useMemo(() => {
    if (!activeThreadKey || !threadRootMessage?.id) return [];
    const parentKey = threadParents[activeThreadKey] || activeChannelKey;
    const parentMsgs = messagesByChannel[parentKey] || [];
    return parentMsgs
      .filter((m) => m.parentId === threadRootMessage.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [activeThreadKey, threadRootMessage, messagesByChannel, threadParents, activeChannelKey]);

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

      return applyEmojiToMessage(normalizeMessage(result));
    })
  );

  // ✅ FIX 1: merge history instead of replacing
  setMessagesByChannel((prev) => {
  const existing = prev[channelId] || [];

  // Index existing messages by id
  const existingById = new Map(
    existing.filter(m => m.id).map(m => [m.id, m])
  );

  // History from DB is SOURCE OF TRUTH
  history.forEach((m) => {
  if (!m.id) return;

  const prevMsg = existingById.get(m.id);

  existingById.set(
    m.id,
    normalizeMessage({
      ...prevMsg,        // keep reactions, local UI state
      ...m,              // DB is source of truth
      reactions:
        m.reactions ??
        prevMsg?.reactions ??
        {},
    })
  );
});

  return {
    ...prev,
    [channelId]: Array.from(existingById.values()).sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    ),
  };
});

  setLoadingHistory(false);
};

const handleChatMessage = async (msg) => {

// 🔥 REPORT MODAL TRIGGER (FIXED)
if (msg?.textHtml?.startsWith("__REPORT_READY__")) {
  try {
    const payload = JSON.parse(
      msg.textHtml.replace("__REPORT_READY__", "")
    );

    setReportsContext({
      workspaceId: msg.workspaceId,
      projectName: payload.projectName,
      fromDate: payload.fromDate,
      toDate: payload.toDate,
    });

    setReportsOpen(true);
  } catch (err) {
    console.error("Failed to parse report payload", err);
  }
  return; // ⛔ do not continue normal message handling
}

  if (!msg) return;

  // 🔥 Normalize channel id (AI / legacy / normal messages)
  const channelId = msg.channelId || msg.channelKey || msg.channel;
  if (!channelId) return;

  // ✅ 🔁 TEMP → REAL MESSAGE REPLACEMENT (CRITICAL)
  setMessagesByChannel((prev) => {
    const list = prev[channelId] || [];

    if (msg.id && msg.tempId) {
      const idx = list.findIndex((m) => m.id === msg.tempId);
      if (idx !== -1) {
        const next = [...list];
        next[idx] = {
          ...next[idx],
          id: msg.id,
          createdAt: msg.createdAt || next[idx].createdAt,
        };
        return { ...prev, [channelId]: next };
      }
    }

    return prev;
  });

  // 🔐 decrypt AFTER reconciliation
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

  // 📊 AI-triggered reports modal
if (
  msg?.meta?.action === "OPEN_REPORTS"
) {
  setOpenReports(true);
}

  const normalizedWithEmoji = applyEmojiToMessage(normalized);

  // 📊 REPORT TRIGGER FROM AI
if (
  normalizedWithEmoji.username === "AI Assistant" &&
  typeof normalizedWithEmoji.textHtml === "string" &&
  normalizedWithEmoji.textHtml.includes("REPORT_READY")
) {
  try {
    const parsed = JSON.parse(
      normalizedWithEmoji.textHtml.replace("REPORT_READY:", "")
    );

    setReportContext(parsed);
    setOpenReports(true);
  } catch (err) {
    console.warn("Failed to parse report context", err);
  }
}

  setMessagesByChannel((prev) => {
    const existing = prev[channelId] || [];

    // 🔁 id replacement (socket echo / AI / history overlap)
    const idx = existing.findIndex((m) => m.id === normalizedWithEmoji.id);
    if (idx !== -1) {
      const next = [...existing];
      next[idx] = { ...next[idx], ...normalizedWithEmoji };
      return { ...prev, [channelId]: next };
    }

    // ➕ otherwise push
    return {
      ...prev,
      [channelId]: [...existing, normalizedWithEmoji],
    };
  });

  // 🔴 Track unread for non-active channels (not own messages)
  if (
    channelId !== activeChannelRef.current &&
    normalizedWithEmoji.userId !== user.id &&
    !normalizedWithEmoji.system
  ) {
    setUnreadByChannel((prev) => ({
      ...prev,
      [channelId]: (prev[channelId] || 0) + 1,
    }));
  }
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

  // Thread sidebar uses messages already loaded from the parent channel — no extra socket join needed

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

    if (!html && pendingAttachments.length === 0) return;
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
    // Capture attachments before any async/state operations
    const attachmentsToSend = [...pendingAttachments];

    setMessagesByChannel((prev) => {
  const existing = prev[activeChannelKey] || [];

  // 🔒 PREVENT DUPLICATE TEMP INSERT
  if (existing.some((m) => m.id === tempId)) {
    return prev;
  }

  return {
    ...prev,
    [activeChannelKey]: [
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
        attachments: attachmentsToSend,
      },
    ],
  };
});

    // 🔐 Encrypt for recipients before sending to backend
    // Use a zero-width space so attachment-only messages are never rejected
    // by the backend's empty-text guard (the guard allows empty text when
    // attachments are present, but this acts as an extra safety net)
    const textToEncrypt = html || (attachmentsToSend.length > 0 ? "\u200b" : "");
    let encryptedHtml = textToEncrypt;
    try {
      const recipientIds = getRecipientIdsForChannelKey(activeChannelKey);
      encryptedHtml = await encryptForRecipients(
        textToEncrypt,
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
      attachments: attachmentsToSend,
    });

    setEditorHtml("");
    setAttachment(null);
    setPendingAttachments([]);
    setSending(false);
  };

  // ----- MOBILE SEND (uses mobileText instead of ReactQuill editorHtml) -----
  const handleMobileSend = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const html = mobileText.trim();
    if (activeChannelKey === AVAILABILITY_CHANNEL_KEY) {
      toast.error("This channel is read-only.");
      return;
    }
    if (!html && pendingAttachments.length === 0) return;
    if (!connected) return;

    const tempId = createUniqueId("temp");
    setSending(true);
    const plainWithEmoji = convertEmojiShortcodes(html);
    const attachmentsToSend = [...pendingAttachments];

    setMessagesByChannel((prev) => {
      const existing = prev[activeChannelKey] || [];
      if (existing.some((m) => m.id === tempId)) return prev;
      return {
        ...prev,
        [activeChannelKey]: [...existing, {
          id: tempId,
          channelId: activeChannelKey,
          textHtml: plainWithEmoji,
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString(),
          parentId: null,
          reactions: {},
          attachments: attachmentsToSend,
        }],
      };
    });

    const textToEncrypt = html || (attachmentsToSend.length > 0 ? "\u200b" : "");
    let encryptedHtml = textToEncrypt;
    try {
      const recipientIds = getRecipientIdsForChannelKey(activeChannelKey);
      encryptedHtml = await encryptForRecipients(textToEncrypt, user.id, recipientIds, usersWithKeys);
    } catch (err) {
      console.error("E2E encrypt failed, sending plaintext:", err);
    }

    sendChatMessage({
      channelId: activeChannelKey,
      text: encryptedHtml,
      tempId,
      parentId: null,
      attachments: attachmentsToSend,
    });

    setMobileText("");
    setPendingAttachments([]);
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
    // Thread replies belong in the parent channel (not in the virtual thread:xxx key)
    const parentChannelKey = threadParentChannelKey || activeChannelKey;
    const parentId = threadRootMessage.id;

    // Locally show plaintext immediately (optimistic update in parent channel)
    const plainWithEmoji = convertEmojiShortcodes(html);

    setMessagesByChannel((prev) => {
      const existing = prev[parentChannelKey] || [];
      if (existing.some((m) => m.id === tempId)) return prev;
      return {
        ...prev,
        [parentChannelKey]: [
          ...existing,
          {
            id: tempId,
            channelId: parentChannelKey,
            textHtml: plainWithEmoji,
            userId: user.id,
            username: user.username,
            createdAt: new Date().toISOString(),
            parentId,
            reactions: {},
            attachments: [],
          },
        ],
      };
    });

    // 🔐 Encrypt for recipients of the parent channel
    let encryptedHtml = html;
    try {
      const recipientIds = getRecipientIdsForChannelKey(parentChannelKey);
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
      channelId: parentChannelKey,
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
    setUnreadByChannel((prev) => ({ ...prev, [key]: 0 }));
    setMobileSidebarOpen(false);
    setMobileView("chat");
  };

  const handleSelectGeneral = () => {
    setActiveChannelKey(GENERAL_CHANNEL_KEY);
    setActiveDmUser(null);
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
    setUnreadByChannel((prev) => ({ ...prev, [GENERAL_CHANNEL_KEY]: 0 }));
    setMobileSidebarOpen(false);
    setMobileView("chat");
  };

  const handleSelectChannel = (channelKey) => {
    setActiveChannelKey(channelKey);
    setActiveDmUser(null);
    setActiveThreadKey(null);
    setThreadRootMessage(null);
    setThreadEditorHtml("");
    setUnreadByChannel((prev) => ({ ...prev, [channelKey]: 0 }));
    setMobileSidebarOpen(false);
    setMobileView("chat");
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAttachmentChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // reset so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";

    setUploadingAttachment(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const formData = new FormData();
          formData.append("file", file);
          const res = await api.post("/upload/chat-attachment", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return res.data; // { url, name, size, type }
        })
      );
      setPendingAttachments((prev) => [...prev, ...uploaded]);
    } catch (err) {
      toast.error("Failed to upload attachment");
      console.error("Attachment upload failed:", err);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemovePendingAttachment = (index) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
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

    // @mention detection: extract plain text from HTML and find trailing @word
    const plain = value.replace(/<[^>]+>/g, "");
    const atMatch = plain.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
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

  const handleScrollMessages = (e) => {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 250);
  };

  const scrollToBottom = () => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

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
  // 🚫 Prevent editing temp messages
  if (!message.id || message.id.startsWith("temp-")) {
    return;
  }

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

  async function handleExplainAI(messageId, retry = 0) {
  try {
    setAiExplainLoading(messageId);

    const res = await api.get(`/internal/ai/explain/${messageId}`);

    // ⏳ Explanation exists but is still being written (async)
    if (res.data?.available === false) {
      if (retry < 5) {
        setTimeout(() => {
          handleExplainAI(messageId, retry + 1);
        }, 600);
        return;
      }

      toast("AI is still analyzing this reply. Please try again.", {
        icon: "⏳",
        duration: 4000,
      });
      return;
    }

    // ✅ Explanation ready
    const explanationObj = res.data.explanation;

    if (!explanationObj) {
      toast("AI explanation could not be parsed.", {
        icon: "⚠️",
      });
      return;
    }

    // 🧠 Build HUMAN-LEVEL reasoning (no gimmicks)
    const parts = [];

    if (explanationObj.triggerMessage) {
      parts.push(
        `You asked:\n"${explanationObj.triggerMessage}"`
      );
    }

    if (explanationObj.summary) {
      parts.push(`\nWhy AI replied:\n${explanationObj.summary}`);
    }

    if (
      Array.isArray(explanationObj.reasoning) &&
      explanationObj.reasoning.length
    ) {
      parts.push(
        `\nKey reasoning:\n• ${explanationObj.reasoning.join("\n• ")}`
      );
    }

    toast.success(parts.join("\n\n"), {
      duration: 5000,
      style: {
        maxWidth: "480px",
        whiteSpace: "pre-line",
      },
    });
  } catch (err) {
    toast.error("Failed to fetch AI explanation.");
  } finally {
    setAiExplainLoading(null);
  }
}

  // ========================================================
  // MOBILE LAYOUT — two-screen Slack-style navigation
  // ========================================================
  if (isMobile) {
    const totalUnread = Object.values(unreadByChannel).reduce((s, n) => s + n, 0);

    return (
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── SCREEN 1: Channel / DM list ── */}
        {mobileView === "list" && (
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">

            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-700/60 shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h1 className="text-white font-bold text-xl tracking-tight">Messages</h1>
                <div className="flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} title={statusLabel} />
                  <button
                    type="button"
                    onClick={() => setOpenCreate(true)}
                    className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300 active:bg-slate-600"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* AI Toggle row */}
              <div className="flex items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">🤖</span>
                  <div>
                    <div className="text-[12px] text-slate-200 font-medium">AI Auto-reply</div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={loadingAiPref}
                  onClick={async () => {
                    const next = !aiReplyEnabled;
                    setAiReplyEnabled(next);
                    try {
                      setLoadingAiPref(true);
                      await api.put(`/users/${user.id}/ai-preference`, { aiReplyEnabled: next });
                    } catch {
                      toast.error("Failed to update AI preference");
                      setAiReplyEnabled(!next);
                    } finally {
                      setLoadingAiPref(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiReplyEnabled ? "bg-blue-500" : "bg-slate-600"}`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${aiReplyEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>

              {/* Search */}
              <div className="mt-3">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels & people..."
                  className="w-full bg-slate-800 text-slate-200 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            {/* Scrollable channel + DM list */}
            <nav className="flex-1 overflow-y-auto py-2">

              {/* CHANNELS */}
              <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Channels</span>
              </div>

              {/* Pinned system channels */}
              {[
                { key: GENERAL_CHANNEL_KEY, label: "team-general" },
                { key: AVAILABILITY_CHANNEL_KEY, label: "availability-updates" },
                { key: PROJECT_MANAGER_CHANNEL_KEY, label: "project-manager" },
              ].map(({ key, label }) => {
                const unread = unreadByChannel[key] || 0;
                const isActive = activeChannelKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => key === GENERAL_CHANNEL_KEY ? handleSelectGeneral() : handleSelectChannel(key)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-700/50 ${isActive ? "bg-slate-700" : ""}`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                        <Hash size={14} className="text-slate-400" />
                      </div>
                      <span className={`text-[14px] font-medium truncate ${isActive ? "text-white" : unread > 0 ? "text-white font-semibold" : "text-slate-400"}`}>{label}</span>
                    </span>
                    {unread > 0 && (
                      <span className="ml-2 bg-blue-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center shrink-0">{unread}</span>
                    )}
                  </button>
                );
              })}

              {/* Public channels */}
              {publicChannels
                .filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((ch) => {
                  const unread = unreadByChannel[ch.key] || 0;
                  const isActive = activeChannelKey === ch.key;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSelectChannel(ch.key)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-slate-700/50 ${isActive ? "bg-slate-700" : ""}`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                          <Hash size={14} className="text-slate-400" />
                        </div>
                        <span className={`text-[14px] truncate ${isActive ? "text-white" : unread > 0 ? "text-white font-semibold" : "text-slate-400"}`}>{ch.name}</span>
                      </span>
                      {unread > 0 && (
                        <span className="ml-2 bg-blue-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center shrink-0">{unread}</span>
                      )}
                    </button>
                  );
                })}

              {/* Slack imported channels */}
              {slackChannelGroups.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Slack</span>
                  </div>
                  {slackChannelGroups.map(([prefix, chs]) => (
                    chs
                      .filter(ch => !searchQuery || ch.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((ch) => {
                        const unread = unreadByChannel[ch.key] || 0;
                        const isActive = activeChannelKey === ch.key;
                        return (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => handleSelectChannel(ch.key)}
                            className={`w-full flex items-center justify-between pl-7 pr-4 py-2.5 text-left active:bg-slate-700/50 ${isActive ? "bg-slate-700" : ""}`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <Hash size={13} className="text-slate-500 shrink-0" />
                              <span className={`text-[13px] truncate ${isActive ? "text-white" : unread > 0 ? "text-white font-semibold" : "text-slate-400"}`}>{ch.name}</span>
                            </span>
                            {unread > 0 && (
                              <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center shrink-0">{unread}</span>
                            )}
                          </button>
                        );
                      })
                  ))}
                </>
              )}

              {/* Private channels */}
              {privateChannels.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><Lock size={9} /> Private</span>
                  </div>
                  {privateChannels.map((ch) => {
                    const isActive = activeChannelKey === ch.key;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleSelectChannel(ch.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-700/50 ${isActive ? "bg-slate-700" : ""}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                          <Lock size={13} className="text-slate-400" />
                        </div>
                        <span className={`text-[14px] truncate ${isActive ? "text-white" : "text-slate-400"}`}>{ch.name}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* DIRECT MESSAGES */}
              <div className="px-4 pt-5 pb-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Direct Messages</span>
              </div>

              {loadingUsers ? (
                <div className="px-4 py-2 text-[12px] text-slate-500">Loading...</div>
              ) : (
                sortedTeammates
                  .filter(u => !searchQuery || u.username.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((u) => {
                    const presence = presenceMap[u.id]?.status || "offline";
                    const color = presenceColor(presence);
                    const dmKey = dmKeyFor(user.id, u.id);
                    const isActive = activeChannelKey === dmKey;
                    const unread = unreadByChannel[dmKey] || 0;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectDm(u)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-slate-700/50 ${isActive ? "bg-slate-700" : ""}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            {u.avatar_url ? (
                              <FetchImg src={resolveUrl(u.avatar_url)} alt={u.username} className="w-9 h-9 rounded-full object-cover" />
                            ) : null}
                            {!u.avatar_url && (
                              <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-[13px] font-bold text-slate-200">
                                {u.username?.[0]?.toUpperCase() || "?"}
                              </div>
                            )}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-slate-900 ${color}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-[14px] font-medium truncate ${isActive ? "text-white" : unread > 0 ? "text-white font-semibold" : "text-slate-300"}`}>{u.username}</div>
                            <div className="text-[11px] text-slate-500 truncate">{presenceLabel(presence)}</div>
                          </div>
                        </div>
                        {unread > 0 && (
                          <span className="ml-2 bg-blue-500 text-white text-[11px] font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center shrink-0">{unread}</span>
                        )}
                      </button>
                    );
                  })
              )}

              <div className="h-4" />
            </nav>

            {/* Your profile footer */}
            <div className="px-4 py-3 border-t border-slate-700/60 shrink-0 bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {user.avatar_url ? (
                    <FetchImg src={resolveUrl(user.avatar_url)} alt={user.username} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-[13px] font-bold">
                      {user.username?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-200 truncate">{user.username}</div>
                  <div className="text-[11px] text-slate-500 capitalize">{user.role || "member"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SCREEN 2: Active chat ── */}
        {mobileView === "chat" && (
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">

            {/* Header */}
            <header className="px-3 py-3 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setMobileView("list")}
                className="p-2 -ml-1 text-slate-500 active:text-slate-800 rounded-lg"
              >
                <ChevronLeft size={22} />
              </button>

              {isDmChannel && activeDmUser ? (
                <div className="relative shrink-0">
                  <Avatar name={activeDmUser.username} src={userAvatarMap[activeDmUser.id]} size="sm" />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${dmPresenceClass}`} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Hash size={15} className="text-slate-500" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-slate-800 text-[15px] truncate leading-tight">{activeChannelTitle}</h2>
                <p className="text-[11px] text-slate-400 truncate leading-tight">
                  {isDmChannel ? dmPresenceText : activeChannel?.description || "Team channel"}
                </p>
              </div>

              {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
                <button
                  type="button"
                  onClick={handleToggleHuddle}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors shrink-0 ${
                    isHuddleActiveHere ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500 active:bg-slate-200"
                  }`}
                  title={huddleButtonLabel}
                >
                  🔊
                </button>
              )}
            </header>

            {/* Disconnect banner */}
            {!connected && !joining && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-[11px] font-medium shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-200 animate-pulse" />
                <span>Disconnected — trying to reconnect…</span>
              </div>
            )}

            {/* Huddle banner */}
            {isHuddleActiveHere && (
              <div className="mx-3 mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] flex items-center justify-between shrink-0">
                <span>🔊 Huddle · <span className="font-semibold">{activeHuddle.startedBy?.username}</span></span>
                <div className="flex items-center gap-2">
                  {!huddleJoined && !huddleConnecting && (
                    <button type="button" onClick={() => rtc?.joinHuddle?.()} className="text-[10px] border border-amber-300 rounded-lg px-2 py-1 bg-white active:bg-amber-50">Join</button>
                  )}
                  {huddleJoined && <span className="text-amber-700 font-medium">You&apos;re in</span>}
                </div>
              </div>
            )}

            {/* Editing banner */}
            {editingMessageId && (
              <div className="mx-3 mt-2 px-3 py-1.5 bg-amber-50 border-l-2 border-amber-400 rounded text-[11px] flex items-center justify-between shrink-0">
                <span className="text-amber-700 font-medium">Editing message</span>
                <button type="button" onClick={handleCancelEdit} className="text-amber-600 text-[10px] underline">Cancel</button>
              </div>
            )}

            {/* Messages */}
            <div
              ref={listRef}
              onScroll={handleScrollMessages}
              className="flex-1 overflow-y-auto px-3 py-3"
              style={{ scrollbarWidth: "none" }}
            >
              {loadingHistory && activeMessages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-[12px] text-slate-400">Loading...</div>
                </div>
              ) : messagesToRender.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                    <MessageSquare size={24} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-600">No messages yet</div>
                    <div className="text-[12px] text-slate-400 mt-1">Say hi 👋</div>
                  </div>
                </div>
              ) : (
                messagesToRender.map((m, idx) => {
                  const isSystem = m.system;
                  const isOwn = !m.system && String(m.userId || m.user_id) === String(user.id);
                  const time = m.createdAt
                    ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                    : "";

                  const prev = messagesToRender[idx - 1];
                  const prevDate = prev?.createdAt ? new Date(prev.createdAt).toDateString() : null;
                  const thisDate = m.createdAt ? new Date(m.createdAt).toDateString() : null;
                  const showDateDivider = thisDate && thisDate !== prevDate;
                  const dateDividerLabel = thisDate ? formatDateLabel(m.createdAt) : null;

                  const FIVE_MIN = 5 * 60 * 1000;
                  const prevNonSystem = messagesToRender.slice(0, idx).filter(x => !x.system).at(-1);
                  const isGrouped =
                    !isSystem &&
                    prevNonSystem &&
                    (prevNonSystem.userId || prevNonSystem.user_id) === (m.userId || m.user_id) &&
                    m.createdAt && prevNonSystem.createdAt &&
                    (new Date(m.createdAt) - new Date(prevNonSystem.createdAt)) < FIVE_MIN;

                  const reactions = m.reactions || {};
                  const reactionEntries = Object.entries(reactions);

                  return (
                    <div key={m.id}>
                      {showDateDivider && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-slate-100" />
                          <span className="text-[10px] text-slate-400 font-medium">{dateDividerLabel}</span>
                          <div className="flex-1 h-px bg-slate-100" />
                        </div>
                      )}

                      {isSystem ? (
                        <div className="flex items-center justify-center my-1.5">
                          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-0.5">
                            {m.textHtml || m.text}
                          </span>
                        </div>
                      ) : (
                        <div className={`flex gap-2.5 ${isGrouped ? "pt-0.5" : "pt-3"}`}>
                          {isGrouped ? (
                            <div className="w-8 shrink-0" />
                          ) : (
                            <div className="w-8 shrink-0 mt-0.5">
                              <Avatar name={m.username || "User"} src={userAvatarMap[m.userId || m.user_id]} size="sm" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {!isGrouped && (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`text-[13px] font-bold ${isOwn ? "text-blue-700" : "text-slate-800"}`}>
                                  {isOwn ? "You" : m.username || "User"}
                                </span>
                                <span className="text-[10px] text-slate-400 tabular-nums">{time}</span>
                                {m.username === "AI Assistant" && (
                                  <span className="text-[9px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-medium">AI</span>
                                )}
                              </div>
                            )}

                            {m.deletedAt ? (
                              <div className="text-[12px] text-slate-300 italic flex items-center gap-1.5">
                                <span>🚫</span> <span>Deleted</span>
                              </div>
                            ) : (
                              <>
                                {(m.textHtml || m.text) && (
                                  <div
                                    className="text-[14px] text-slate-700 leading-relaxed break-words chat-prose"
                                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                                    dangerouslySetInnerHTML={{ __html: m.textHtml || m.text || "" }}
                                  />
                                )}

                                {/* Attachments */}
                                {(m.attachments || []).length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {(m.attachments || []).map((att, ai) => {
                                      const fullUrl = resolveUrl(att.url) || att.url;
                                      const isImage = att.type?.startsWith("image/");
                                      const isVideo = att.type?.startsWith("video/");
                                      return (
                                        <div key={ai}>
                                          {isImage && (
                                            <a href={fullUrl} target="_blank" rel="noreferrer">
                                              <img src={fullUrl} alt={att.name} className="max-h-48 max-w-full rounded-2xl object-contain border border-slate-200 shadow-sm" />
                                            </a>
                                          )}
                                          {isVideo && <video src={fullUrl} controls className="max-h-48 max-w-full rounded-2xl shadow-sm" />}
                                          {!isImage && !isVideo && (
                                            <a href={fullUrl} download={att.name} target="_blank" rel="noreferrer"
                                              className="inline-flex items-center gap-2 text-[12px] text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                              <span>📄</span>
                                              <div>
                                                <div className="font-medium truncate max-w-[160px]">{att.name}</div>
                                                {att.size && <div className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)} KB</div>}
                                              </div>
                                            </a>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Reactions */}
                                {reactionEntries.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {reactionEntries.map(([emoji, info]) => {
                                      const userIds = info.userIds || [];
                                      const count = typeof info.count === "number" ? info.count : userIds.length;
                                      const hasReacted = userIds.includes(user.id);
                                      return (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => handleToggleReaction(m.id, emoji)}
                                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[13px] border transition-all ${
                                            hasReacted
                                              ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                                              : "bg-white border-slate-200 text-slate-600"
                                          }`}
                                        >
                                          <span>{emoji}</span>
                                          <span className="text-[11px]">{count}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* Inline reaction picker (tap emoji button in toolbar) */}
                                {openReactionFor === m.id && (
                                  <div className="mt-2 flex flex-wrap gap-1.5 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-30">
                                    {QUICK_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleAddReactionFromPicker(m.id, emoji)}
                                        className="text-xl px-1.5 py-1 hover:bg-slate-100 rounded-xl transition-colors"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Thread replies */}
                                {replyCountById[m.id] > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenThread(m)}
                                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 bg-blue-50 rounded-full px-3 py-1.5"
                                  >
                                    <MessageSquare size={12} />
                                    {replyCountById[m.id]} repl{replyCountById[m.id] === 1 ? "y" : "ies"}
                                  </button>
                                )}
                              </>
                            )}

                            {/* Per-message action row (always visible on mobile) */}
                            {!m.deletedAt && activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
                              <div className="mt-1.5 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReactionPicker(m.id)}
                                  className="p-1.5 rounded-lg bg-slate-50 text-slate-400 active:bg-slate-100 text-[15px]"
                                >
                                  <Smile size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenThread(m)}
                                  className="p-1.5 rounded-lg bg-slate-50 text-slate-400 active:bg-slate-100"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                {isOwn && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleStartEditMessage(m);
                                      // For mobile, pre-fill the textarea with current text
                                      const plain = m.textHtml
                                        ? m.textHtml.replace(/<[^>]+>/g, "")
                                        : m.text || "";
                                      setMobileText(plain);
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-50 text-slate-400 active:bg-slate-100 text-sm"
                                  >
                                    ✏️
                                  </button>
                                )}
                                {isOwn && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(m.id)}
                                    className="p-1.5 rounded-lg bg-slate-50 text-red-300 active:bg-red-50 text-sm"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Typing indicator */}
            {typingUsernames.length > 0 && (
              <div className="px-4 py-1.5 text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span>
                  {typingUsernames.length === 1
                    ? `${typingUsernames[0]} is typing…`
                    : `${typingUsernames.join(", ")} are typing…`}
                </span>
              </div>
            )}

            {/* Pending attachment previews */}
            {pendingAttachments.length > 0 && (
              <div className="px-3 pt-2 pb-0 flex flex-wrap gap-2 shrink-0">
                {pendingAttachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]">
                    {att.type?.startsWith("image/") ? (
                      <img src={`${BACKEND_URL}${att.url}`} alt={att.name} className="h-8 w-8 object-cover rounded" />
                    ) : (
                      <span>📎</span>
                    )}
                    <span className="max-w-[100px] truncate text-slate-600">{att.name}</span>
                    <button type="button" onClick={() => handleRemovePendingAttachment(i)} className="text-slate-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Slack-style rich text composer ── */}
            <div className="px-3 pt-2 pb-3 bg-white border-t border-slate-100 shrink-0">
              {activeChannelKey !== AVAILABILITY_CHANNEL_KEY ? (
                <form onSubmit={handleSend}>
                  {/* Composer box: editor + formatting bar */}
                  <div
                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-300 transition-all shadow-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && editingMessageId) handleCancelEdit();
                    }}
                  >
                    {/* Editing banner inside composer */}
                    {editingMessageId && (
                      <div className="px-3 py-1 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-[11px]">
                        <span className="text-amber-700 font-medium">Editing message</span>
                        <button type="button" onClick={handleCancelEdit} className="text-amber-500 underline">Cancel</button>
                      </div>
                    )}

                    {/* ReactQuill rich text editor (no built-in toolbar) */}
                    <ReactQuill
                      ref={mobileQuillRef}
                      theme="snow"
                      value={editorHtml}
                      onChange={(val) => {
                        handleEditorChange(val);
                        // Typing indicator
                        const now = Date.now();
                        if (now - lastTypingSentRef.current > 2000 && val.replace(/<[^>]*>/g, "").trim().length > 0) {
                          lastTypingSentRef.current = now;
                          sendTyping(activeChannelKey);
                        }
                      }}
                      modules={{ toolbar: false }}
                      formats={quillFormats}
                      placeholder={connected ? `Message ${isDmChannel && activeDmUser ? activeDmUser.username : activeChannelTitle}…` : "Connecting..."}
                      className="mobile-quill"
                    />

                    {/* Formatting + action bar — Slack style */}
                    <div className="flex items-center px-2 py-1.5 border-t border-slate-100 bg-slate-50/70 gap-0.5">
                      {/* Bold */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const q = mobileQuillRef.current?.getEditor();
                          if (q) q.format("bold", !q.getFormat().bold);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-[14px] font-bold text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Bold"
                      >B</button>
                      {/* Italic */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const q = mobileQuillRef.current?.getEditor();
                          if (q) q.format("italic", !q.getFormat().italic);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-[14px] italic text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Italic"
                      >I</button>
                      {/* Strikethrough */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const q = mobileQuillRef.current?.getEditor();
                          if (q) q.format("strike", !q.getFormat().strike);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Strikethrough"
                      ><span className="text-[13px] line-through font-medium">S</span></button>
                      {/* Inline code */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const q = mobileQuillRef.current?.getEditor();
                          if (q) q.format("code", !q.getFormat().code);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl font-mono text-[13px] text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Inline code"
                      >{"`"}</button>
                      {/* Bullet list */}
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const q = mobileQuillRef.current?.getEditor();
                          if (q) {
                            const cur = q.getFormat().list;
                            q.format("list", cur === "bullet" ? false : "bullet");
                          }
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Bullet list"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <circle cx="2.5" cy="4" r="1" fill="currentColor" stroke="none"/>
                          <circle cx="2.5" cy="8" r="1" fill="currentColor" stroke="none"/>
                          <circle cx="2.5" cy="12" r="1" fill="currentColor" stroke="none"/>
                          <line x1="5.5" y1="4" x2="14" y2="4"/>
                          <line x1="5.5" y1="8" x2="14" y2="8"/>
                          <line x1="5.5" y1="12" x2="14" y2="12"/>
                        </svg>
                      </button>

                      <div className="w-px h-5 bg-slate-200 mx-1 shrink-0" />

                      {/* Attach */}
                      <button
                        type="button"
                        onClick={handleAttachmentClick}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 active:bg-slate-200 hover:bg-slate-200 transition-colors"
                        title="Attach file"
                      >
                        <Paperclip size={16} />
                      </button>

                      {/* Send button */}
                      <button
                        type="submit"
                        disabled={!connected || (!editorHtml.trim() && pendingAttachments.length === 0) || sending || uploadingAttachment}
                        className="ml-auto w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:bg-blue-700 shadow-sm transition-colors"
                      >
                        {sending ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Send size={15} />
                        )}
                      </button>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleAttachmentChange} />
                </form>
              ) : (
                <div className="text-center py-3 text-[12px] text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                  Read-only channel
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── THREAD OVERLAY (full-screen, slides over chat) ── */}
        {mobileView === "chat" && activeThreadKey && threadRootMessage && (
          <div
            className="absolute inset-0 bg-white flex flex-col z-20"
            style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
          >
            {/* Thread header */}
            <header className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCloseThread}
                className="p-1.5 -ml-1.5 text-slate-500 active:text-slate-800"
              >
                <ChevronLeft size={22} />
              </button>
              <div>
                <div className="text-[15px] font-semibold text-slate-800">Thread</div>
                <div className="text-[11px] text-slate-400">
                  in {threadParentChannel ? `#${threadParentChannel.name}` : "this channel"}
                </div>
              </div>
            </header>

            {/* Root message */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={threadRootMessage.username || "User"} src={userAvatarMap[threadRootMessage.userId || threadRootMessage.user_id]} size="sm" />
                <span className="text-[13px] font-semibold text-slate-700">
                  {threadRootMessage.username === user.username ? "You" : threadRootMessage.username || "User"}
                </span>
              </div>
              <div
                className="text-[13px] text-slate-600 leading-relaxed break-words line-clamp-4 chat-prose"
                dangerouslySetInnerHTML={{ __html: threadRootMessage.textHtml || threadRootMessage.text || "" }}
              />
            </div>

            {/* Thread replies */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {threadMessages.length === 0 ? (
                <div className="text-[12px] text-slate-400 text-center mt-10">
                  No replies yet — start the conversation
                </div>
              ) : (
                threadMessages.map((m) => {
                  const isOwn = String(m.userId || m.user_id) === String(user.id);
                  const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                  return (
                    <div key={m.id} className="flex gap-2.5">
                      <div className="w-8 shrink-0 mt-0.5">
                        <Avatar name={m.username || "User"} src={userAvatarMap[m.userId || m.user_id]} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className={`text-[13px] font-bold ${isOwn ? "text-blue-700" : "text-slate-800"}`}>
                            {isOwn ? "You" : m.username || "User"}
                          </span>
                          <span className="text-[10px] text-slate-400 tabular-nums">{time}</span>
                        </div>
                        {(m.textHtml || m.text) && (
                          <div
                            className="text-[14px] text-slate-700 leading-relaxed break-words chat-prose"
                            style={{ wordBreak: "break-word" }}
                            dangerouslySetInnerHTML={{ __html: m.textHtml || m.text || "" }}
                          />
                        )}
                        {(m.attachments || []).length > 0 && (
                          <div className="mt-2 flex flex-col gap-1">
                            {(m.attachments || []).map((att, ai) => {
                              const fullUrl = resolveUrl(att.url) || att.url;
                              const isImage = att.type?.startsWith("image/");
                              return (
                                <div key={ai}>
                                  {isImage && <a href={fullUrl} target="_blank" rel="noreferrer"><img src={fullUrl} alt={att.name} className="max-h-40 max-w-full rounded-xl border border-slate-200" /></a>}
                                  {!isImage && (
                                    <a href={fullUrl} download={att.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12px] text-blue-600">
                                      <span>📎</span><span className="truncate max-w-[180px]">{att.name}</span>
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Thread composer — rich text */}
            <form onSubmit={handleSendThread} className="border-t border-slate-100 px-3 pt-2 pb-3 shrink-0 bg-white">
              <div className="border border-slate-200 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:border-blue-300 transition-all">
                <ReactQuill
                  theme="snow"
                  value={threadEditorHtml}
                  onChange={handleThreadEditorChange}
                  modules={{ toolbar: false }}
                  formats={quillFormats}
                  placeholder="Reply in thread…"
                  className="mobile-quill"
                />
                <div className="flex items-center px-2 py-1.5 border-t border-slate-100 bg-slate-50/70">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); }}
                    className="text-[11px] text-slate-400 px-2"
                  >
                    <span className="italic">Aa</span>
                  </button>
                  <button
                    type="submit"
                    disabled={!connected || !(threadEditorHtml || "").replace(/<[^>]*>/g, "").trim()}
                    className="ml-auto w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white disabled:opacity-30 active:bg-blue-700 shadow-sm"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Modals (shared between list/chat views) */}
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
            if (activeChannelKey === channelKey) setActiveChannelKey(GENERAL_CHANNEL_KEY);
            loadChannels();
          }}
          onDelete={(channelKey) => {
            setOpenSettings(false);
            if (activeChannelKey === channelKey) setActiveChannelKey(GENERAL_CHANNEL_KEY);
            loadChannels();
          }}
        />
        <ReportsModal open={reportsOpen} onClose={() => setReportsOpen(false)} context={reportsContext} />
      </div>
    );
  }
  // ========================================================
  // END MOBILE LAYOUT — desktop continues below
  // ========================================================

  return (
    <div className="h-full flex overflow-hidden rounded-xl shadow-lg">

      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ===== LEFT SIDEBAR — dark ===== */}
      <aside className={`
        bg-slate-900 flex flex-col shrink-0 z-50
        fixed inset-y-0 left-0 w-72 transition-transform duration-300 ease-out
        md:relative md:w-60 md:translate-x-0
        ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* App header */}
        <div className="px-4 py-3.5 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-slate-100 font-bold text-sm tracking-tight">Workspace</span>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} title={statusLabel} />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="md:hidden text-slate-400 hover:text-slate-200 p-1 -mr-1"
              >
                <XIcon size={16} />
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">{user.username}</div>
        </div>

        {/* AI Toggle */}
        <div className="px-4 py-2.5 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🤖</span>
              <div>
                <div className="text-[11px] text-slate-200 font-medium">AI Assistant</div>
                <div className="text-[10px] text-slate-500">Auto-reply</div>
              </div>
            </div>
            <button
              type="button"
              disabled={loadingAiPref}
              onClick={async () => {
                const next = !aiReplyEnabled;
                setAiReplyEnabled(next);
                try {
                  setLoadingAiPref(true);
                  await api.put(`/users/${user.id}/ai-preference`, { aiReplyEnabled: next });
                } catch {
                  toast.error("Failed to update AI preference");
                  setAiReplyEnabled(!next);
                } finally {
                  setLoadingAiPref(false);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${aiReplyEnabled ? "bg-blue-500" : "bg-slate-600"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${aiReplyEnabled ? "translate-x-4" : "translate-x-1"}`} />
            </button>
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto py-3">

          {/* CHANNELS section header */}
          <div className="px-4 pt-1 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Channels</span>
            <button
              type="button"
              onClick={() => setOpenCreate(true)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Create channel"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Pinned system channels */}
          {[
            { key: GENERAL_CHANNEL_KEY, label: "team-general" },
            { key: AVAILABILITY_CHANNEL_KEY, label: "availability-updates" },
            { key: PROJECT_MANAGER_CHANNEL_KEY, label: "project-manager" },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => key === GENERAL_CHANNEL_KEY ? handleSelectGeneral() : handleSelectChannel(key)}
              className={`w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors ${
                activeChannelKey === key
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <span className="flex items-center gap-2 text-[12px] min-w-0">
                <Hash size={12} className="shrink-0 text-slate-500" />
                <span className="truncate">{label}</span>
              </span>
              {(unreadByChannel[key] || 0) > 0 && (
                <span className="ml-1 text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                  {unreadByChannel[key]}
                </span>
              )}
            </button>
          ))}

          {/* Public channels */}
          {publicChannels.map((ch) => {
            const isActive = activeChannelKey === ch.key;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleSelectChannel(ch.key)}
                className={`group/ch w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors ${
                  isActive ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-2 text-[12px] flex-1 min-w-0">
                  <Hash size={12} className="shrink-0 text-slate-500" />
                  <span className="truncate">{ch.name}</span>
                  {(unreadByChannel[ch.key] || 0) > 0 && (
                    <span className="ml-1 text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                      {unreadByChannel[ch.key]}
                    </span>
                  )}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setSettingsChannel(ch); setOpenSettings(true); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSettingsChannel(ch); setOpenSettings(true); } }}
                  className="opacity-0 group-hover/ch:opacity-100 text-slate-500 hover:text-slate-200 transition-opacity shrink-0 ml-1"
                  title={`Settings for ${ch.name}`}
                >
                  <Settings size={11} />
                </span>
              </button>
            );
          })}

          {/* Slack imported channels — grouped by prefix */}
          {slackChannelGroups.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Slack</span>
              </div>
              {slackChannelGroups.map(([prefix, chs]) => {
                const isCollapsed = collapsedSlackGroups[prefix];
                const groupUnread = chs.reduce((sum, ch) => sum + (unreadByChannel[ch.key] || 0), 0);
                return (
                  <div key={prefix}>
                    <button
                      type="button"
                      onClick={() => setCollapsedSlackGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }))}
                      className="w-full flex items-center gap-1.5 px-4 py-1 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span className="text-[9px]">{isCollapsed ? "▶" : "▼"}</span>
                      <span className="text-[11px] font-medium capitalize flex-1 text-left">{prefix}</span>
                      {groupUnread > 0 && (
                        <span className="text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                          {groupUnread}
                        </span>
                      )}
                    </button>
                    {!isCollapsed && chs.map((ch) => {
                      const isActive = activeChannelKey === ch.key;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => handleSelectChannel(ch.key)}
                          className={`group/ch w-full flex items-center justify-between pl-7 pr-4 py-1.5 text-left transition-colors ${
                            isActive ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          <span className="flex items-center gap-2 text-[12px] flex-1 min-w-0">
                            <Hash size={11} className="shrink-0 text-slate-500" />
                            <span className="truncate">{ch.name}</span>
                            {(unreadByChannel[ch.key] || 0) > 0 && (
                              <span className="ml-1 text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                                {unreadByChannel[ch.key]}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* Private channels */}
          {privateChannels.length > 0 && (
            <>
              <div className="px-4 pt-4 pb-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                  <Lock size={9} /> Private
                </span>
              </div>
              {privateChannels.map((ch) => {
                const isActive = activeChannelKey === ch.key;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSelectChannel(ch.key)}
                    className={`group/ch w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors ${
                      isActive ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[12px] flex-1 min-w-0">
                      <Lock size={11} className="shrink-0 text-slate-500" />
                      <span className="truncate">{ch.name}</span>
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setSettingsChannel(ch); setOpenSettings(true); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setSettingsChannel(ch); setOpenSettings(true); } }}
                      className="opacity-0 group-hover/ch:opacity-100 text-slate-500 hover:text-slate-200 transition-opacity shrink-0 ml-1"
                    >
                      <Settings size={11} />
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* DMs section */}
          <div className="px-4 pt-4 pb-1.5">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Direct Messages</span>
          </div>

          {loadingUsers ? (
            <div className="px-4 text-[11px] text-slate-500">Loading...</div>
          ) : sortedTeammates.length === 0 ? (
            <div className="px-4 text-[11px] text-slate-500">No teammates yet.</div>
          ) : (
            sortedTeammates.map((u) => {
              const presence = presenceMap[u.id]?.status || "offline";
              const color = presenceColor(presence);
              const dmKey = dmKeyFor(user.id, u.id);
              const isActive = activeChannelKey === dmKey;
              const unread = unreadByChannel[dmKey] || 0;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelectDm(u)}
                  className={`w-full flex items-center justify-between px-4 py-1.5 text-left transition-colors ${
                    isActive ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      {u.avatar_url ? (
                        <FetchImg src={resolveUrl(u.avatar_url)} alt={u.username} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-semibold text-slate-200">
                          {u.username?.[0]?.toUpperCase() || "?"}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-slate-900 ${color}`} />
                    </div>
                    <span className="text-[12px] font-medium truncate">{u.username}</span>
                  </div>
                  {unread > 0 ? (
                    <span className="text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">
                      {unread}
                    </span>
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
                  )}
                </button>
              );
            })
          )}

          <div className="h-4" />
        </nav>

        {/* ── Your profile footer ── */}
        <div className="px-4 py-3 border-t border-slate-700/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              {user.avatar_url ? (
                <FetchImg src={resolveUrl(user.avatar_url)} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-[12px] font-bold">
                  {user.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-slate-200 truncate">{user.username}</div>
              <div className="text-[10px] text-slate-500 capitalize truncate">{user.role || "member"}</div>
            </div>
            <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-400" : "bg-red-400"}`} title={statusLabel} />
          </div>
        </div>
      </aside>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className="flex-1 flex flex-col bg-white min-w-0 relative">

        {/* Disconnect banner */}
        {!connected && !joining && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-[11px] font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-200 animate-pulse" />
            <span>Disconnected — trying to reconnect…</span>
          </div>
        )}

        {/* Channel header */}
        <header className="px-3 md:px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden shrink-0 text-slate-500 hover:text-slate-700 p-1 -ml-1"
            >
              <Menu size={20} />
            </button>
            {isDmChannel && activeDmUser ? (
              <div className="relative shrink-0">
                <Avatar name={activeDmUser.username} src={userAvatarMap[activeDmUser.id]} size="sm" />
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white ${dmPresenceClass}`} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                <Hash size={15} className="text-slate-500" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-800 text-sm truncate">{activeChannelTitle}</h1>
              <p className="text-[11px] text-slate-400 truncate">
                {isDmChannel
                  ? dmPresenceText
                  : activeChannelKey === AVAILABILITY_CHANNEL_KEY
                  ? "Read-only — attendance events"
                  : activeChannel?.description || "Team channel"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="hidden md:block text-xs border border-slate-200 rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent bg-slate-50"
            />
            {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && (
              <button
                type="button"
                onClick={handleToggleHuddle}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 md:px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isHuddleActiveHere
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>🔊</span>
                <span className="hidden md:inline">{huddleButtonLabel}</span>
              </button>
            )}
            {!isDmChannel && (
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500 border border-slate-200 rounded-lg px-2.5 py-1.5">
                <Users size={12} className="text-slate-400" />
                <span>{Object.values(presenceMap).filter(p => p.status === "online" || p.status === "available").length} online</span>
              </div>
            )}
          </div>
        </header>

        {/* Huddle banner */}
        {isHuddleActiveHere && (
          <div className="mx-4 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] flex items-center justify-between shrink-0">
            <div>
              <span>🔊 Huddle in progress · started by <span className="font-semibold">{activeHuddle.startedBy?.username}</span></span>
              {huddleError && <div className="text-[10px] text-red-600 mt-0.5">{huddleError}</div>}
            </div>
            <div className="flex items-center gap-2">
              {huddleConnecting && <span className="text-[10px] text-slate-500">Joining...</span>}
              {!huddleJoined && !huddleConnecting && (
                <button type="button" onClick={() => rtc?.joinHuddle?.()} className="text-[10px] border border-amber-300 rounded px-2 py-1 hover:bg-amber-100">
                  Join huddle
                </button>
              )}
              {huddleJoined && <span className="text-[10px] text-amber-700">You&apos;re in this huddle</span>}
            </div>
          </div>
        )}

        {/* Editing banner */}
        {editingMessageId && (
          <div className="mx-4 mt-2 px-3 py-1.5 bg-amber-50 border-l-2 border-amber-400 rounded text-[11px] flex items-center justify-between shrink-0">
            <span className="text-amber-700 font-medium">Editing message</span>
            <button type="button" onClick={handleCancelEdit} className="text-amber-600 hover:text-amber-800 text-[10px] underline">Cancel</button>
          </div>
        )}

        {/* ===== MESSAGES ===== */}
        <div ref={listRef} onScroll={handleScrollMessages} className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          {loadingHistory && activeMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-[12px] text-slate-400">Loading conversation...</div>
            </div>
          ) : messagesToRender.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <MessageSquare size={20} className="text-slate-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-600">No messages yet</div>
                <div className="text-[11px] text-slate-400 mt-1">Be the first to say hi 👋</div>
              </div>
            </div>
          ) : (
            messagesToRender.map((m, idx) => {
              const isSystem = m.system;
              const isOwn = !m.system && String(m.userId || m.user_id) === String(user.id);
              const time = m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "";

              const prev = messagesToRender[idx - 1];
              const prevDate = prev?.createdAt ? new Date(prev.createdAt).toDateString() : null;
              const thisDate = m.createdAt ? new Date(m.createdAt).toDateString() : null;
              const showDateDivider = thisDate && thisDate !== prevDate;
              const dateDividerLabel = thisDate ? formatDateLabel(m.createdAt) : null;

              const FIVE_MIN = 5 * 60 * 1000;
              const prevNonSystem = messagesToRender.slice(0, idx).filter(x => !x.system).at(-1);
              const isGrouped =
                !isSystem &&
                prevNonSystem &&
                (prevNonSystem.userId || prevNonSystem.user_id) === (m.userId || m.user_id) &&
                m.createdAt && prevNonSystem.createdAt &&
                (new Date(m.createdAt) - new Date(prevNonSystem.createdAt)) < FIVE_MIN;

              const isLastOwn = isOwn && m.id === lastMessageId;
              const readers = isLastOwn ? getReadersForMessage(m.createdAt) : [];
              const reactions = m.reactions || {};
              const reactionEntries = Object.entries(reactions);

              return (
                <div key={m.id}>
                  {/* Date divider */}
                  {showDateDivider && (
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] text-slate-400 font-medium px-2 bg-white">{dateDividerLabel}</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>
                  )}

                  {/* System message */}
                  {isSystem ? (
                    <div className="flex items-center justify-center my-1.5">
                      <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-0.5">
                        {m.textHtml || m.text}
                      </span>
                      {time && <span className="text-[9px] text-slate-300 ml-2">{time}</span>}
                    </div>
                  ) : (
                    /* ── Normal message row — full-width hover highlight ── */
                    <div className={`group relative -mx-5 px-5 hover:bg-slate-50/80 transition-colors rounded ${isGrouped ? "py-0.5" : "pt-3 pb-0.5"}`}>
                      <div className="flex gap-3">
                        {/* Avatar or grouped time hint */}
                        {isGrouped ? (
                          <div className="w-8 shrink-0 flex items-start justify-center pt-1">
                            <span className="text-[9px] text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity leading-4 tabular-nums">{time}</span>
                          </div>
                        ) : (
                          <div className="w-8 shrink-0 mt-0.5 cursor-pointer">
                            <Avatar name={m.username || "User"} src={userAvatarMap[m.userId || m.user_id]} size="sm" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 pr-20">
                          {/* Sender name + timestamp */}
                          {!isGrouped && (() => {
                            // For standup channel: show project name as sender instead of system user
                            const isStandup = activeChannelKey === "daily-standups";
                            const standupProject = isStandup
                              ? (m.textHtml || "").match(/📋\s*(.+?)\s*(?:—|-)\s*Daily Standup/)?.[1] || null
                              : null;
                            const displayName = isOwn
                              ? "You"
                              : standupProject
                              ? standupProject
                              : m.username || "User";
                            return (
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className={`text-[13px] font-bold ${isOwn ? "text-blue-700" : standupProject ? "text-indigo-700" : "text-slate-800"}`}>
                                  {displayName}
                                </span>
                                <span className="text-[10px] text-slate-400 tabular-nums">{time}</span>
                                {standupProject && (
                                  <span className="text-[9px] bg-indigo-50 text-indigo-500 rounded-full px-1.5 py-0.5 font-medium">Standup</span>
                                )}
                                {!standupProject && m.username === "AI Assistant" && (
                                  <span className="text-[9px] bg-violet-100 text-violet-600 rounded-full px-1.5 py-0.5 font-medium">AI</span>
                                )}
                              </div>
                            );
                          })()}

                          {m.deletedAt ? (
                            <div className="text-[12px] text-slate-300 italic flex items-center gap-1.5">
                              <span>🚫</span> <span>This message was deleted.</span>
                            </div>
                          ) : (
                            <>
                              {(m.textHtml || m.text) && (
                                <div
                                  className="text-[13px] text-slate-700 leading-relaxed break-words chat-prose"
                                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                                  dangerouslySetInnerHTML={{ __html: m.textHtml || m.text || "" }}
                                />
                              )}

                              {/* Attachments */}
                              {(m.attachments || []).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(m.attachments || []).map((att, ai) => {
                                    const BACKEND = _BACKEND;
                                    const fullUrl = att.url?.startsWith("http") ? att.url : `${BACKEND}${att.url}`;
                                    const isImage = att.type?.startsWith("image/");
                                    const isVideo = att.type?.startsWith("video/");
                                    const isAudio = att.type?.startsWith("audio/");
                                    return (
                                      <div key={ai}>
                                        {isImage && (
                                          <a href={fullUrl} target="_blank" rel="noreferrer">
                                            <img src={fullUrl} alt={att.name} className="max-h-52 max-w-sm rounded-xl object-contain border border-slate-200 hover:brightness-95 transition-all shadow-sm" />
                                          </a>
                                        )}
                                        {isVideo && <video src={fullUrl} controls className="max-h-52 max-w-sm rounded-xl shadow-sm" />}
                                        {isAudio && <audio src={fullUrl} controls className="w-64 mt-1" />}
                                        {!isImage && !isVideo && !isAudio && (
                                          <a href={fullUrl} download={att.name} target="_blank" rel="noreferrer"
                                            className="inline-flex items-center gap-2 text-[12px] text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2.5 shadow-sm hover:shadow transition-all">
                                            <span className="text-base">📄</span>
                                            <div>
                                              <div className="font-medium truncate max-w-[180px]">{att.name}</div>
                                              {att.size && <div className="text-[10px] text-slate-400">{(att.size / 1024).toFixed(0)} KB</div>}
                                            </div>
                                          </a>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Reactions row */}
                              {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && reactionEntries.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {reactionEntries.map(([emoji, info]) => {
                                    const userIds = info.userIds || [];
                                    const count = typeof info.count === "number" ? info.count : userIds.length;
                                    const hasReacted = userIds.includes(user.id);
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={() => handleToggleReaction(m.id, emoji)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all ${
                                          hasReacted
                                            ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold shadow-sm"
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                                        }`}
                                      >
                                        <span>{emoji}</span>
                                        <span className="text-[11px]">{count}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Inline reaction picker */}
                              {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && openReactionFor === m.id && (
                                <div className="mt-2 inline-flex flex-wrap gap-1 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30">
                                  {QUICK_REACTIONS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleAddReactionFromPicker(m.id, emoji)}
                                      className="text-lg px-1.5 py-0.5 hover:bg-slate-100 rounded-xl transition-colors hover:scale-125 transform"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* Thread replies pill */}
                              {replyCountById[m.id] > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenThread(m)}
                                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition-colors"
                                >
                                  <MessageSquare size={11} />
                                  {replyCountById[m.id]} repl{replyCountById[m.id] === 1 ? "y" : "ies"}
                                </button>
                              )}

                              {/* Read receipts */}
                              {isLastOwn && !m.deletedAt && (
                                <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
                                  <span>{readers.length === 0 ? "✓ Delivered" : `✓✓ Seen by ${readers.map(r => r.username).join(", ")}`}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* ── Right-side action toolbar (appears on row hover) ── */}
                      {activeChannelKey !== AVAILABILITY_CHANNEL_KEY && !m.deletedAt && (
                        <div className="absolute top-1.5 right-4 hidden group-hover:flex items-center bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden z-20">
                          <button
                            type="button"
                            onClick={() => handleOpenReactionPicker(m.id)}
                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-r border-slate-100"
                            title="Add reaction"
                          >
                            <Smile size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenThread(m)}
                            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-r border-slate-100"
                            title="Reply in thread"
                          >
                            <MessageSquare size={14} />
                          </button>
                          {m.username === "AI Assistant" && (
                            <button
                              type="button"
                              onClick={() => handleExplainAI(m.id)}
                              disabled={aiExplainLoading === m.id}
                              className="p-2 hover:bg-violet-50 text-slate-400 hover:text-violet-600 transition-colors border-r border-slate-100 text-sm leading-none"
                              title="Why this reply?"
                            >
                              🧠
                            </button>
                          )}
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => handleStartEditMessage(m)}
                              className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border-r border-slate-100 text-sm leading-none"
                              title="Edit message"
                            >
                              ✏️
                            </button>
                          )}
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.id)}
                              className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors text-sm leading-none"
                              title="Delete message"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-28 right-8 z-20 flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-[11px] font-medium px-3 py-2 rounded-full shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all"
          >
            ↓ Jump to latest
          </button>
        )}

        {/* Typing indicator */}
        {typingUsernames.length > 0 && (
          <div className="px-5 py-1 text-[11px] text-slate-400 flex items-center gap-2 shrink-0">
            <div className="flex gap-0.5">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span>
              {typingUsernames.length === 1
                ? `${typingUsernames[0]} is typing...`
                : `${typingUsernames.join(", ")} are typing...`}
            </span>
          </div>
        )}

        {/* ===== COMPOSER ===== */}
        <div className="px-4 pb-4 pt-1 shrink-0">
          {activeChannelKey !== AVAILABILITY_CHANNEL_KEY ? (
            <form onSubmit={handleSend}>
              {/* @mention dropdown */}
              {mentionQuery !== null && (
                <div className="relative mb-1">
                  <div className="absolute bottom-0 left-0 z-50 bg-white border border-slate-200 rounded-xl shadow-lg w-56 max-h-44 overflow-y-auto">
                    {users
                      .filter(u => u.id !== user.id && u.role !== "system" && !u.is_system && u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
                      .slice(0, 8)
                      .map(u => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-left"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const replaced = editorHtml.replace(
                              /@\w*((?:<\/[^>]+>)*)$/,
                              (_, closingTags) => `@${u.username} ${closingTags || ""}`
                            );
                            setEditorHtml(replaced);
                            setMentionQuery(null);
                          }}
                        >
                          {u.avatar_url ? (
                            <FetchImg src={resolveUrl(u.avatar_url)} alt={u.username} className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-semibold">{u.username?.[0]?.toUpperCase()}</div>
                          )}
                          <span className="text-[12px] font-medium">{u.username}</span>
                          <span className="text-[10px] text-slate-400 capitalize ml-auto">{u.role}</span>
                        </button>
                      ))}
                    {users.filter(u => u.id !== user.id && u.role !== "system" && !u.is_system && u.username.toLowerCase().startsWith(mentionQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-slate-400">No matches</div>
                    )}
                  </div>
                </div>
              )}

              {/* Pending attachment previews */}
              {pendingAttachments.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingAttachments.map((att, i) => {
                    const isImage = att.type?.startsWith("image/");
                    return (
                      <div key={i} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]">
                        {isImage ? (
                          <img src={`${BACKEND_URL}${att.url}`} alt={att.name} className="h-8 w-8 object-cover rounded" />
                        ) : (
                          <span>📎</span>
                        )}
                        <span className="max-w-[120px] truncate text-slate-600">{att.name}</span>
                        <button type="button" onClick={() => handleRemovePendingAttachment(i)} className="text-slate-300 hover:text-red-400 ml-0.5">✕</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Integrated composer box */}
              <div
                className="border border-slate-200 rounded-xl bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-300 focus-within:border-blue-300 transition-shadow"
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === "Enter") {
                    e.preventDefault();
                    handleSend(e);
                  }
                  if (e.key === "Escape" && editingMessageId) {
                    handleCancelEdit();
                  }
                }}
              >
                <ReactQuill
                  theme="snow"
                  value={editorHtml}
                  onChange={handleEditorChange}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder={connected ? `Message ${isDmChannel && activeDmUser ? activeDmUser.username : activeChannelTitle}… (Ctrl+Enter to send)` : "Connecting..."}
                  className="text-sm"
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleAttachmentClick}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Attach file (images, docs, video)"
                    >
                      📎
                    </button>
                    {uploadingAttachment && (
                      <span className="text-[10px] text-slate-400 ml-1 animate-pulse">Uploading…</span>
                    )}
                    <span className="text-[10px] text-slate-300 ml-2 hidden sm:block">Ctrl+Enter to send</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingMessageId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="text-[11px] text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!connected || (!editorHtml.trim() && pendingAttachments.length === 0) || sending || uploadingAttachment}
                      className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[12px] font-semibold px-4 py-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                      <Send size={12} />
                      <span>{sending ? "Sending…" : editingMessageId ? "Save edit" : "Send"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleAttachmentChange} />
            </form>
          ) : (
            <div className="text-center py-3 text-[11px] text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
              This channel is read-only — attendance updates are posted automatically.
            </div>
          )}
        </div>
      </div>

      {/* ===== THREAD SIDEBAR ===== */}
      {activeThreadKey && threadRootMessage && (
        <aside className="w-80 bg-white border-l border-slate-100 flex flex-col shrink-0">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div>
              <div className="text-[12px] font-semibold text-slate-800">Thread</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                in {threadParentChannel ? `#${threadParentChannel.name}` : "this channel"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseThread}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Root message preview */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Avatar name={threadRootMessage.username || "User"} src={userAvatarMap[threadRootMessage.userId || threadRootMessage.user_id]} size="sm" />
              <span className="text-[11px] font-semibold text-slate-700">
                {threadRootMessage.username === user.username ? "You" : threadRootMessage.username || "User"}
              </span>
            </div>
            <div
              className="text-[11px] text-slate-600 whitespace-pre-wrap break-words line-clamp-4"
              dangerouslySetInnerHTML={{ __html: threadRootMessage.textHtml || threadRootMessage.text || "" }}
            />
          </div>

          {/* Replies */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {threadMessages.length === 0 ? (
              <div className="text-[11px] text-slate-400 text-center mt-8">No replies yet. Start the conversation.</div>
            ) : (
              threadMessages.map((m) => {
                const isOwn = String(m.userId || m.user_id) === String(user.id);
                const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                return (
                  <div key={m.id} className="flex gap-2.5">
                    <div className="w-7 shrink-0 mt-0.5">
                      <Avatar name={m.username || "User"} src={userAvatarMap[m.userId || m.user_id]} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-[11px] font-semibold text-slate-800">
                          {isOwn ? "You" : m.username || "User"}
                        </span>
                        <span className="text-[9px] text-slate-400">{time}</span>
                      </div>
                      {(m.textHtml || m.text) && (
                        <div
                          className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words"
                          dangerouslySetInnerHTML={{ __html: m.textHtml || m.text || "" }}
                        />
                      )}
                      {(m.attachments || []).length > 0 && (
                        <div className="mt-1 flex flex-col gap-1">
                          {(m.attachments || []).map((att, ai) => {
                            const BACKEND = _BACKEND;
                            const fullUrl = att.url?.startsWith("http") ? att.url : `${BACKEND}${att.url}`;
                            const isImage = att.type?.startsWith("image/");
                            const isVideo = att.type?.startsWith("video/");
                            const isAudio = att.type?.startsWith("audio/");
                            return (
                              <div key={ai}>
                                {isImage && <a href={fullUrl} target="_blank" rel="noreferrer"><img src={fullUrl} alt={att.name} className="max-h-32 max-w-full rounded-lg object-contain border border-slate-200" /></a>}
                                {isVideo && <video src={fullUrl} controls className="max-h-32 max-w-full rounded-lg" />}
                                {isAudio && <audio src={fullUrl} controls className="w-full" />}
                                {!isImage && !isVideo && !isAudio && (
                                  <a href={fullUrl} download={att.name} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:underline">
                                    <span>📎</span><span className="truncate max-w-[160px]">{att.name}</span>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Thread composer */}
          <form onSubmit={handleSendThread} className="border-t border-slate-100 px-3 py-3 shrink-0">
            <div className="border border-slate-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-blue-200 focus-within:border-blue-300 transition-shadow">
              <ReactQuill
                theme="snow"
                value={threadEditorHtml}
                onChange={handleThreadEditorChange}
                modules={quillModules}
                formats={quillFormats}
                placeholder="Reply in thread..."
                className="text-xs"
              />
              <div className="flex justify-end px-3 py-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={!connected || !(threadEditorHtml || "").trim()}
                  className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={11} />
                  <span>Reply</span>
                </button>
              </div>
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

<ReportsModal
  open={reportsOpen}
  onClose={() => setReportsOpen(false)}
  context={reportsContext}
/>
    </div>
  );
}
