// src/channels_feature/ThreadView.jsx
import React, { useRef, useState, useEffect } from "react";

/**
 * ThreadView
 *
 * Props:
 *  - root: root message object
 *  - messages: array including root + replies (parentId === root.id)
 *  - onClose: () => void
 *  - onSendReply: (text: string) => void
 */
export default function ThreadView({ root, messages, onClose, onSendReply }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages?.length]);

  if (!root) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim()) return;
    await onSendReply?.(input.trim());
    setInput("");
  }

  const replies = (messages || []).filter(
    (m) => m.id !== root.id && m.parentId === root.id
  );

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
      <div className="border-b border-slate-200 px-3 py-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Thread</div>
        <button
          type="button"
          className="text-xs text-slate-500 hover:text-slate-800"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {/* Root message */}
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium text-slate-800">
            {root.username || root.userId || "User"}
          </span>
          <span className="text-[11px] text-slate-400">
            {root.createdAt ? new Date(root.createdAt).toLocaleString() : ""}
          </span>
        </div>
        <div
          className="text-slate-900 text-sm"
          dangerouslySetInnerHTML={{ __html: root.textHtml || "" }}
        />
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm">
        {replies.length === 0 ? (
          <div className="text-xs text-slate-400 mt-1">No replies yet.</div>
        ) : (
          replies.map((m) => (
            <div key={m.id}>
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
              <div
                className="text-slate-900"
                dangerouslySetInnerHTML={{ __html: m.textHtml || "" }}
              />
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded px-2 py-1.5 text-sm"
            placeholder="Reply in thread"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white disabled:opacity-60"
            disabled={!input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
