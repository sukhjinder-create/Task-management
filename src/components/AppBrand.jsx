import { cn } from "../utils/cn";

function BrandMark({ className }) {
  return (
    <img
      src="/asystence-logo.png"
      alt="Asystence"
      aria-hidden="true"
      className={cn("h-full w-full object-contain", className)}
    />
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
