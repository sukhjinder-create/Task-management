import {
  getSocket,
  joinChatChannel,
  leaveChatChannel,
} from "../socket";

/**
 * Set up all chat-related socket listeners for a given channel.
 *
 * @param {string} channelKey - channel key/id (e.g. "general")
 * @param {object} handlers - callback functions:
 *   - onHistory({ channelId, messages })
 *   - onMessage(msg)
 *   - onMessageEdited(msg)
 *   - onMessageDeleted(msg)
 *   - onReaction(payload)
 *   - onSystem(payload)
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

  // Join room (server will also join workspace-scoped room based on JWT)
  joinChatChannel(channelKey);

  const historyHandler = (payload) => {
    if (!onHistory) return;
    if (payload.channelId !== channelKey) return;
    onHistory(payload);
  };

  const messageHandler = (msg) => {
    if (!onMessage) return;
    if (msg.channelId !== channelKey) return;
    onMessage(msg);
  };

  const editedHandler = (msg) => {
    if (!onMessageEdited) return;
    if (msg.channelId !== channelKey) return;
    onMessageEdited(msg);
  };

  const deletedHandler = (msg) => {
    if (!onMessageDeleted) return;
    if (msg.channelId !== channelKey) return;
    onMessageDeleted(msg);
  };

  const reactionHandler = (payload) => {
    if (!onReaction) return;
    if (payload.channelId !== channelKey) return;
    onReaction(payload);
  };

  const systemHandler = (payload) => {
    if (!onSystem) return;
    if (payload.channelId !== channelKey) return;
    onSystem(payload);
  };

  socket.on("chat:history", historyHandler);
  socket.on("chat:message", messageHandler);
  socket.on("chat:messageEdited", editedHandler);
  socket.on("chat:messageDeleted", deletedHandler);
  socket.on("chat:reaction", reactionHandler);
  socket.on("chat:system", systemHandler);

  // Return cleanup fn
  return () => {
    leaveChatChannel(channelKey);
    socket.off("chat:history", historyHandler);
    socket.off("chat:message", messageHandler);
    socket.off("chat:messageEdited", editedHandler);
    socket.off("chat:messageDeleted", deletedHandler);
    socket.off("chat:reaction", reactionHandler);
    socket.off("chat:system", systemHandler);
  };
}
