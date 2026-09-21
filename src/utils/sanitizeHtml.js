import DOMPurify from "dompurify";

export const sanitizeHtml = (value = "") =>
  DOMPurify.sanitize(String(value ?? ""), { USE_PROFILES: { html: true } });
