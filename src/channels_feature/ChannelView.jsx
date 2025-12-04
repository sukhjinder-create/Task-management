import React, { useEffect, useRef, useState } from "react";
import api from "../api";
import { sendChatMessage, sendTyping } from "../socket";
import { setupChannelSocket } from "./chatSocket";
import ThreadView from "./ThreadView";

function normalizeMessage(m) {
  if (!m) return null;
  return {
    id: m.id,
    channelId: m.channelId || m.channel_id,
    userId: m.userId || m.user_id,
    username: m.username,
    textHtml: m.textHtml || m.text_html,
    createdAt: m.createdAt || m.created_at,
    updatedAt: m.updatedAt || m.updated_at,
    deletedAt: m.deletedAt || m.deleted_at,
    parentId: m.parentId || m.parent_id,
    reactions: m.reactions || {},
    attachments: m.attachments || [],
  };
}

/**
 * ChannelView
 *
 * Props:
 *  - channelKey: string (e.g. "general")
 *  - channel: channel object from ChannelList
 *  - currentUserId: string
 */
export default function ChannelView({ channelKey, channel, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [threadRoot, setThreadRoot] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!channelKey) {
      setMessages([]);
      setThreadRoot(null);
      return;
    }

    setMessages([]);
    setThreadRoot(null);

    const cleanup = setupChannelSocket(channelKey, {
      onHistory: ({ messages }) => {
        const normalized = (messages || []).map(normalizeMessage).filter(Boolean);
        setMessages(normalized);
        scrollToBottom();
      },
      onMessage: (msg) => {
        const n = normalizeMessage(msg);
        if (!n) return;
        setMessages((prev) => [...prev, n]);
        scrollToBottom();
      },
      onMessageEdited: (msg) => {
        const n = normalizeMessage(msg);
        if (!n) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === n.id ? { ...m, ...n } : m))
        );
      },
      onMessageDeleted: (msg) => {
        const n = normalizeMessage(msg);
        if (!n) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === n.id ? { ...m, deletedAt: n.deletedAt || n.deleted_at } : m
          )
        );
      },
    });

    // Fallback HTTP history load
    (async () => {
      try {
        const res = await api.get(
          `/chat/for-channel/${encodeURIComponent(channelKey)}`
        );
        const normalized = (res.data || []).map(normalizeMessage).filter(Boolean);
        setMessages(normalized);
        scrollToBottom();
      } catch (err) {
        console.error("HTTP fetch messages error", err);
      }
    })();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelKey]);

  function scrollToBottom() {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !channelKey) return;

    const tempId = `temp-${Date.now()}`;
    const payload = {
      channelId: channelKey,
      text: input.trim(),
      tempId,
    };

    setSending(true);
    try {
      // Optimistic: emit via socket
      sendChatMessage(payload);

      // Persist via HTTP
      await api.post("/chat", payload);

      setInput("");
    } catch (err) {
      console.error("Send message error", err);
      // you can show toast here if you want
    } finally {
      setSending(false);
    }
  }

  function handleTyping() {
    if (!channelKey) return;
    sendTyping(channelKey);
  }

  function openThread(msg) {
    setThreadRoot(msg);
  }

  function closeThread() {
    setThreadRoot(null);
  }

  const threadMessages = threadRoot
    ? messages.filter(
        (m) => m.id === threadRoot.id || m.parentId === threadRoot.id
      )
    : [];

  async function sendThreadReply(text) {
    if (!channelKey || !threadRoot || !text.trim()) return;

    const tempId = `temp-thread-${Date.now()}`;
    const payload = {
      channelId: channelKey,
      text: text.trim(),
      tempId,
      parentId: threadRoot.id,
    };

    try {
      sendChatMessage(payload);
      await api.post("/chat", payload);
    } catch (err) {
      console.error("Thread reply error", err);
    }
  }

  if (!channelKey) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Select a channel from the left to start chatting.
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-slate-50">
      {/* Main column */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-200 px-4 py-2 flex items-center gap-2">
          <span className="text-slate-500">#</span>
          <span className="font-semibold text-sm">
            {channel?.name || channelKey}
          </span>
          {channel?.is_private && (
            <span className="ml-2 text-[10px] bg-slate-200 text-slate-600 px-1 rounded">
              private
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {messages.length === 0 ? (
            <div className="text-xs text-slate-400 mt-2">
              No messages yet. Say hi 👋
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="text-sm group">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-slate-800">
                    {m.username || m.userId || "User"}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {m.createdAt
                      ? new Date(m.createdAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                {m.deletedAt ? (
                  <div className="text-xs text-slate-400 italic">
                    message deleted
                  </div>
                ) : (
                  <div
                    className="text-slate-900"
                    dangerouslySetInnerHTML={{
                      __html: m.textHtml || "",
                    }}
                  />
                )}

                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 text-[11px] text-slate-400 hover:text-slate-600"
                  onClick={() => openThread(m)}
                >
                  Reply in thread
                </button>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSend}
          className="border-t border-slate-200 px-4 py-2"
        >
          <div className="flex items-center gap-2">
            <input
              className="flex-1 border rounded px-3 py-1.5 text-sm"
              placeholder={
                channel?.name
                  ? `Message #${channel.name}`
                  : `Message #${channelKey}`
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleTyping}
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-60"
              disabled={sending || !input.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Thread side panel */}
      {threadRoot && (
        <ThreadView
          root={threadRoot}
          messages={threadMessages}
          onClose={closeThread}
          onSendReply={sendThreadReply}
        />
      )}
    </div>
  );
}
