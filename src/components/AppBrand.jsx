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

/**
 * Enterprise brand block.
 * Flat on the sidebar canvas — no card chrome around the mark.
 * Wordmark + small uppercase tagline read like a system identity, not
 * a startup logo.
 */
export default function AppBrand({
  collapsed = false,
  className,
  showTagline = true,
}) {
  if (collapsed) {
    return (
      <div
        className={cn(
          "h-8 w-8 flex items-center justify-center shrink-0",
          className
        )}
        title="Asystence"
      >
        <BrandMark className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <div className="h-8 w-8 flex items-center justify-center shrink-0">
        <BrandMark className="h-7 w-7" />
      </div>
      <div className="min-w-0 leading-none">
        <p className="text-[15px] leading-[1.1] font-semibold tracking-tight text-[color:var(--text)]">
          Asystence
        </p>
        {showTagline && (
          <p
            className="mt-1.5 text-[9px] leading-none font-semibold uppercase tracking-[0.16em] whitespace-nowrap text-[color:var(--text-soft)]"
          >
            System Intelligence
          </p>
        )}
      </div>
    </div>
  );
}
