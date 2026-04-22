import { Download, X } from "lucide-react";

export default function AppUpdateModal({ version, apkUrl, onDismiss }) {
  function handleUpdate() {
    window.open(apkUrl, "_blank");
    onDismiss();
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/50 px-4 pb-8">
      <div className="w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-700 p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Update Available</p>
              <p className="text-gray-400 text-xs">Version {version} is ready</p>
            </div>
          </div>
          <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-5">
          A new version of the app is available with improvements and bug fixes.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            Update Now
          </button>
        </div>
      </div>
    </div>
  );
}
