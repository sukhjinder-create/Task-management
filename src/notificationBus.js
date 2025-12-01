// src/notificationBus.js

// Very small event bus just for unread notification count

const listeners = new Set();

/**
 * Sidebar (and others) call this to subscribe to unread count changes.
 * Returns an unsubscribe function.
 */
export function subscribeToUnreadCount(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Notifications page calls this whenever unread count changes.
 */
export function publishUnreadCount(count) {
  for (const cb of listeners) {
    try {
      cb(count);
    } catch (err) {
      console.error("Error in unread count listener:", err);
    }
  }
}
