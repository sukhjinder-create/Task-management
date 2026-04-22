import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";

export default function HuddleIncomingCall({ invite, onAccept, onDecline }) {
  const [seconds, setSeconds] = useState(30);

  // Auto-decline after 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { onDecline(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDecline]);

  const callerName = invite.startedByName || "Someone";
  const channelLabel = invite.channelId?.startsWith("dm:") ? "Direct Message" : `#${invite.channelId}`;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
      <div className="w-80 rounded-2xl bg-gray-900 border border-gray-700 p-8 flex flex-col items-center gap-6 shadow-2xl animate-pulse-once">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold text-white">
          {callerName.charAt(0).toUpperCase()}
        </div>

        <div className="text-center">
          <p className="text-white font-semibold text-lg">{callerName}</p>
          <p className="text-gray-400 text-sm mt-1">Calling from {channelLabel}</p>
          <p className="text-gray-500 text-xs mt-1">Auto-decline in {seconds}s</p>
        </div>

        <div className="flex gap-8">
          {/* Decline */}
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center transition shadow-lg"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>

        <p className="text-gray-500 text-xs">Huddle Call</p>
      </div>
    </div>
  );
}
