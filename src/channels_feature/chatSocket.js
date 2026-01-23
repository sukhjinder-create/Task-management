import {
  getSocket,
} from "../socket";

/**
 * Set up all chat-related socket listeners for a given channel.
 *
 * IMPORTANT:
 * - This file MUST NOT join or leave channels
 * - Channel lifecycle is owned by Chat.jsx
 */
export function setupChannelSocket(channelKey, handlers = {}) {
  const socket = getSocket();
  if (!socket || !channelKey) {
    return () => {};
  }

  const {
    onHistory,
    onMessage,
    onMessageEdited,
    onMessageDeleted,
    onReaction,
    onSystem,
  } = handlers;

  // 🔥 helper: normalize incoming channel id (AI / legacy / history safe)
  const getIncomingChannel = (payload) =>
    payload?.channelId || payload?.channelKey || payload?.channel;

  const historyHandler = (payload) => {
    if (!onHistory) return;
    const incomingChannel = getIncomingChannel(payload);
    if (incomingChannel !== channelKey) return;
    onHistory(payload);
  };

  const messageHandler = (msg) => {
    if (!onMessage) return;
    const incomingChannel = getIncomingChannel(msg);
    if (incomingChannel !== channelKey) return;
    onMessage(msg);
  };

  const editedHandler = (msg) => {
    if (!onMessageEdited) return;
    const incomingChannel = getIncomingChannel(msg);
    if (incomingChannel !== channelKey) return;
    onMessageEdited(msg);
  };

  const deletedHandler = (msg) => {
    if (!onMessageDeleted) return;
    const incomingChannel = getIncomingChannel(msg);
    if (incomingChannel !== channelKey) return;
    onMessageDeleted(msg);
  };

  const reactionHandler = (payload) => {
    if (!onReaction) return;
    const incomingChannel = getIncomingChannel(payload);
    if (incomingChannel !== channelKey) return;
    onReaction(payload);
  };

  const systemHandler = (payload) => {
    if (!onSystem) return;
    const incomingChannel = getIncomingChannel(payload);
    if (incomingChannel !== channelKey) return;
    onSystem(payload);
  };

  socket.on("chat:history", historyHandler);
  socket.on("chat:message", messageHandler);
  socket.on("chat:messageEdited", editedHandler);
  socket.on("chat:messageDeleted", deletedHandler);
  socket.on("chat:reaction", reactionHandler);
  socket.on("chat:system", systemHandler);

  // ✅ CLEANUP: listeners only (NO leave)
  return () => {
    socket.off("chat:history", historyHandler);
    socket.off("chat:message", messageHandler);
    socket.off("chat:messageEdited", editedHandler);
    socket.off("chat:messageDeleted", deletedHandler);
    socket.off("chat:reaction", reactionHandler);
    socket.off("chat:system", systemHandler);
  };
}
