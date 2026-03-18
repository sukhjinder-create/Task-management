// src/hooks/useIsMobile.js
// Returns true when running on a mobile device (Capacitor) OR narrow screen (< 768px).
// Components use this to switch between desktop and mobile layouts.

import { useState, useEffect } from "react";

export function useIsMobile() {
  const isCapacitor = typeof window !== "undefined" && !!window.Capacitor;

  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    if (isCapacitor) return; // always mobile on Capacitor, no need to track resize
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isCapacitor]);

  return isCapacitor || isNarrow;
}
