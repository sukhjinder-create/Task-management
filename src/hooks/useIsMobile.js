// src/hooks/useIsMobile.js
// Returns true for narrow browser windows (< 768px).
// Components use this to switch between desktop and mobile layouts.

import { useState, useEffect } from "react";

export function useIsMobile() {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isNarrow;
}
