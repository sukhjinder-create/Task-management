// src/pages/Chat.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getSocket,
  initSocket,
  joinChatChannel,
  leaveChatChannel,
  sendChatMessage,
} from "../socket";

const CHANNEL_ID = "general"; // one global team room for now

// Simple unique id helper to avoid duplicate React keys
function createUniqueId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function Chat() {
  const { auth } = useAuth();
  const user = auth.user;

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]); // {id, username, text, createdAt, system?}
  const [input, setInput] = useState("");
  const [joining, setJoining] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const listRef = useRef(null);
  const hasConnectedRef = useRef(false); // avoid duplicate "connected" actions

  // Keep scroll at bottom on new messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Socket setup (history + live events)
  useEffect(() => {
    let socket = getSocket();

    if (!socket && auth.token) {
      socket = initSocket(auth.token);
    }

    if (!socket) {
      setConnected(false);
      setJoining(false);
      setLoadingHistory(false);
      return;
    }

    const handleHistory = (payload) => {
      if (!payload || payload.channelId !== CHANNEL_ID) return;
      const history = (payload.messages || []).map((m) => ({
        id: m.id || createUniqueId("msg"),
        channelId: m.channelId,
        text: m.text,
        userId: m.userId,
        username: m.username,
        createdAt: m.createdAt,
      }));
      setMessages(history);
      setLoadingHistory(false);
    };

    const handleConnect = () => {
      setConnected(true);
      setJoining(false);

      // Only do first-time join + system message once per mount
      if (!hasConnectedRef.current) {
        hasConnectedRef.current = true;
        joinChatChannel(CHANNEL_ID);
        setMessages((prev) => [
          ...prev,
          {
            id: createUniqueId("sys"),
            system: true,
            text: "Connected to team chat.",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          system: true,
          text: "Disconnected from chat.",
          createdAt: new Date().toISOString(),
        },
      ]);
    };

    const handleChatMessage = (msg) => {
      if (!msg || msg.channelId !== CHANNEL_ID) return;

      setMessages((prev) => {
        const next = [...prev];

        // 1) Replace optimistic message if tempId matches
        if (msg.tempId) {
          const idxByTemp = next.findIndex((m) => m.id === msg.tempId);
          if (idxByTemp !== -1) {
            next[idxByTemp] = {
              ...next[idxByTemp],
              ...msg,
              id: msg.id || msg.tempId, // move to real id if provided
            };
            return next;
          }
        }

        // 2) Or replace if a message already exists with this final id
        if (msg.id) {
          const idxById = next.findIndex((m) => m.id === msg.id);
          if (idxById !== -1) {
            next[idxById] = {
              ...next[idxById],
              ...msg,
            };
            return next;
          }
        }

        // 3) Otherwise it's a brand new message → append with a safe unique id
        const safeId = msg.id || msg.tempId || createUniqueId("msg");
        next.push({ ...msg, id: safeId });
        return next;
      });
    };

    const handleSystem = (payload) => {
      if (!payload || payload.channelId !== CHANNEL_ID) return;
      let txt = "";
      if (payload.type === "join") {
        txt = `${payload.username || "Someone"} joined the channel`;
      } else if (payload.type === "leave") {
        txt = `${payload.username || "Someone"} left the channel`;
      } else {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: createUniqueId("sys"),
          system: true,
          text: txt,
          createdAt: payload.at || new Date().toISOString(),
        },
      ]);
    };

    // Attach listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleChatMessage);
    socket.on("chat:system", handleSystem);
    socket.on("chat:history", handleHistory);

    // If already connected when component mounts, simulate connect
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleChatMessage);
      socket.off("chat:system", handleSystem);
      socket.off("chat:history", handleHistory);

      // leave channel when unmounting
      leaveChatChannel(CHANNEL_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();

    const tempId = createUniqueId("temp");

    // optimistic UI
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        channelId: CHANNEL_ID,
        text,
        userId: user.id,
        username: user.username,
        createdAt: new Date().toISOString(),
      },
    ]);

    // include tempId so backend can echo it back and we can reconcile
    sendChatMessage({ channelId: CHANNEL_ID, text, tempId });
    setInput("");
  };

  const statusLabel = connected
    ? "Connected"
    : joining
    ? "Connecting..."
    : "Offline";

  const statusDotClass = connected ? "bg-green-500" : "bg-red-500";

  return (
    <div className="space-y-4 h-[calc(100vh-80px)] flex flex-col">
      {/* HEADER */}
      <section className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Team Chat</h1>
          <p className="text-xs text-slate-500">
            Real-time conversation for your whole team. Everyone sees the same
            messages in this channel.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-[2px]">
            <span
              className={`w-2 h-2 rounded-full ${statusDotClass}`}
            ></span>
            <span>{statusLabel}</span>
          </span>
          <span className="text-slate-500">
            You are signed in as{" "}
            <span className="font-semibold">{user.username}</span>
          </span>
        </div>
      </section>

      {/* CHAT BODY */}
      <section className="bg-white rounded-xl shadow p-4 flex-1 flex flex-col min-h-0">
        {/* Messages list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto border border-slate-100 rounded-lg p-3 bg-slate-50 space-y-2 text-xs"
        >
          {loadingHistory && messages.length === 0 ? (
            <div className="text-slate-400 text-[11px]">
              Loading conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="text-slate-400 text-[11px]">
              No messages yet. Say hi 👋
            </div>
          ) : (
            messages.map((m) => {
              const isOwn = !m.system && m.userId === user.id;
              const isSystem = m.system;
              const time = m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString()
                : "";

              if (isSystem) {
                return (
                  <div
                    key={m.id}
                    className="w-full text-center text-[10px] text-slate-500 my-1"
                  >
                    — {m.text} —
                  </div>
                );
              }

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
                    <div className="flex items-center justify-between gap-3 mb-0.5">
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
                    <div className="text-[11px] whitespace-pre-wrap break-words">
                      {m.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Input box */}
        <form
          onSubmit={handleSend}
          className="mt-3 flex items-center gap-2 text-xs"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              connected
                ? "Type a message and press Enter..."
                : "Connect to send messages..."
            }
            disabled={!connected}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs disabled:bg-slate-100 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={!connected || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      </section>
    </div>
  );
}
