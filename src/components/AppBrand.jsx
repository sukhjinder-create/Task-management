import { cn } from "../utils/cn";

function BrandMark({ className }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <path
        d="M32 7L8.5 56H19.5L24.5 45.5H39.5L44.5 56H55.5L32 7Z"
        stroke="currentColor"
        strokeWidth="4.25"
        strokeLinejoin="round"
      />
      <path
        d="M26.5 35.5H37.5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M18 49L24 42M24 42L32 45M24 42L40 42M40 42L46 49"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.58"
      />
      <circle cx="24" cy="42" r="1.8" fill="currentColor" opacity="0.72" />
      <circle cx="32" cy="45" r="1.8" fill="currentColor" opacity="0.72" />
      <circle cx="40" cy="42" r="1.8" fill="currentColor" opacity="0.72" />
    </svg>
  );
}

export default function AppBrand({
  collapsed = false,
  className,
  showTagline = true,
}) {
  if (collapsed) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-xl border shadow-sm flex items-center justify-center",
          className
        )}
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--surface) 94%, #ffffff), color-mix(in srgb, var(--surface-soft) 86%, #9ca3af 14%))",
          color: "var(--text)",
        }}
        title="Asystence"
      >
        <BrandMark className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <div
        className="h-8 w-8 rounded-lg border shadow-sm flex items-center justify-center shrink-0"
        style={{
          borderColor: "var(--border)",
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--surface) 94%, #ffffff), color-mix(in srgb, var(--surface-soft) 86%, #9ca3af 14%))",
          color: "var(--text)",
        }}
      >
        <BrandMark className="h-6 w-6" />
      </div>

      <div className="min-w-0 leading-none">
        <div className="flex min-w-0 items-center">
          <p className="text-[16px] leading-[1.12] font-bold tracking-tight theme-text">Asystence</p>
        </div>
        {showTagline ? (
          <p
            className="mt-1 text-[8px] leading-[1] tracking-[0.09em] font-bold uppercase whitespace-nowrap"
            style={{ color: "color-mix(in srgb, var(--text) 76%, var(--text-muted))" }}
          >
            A SYSTEM INTELLIGENCE
          </p>
        ) : null}
      </div>
    </div>
  );
}
