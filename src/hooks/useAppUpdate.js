import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function compareVersions(current, latest) {
  const a = current.split(".").map(Number);
  const b = latest.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((b[i] || 0) > (a[i] || 0)) return true;
  }
  return false;
}

export function useAppUpdate() {
  const [updateInfo, setUpdateInfo] = useState(null); // { version, apkUrl }

  useEffect(() => {
    if (!window.Capacitor) return;

    async function check() {
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        const res  = await fetch(`${API_URL}/app-version`);
        if (!res.ok) return;
        const { version: latest, apkUrl } = await res.json();
        if (apkUrl && compareVersions(info.version, latest)) {
          setUpdateInfo({ version: latest, apkUrl });
        }
      } catch {
        // silently ignore — no update check if offline
      }
    }

    check();
  }, []);

  function dismissUpdate() {
    setUpdateInfo(null);
  }

  return { updateInfo, dismissUpdate };
}
