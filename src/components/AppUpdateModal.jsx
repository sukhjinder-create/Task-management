import { Download, X } from "lucide-react";

export default function AppUpdateModal({ version, apkUrl, onDismiss }) {
  function handleUpdate() {
    window.open(apkUrl, "_blank");
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 px-4 pb-8">
      <div className="w-full max-w-sm rounded-xl bg-[var(--surface)] border border-[color:var(--border)] p-6 shadow-xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color:var(--primary)] flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[color:var(--text)] font-semibold text-base">Update Available</p>
              <p className="text-[color:var(--text-muted)] text-xs">Version {version} is ready</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-[color:var(--text-soft)] hover:text-[color:var(--text)] p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-[color:var(--text-muted)] text-sm mb-5">
          A new version of the app is available with improvements and bug fixes.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-[color:var(--border)] text-[color:var(--text-soft)] text-sm font-medium hover:text-[color:var(--text)] hover:border-[color:var(--primary)] transition"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-2.5 rounded-xl bg-[color:var(--primary)] text-white text-sm font-medium hover:opacity-90 transition"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
