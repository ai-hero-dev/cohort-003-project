import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

/**
 * Display-only star rating — supports fractional values (e.g. 3.7).
 * Each star clips its fill to the exact percentage.
 */
export function StarDisplay({
  value,
  count,
  className,
  size = "sm",
}: {
  value: number | null;
  count?: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const starSize = size === "md" ? "size-5" : "size-3.5";

  if (value === null) {
    return (
      <span className={cn("flex items-center gap-0.5 text-muted-foreground/40", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn(starSize, "fill-current")} />
        ))}
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const fill = Math.min(1, Math.max(0, value - i));
          const percent = Math.round(fill * 100);
          return (
            <span key={i} className="relative inline-flex">
              {/* empty star */}
              <Star className={cn(starSize, "fill-muted-foreground/20 text-muted-foreground/20")} />
              {/* filled overlay clipped to percentage */}
              {percent > 0 && (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${percent}%` }}
                >
                  <Star className={cn(starSize, "fill-yellow-400 text-yellow-400")} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      <span className="text-xs text-muted-foreground">
        {value.toFixed(1)}
        {count !== undefined && count > 0 && (
          <span className="ml-0.5">({count})</span>
        )}
      </span>
    </span>
  );
}

/**
 * Interactive star rating — integer values 1–5.
 * Calls onChange when the user picks a star.
 */
export function StarPicker({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (rating: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <span className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        const star = i + 1;
        const active = hoverValue ?? value;
        const filled = active !== null && star <= active;
        return (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => onChange(star)}
            onMouseEnter={() => !disabled && setHoverValue(star)}
            onMouseLeave={() => setHoverValue(null)}
            className={cn(
              "rounded transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              disabled && "cursor-default opacity-60"
            )}
            aria-label={`Rate ${star} out of 5 stars`}
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-muted-foreground/20 text-muted-foreground/20"
              )}
            />
          </button>
        );
      })}
    </span>
  );
}
