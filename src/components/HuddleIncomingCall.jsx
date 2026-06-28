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
  const isSelfOtherDevice = Boolean(invite.isSelfOtherDevice);

  return (
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/60 backdrop-blur-sm motion-safe:animate-[overlayFadeIn_160ms_ease-out]">
      <div className="w-80 rounded-2xl bg-[var(--surface)] border border-[color:var(--border)] p-8 flex flex-col items-center gap-6 shadow-2xl motion-safe:animate-[dialogPopIn_220ms_cubic-bezier(0.22,1,0.36,1)]">
        {/* Avatar with a soft ringing halo */}
        <div className="w-20 h-20 rounded-full bg-[color:var(--primary)] flex items-center justify-center text-3xl font-bold text-white motion-safe:animate-[ringPulse_1.8s_ease-out_infinite]">
          {callerName.charAt(0).toUpperCase()}
        </div>

        <div className="text-center">
          {isSelfOtherDevice ? (
            <>
              <p className="text-[color:var(--text)] font-semibold text-lg">Join this Huddle on this device?</p>
              <p className="text-[color:var(--text-muted)] text-sm mt-1">You started a huddle in {channelLabel} on another device</p>
            </>
          ) : (
            <>
              <p className="text-[color:var(--text)] font-semibold text-lg">{callerName}</p>
              <p className="text-[color:var(--text-muted)] text-sm mt-1">Calling from {channelLabel}</p>
            </>
          )}
          <p className="text-[color:var(--text-soft)] text-xs mt-1 tabular-nums">Auto-decline in {seconds}s</p>
        </div>

        <div className="flex gap-8">
          {/* Decline */}
          <button
            onClick={onDecline}
            aria-label="Decline call"
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 flex items-center justify-center shadow-sm transition-[background-color,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            aria-label="Accept call"
            className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 active:scale-95 flex items-center justify-center shadow-sm transition-[background-color,transform] duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>

        <p className="text-[color:var(--text-soft)] text-xs">Huddle Call</p>
      </div>
    </div>
  );
}
