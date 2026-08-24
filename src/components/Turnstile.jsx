import { useEffect, useRef } from "react";

const SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
let scriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("Security check failed to load"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function Turnstile({ onToken, resetKey = 0 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!SITE_KEY) return undefined;
    let cancelled = false;
    let widgetId = null;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !turnstile || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action: "signup",
          appearance: "interaction-only",
          size: "flexible",
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));

    return () => {
      cancelled = true;
      if (widgetId !== null && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken, resetKey]);

  return SITE_KEY ? <div ref={containerRef} className="min-h-0" /> : null;
}
