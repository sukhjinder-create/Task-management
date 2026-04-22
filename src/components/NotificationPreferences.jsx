// src/components/NotificationPreferences.jsx
// Notification mute settings — shown in Profile page.

import { useEffect, useState } from "react";
import { useApi } from "../api";
import toast from "react-hot-toast";
import { Bell, BellOff, MessageSquare, CheckSquare } from "lucide-react";

export default function NotificationPreferences() {
  const api = useApi();
  const [prefs, setPrefs]     = useState(null);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    api.get("/push/preferences")
      .then((r) => setPrefs(r.data))
      .catch(() => setPrefs({ mute_all: false, mute_tasks: false, mute_chat: false }));
  }, []);

  const toggle = async (field) => {
    const updated = { ...prefs, [field]: !prefs[field] };
    setPrefs(updated);
    setSaving(true);
    try {
      const res = await api.patch("/push/preferences", updated);
      setPrefs(res.data);
    } catch {
      toast.error("Failed to save preferences");
      setPrefs(prefs);
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) return (
    <div className="h-24 flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
    </div>
  );

  const rows = [
    {
      key: "mute_all",
      icon: prefs.mute_all ? BellOff : Bell,
      label: "Mute all notifications",
      desc:  "Disable all push notifications for this device",
    },
    {
      key: "mute_tasks",
      icon: CheckSquare,
      label: "Mute task notifications",
      desc:  "Don't notify me when tasks are assigned or updated",
      disabled: prefs.mute_all,
    },
    {
      key: "mute_chat",
      icon: MessageSquare,
      label: "Mute chat notifications",
      desc:  "Don't notify me on new chat messages",
      disabled: prefs.mute_all,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold theme-text flex items-center gap-2">
        <Bell size={16} /> Push Notifications
      </h3>

      {rows.map(({ key, icon: Icon, label, desc, disabled }) => (
        <div
          key={key}
          className={`flex items-center justify-between p-3 rounded-lg border theme-border
                      transition-opacity ${disabled ? "opacity-40 pointer-events-none" : ""}`}
        >
          <div className="flex items-start gap-3">
            <Icon size={16} className="mt-0.5 theme-text-muted shrink-0" />
            <div>
              <p className="text-sm font-medium theme-text">{label}</p>
              <p className="text-xs theme-text-muted">{desc}</p>
            </div>
          </div>

          <button
            onClick={() => toggle(key)}
            disabled={saving || disabled}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full
                        transition-colors focus:outline-none
                        ${prefs[key] ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                          transition-transform ${prefs[key] ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      ))}

      <p className="text-xs theme-text-muted">
        Preferences apply to this browser / device. Notifications are sent when tasks are assigned to you or new chat messages arrive.
      </p>
    </div>
  );
}
