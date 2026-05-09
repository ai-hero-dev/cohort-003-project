import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

const SIZES = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

type Size = keyof typeof SIZES;

export function StarRatingDisplay({
  average,
  count,
  size = "sm",
  className,
}: {
  average: number | null;
  count: number;
  size?: Size;
  className?: string;
}) {
  const filled = count > 0 && average !== null ? Math.round(average) : 0;
  const sizeClass = SIZES[size];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        count === 0 && "text-muted-foreground",
        className
      )}
      aria-label={
        count === 0
          ? "No ratings yet"
          : `Rated ${average!.toFixed(1)} out of 5 from ${count} ${count === 1 ? "rating" : "ratings"}`
      }
    >
      <span className="inline-flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              sizeClass,
              i < filled
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            )}
          />
        ))}
      </span>
      {count === 0 ? (
        <span className="text-xs">No ratings yet</span>
      ) : (
        <span className="text-xs tabular-nums">
          <span className="font-medium text-foreground">
            {average!.toFixed(1)}
          </span>{" "}
          <span className="text-muted-foreground">({count})</span>
        </span>
      )}
    </span>
  );
}

export function StarRatingInput({
  name = "rating",
  value,
  size = "md",
  disabled = false,
}: {
  name?: string;
  value: number | null;
  size?: Size;
  disabled?: boolean;
}) {
  const sizeClass = SIZES[size];

  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== null && n <= value;
        return (
          <button
            key={n}
            type="submit"
            name={name}
            value={n}
            disabled={disabled}
            aria-label={`Rate ${n} ${n === 1 ? "star" : "stars"}`}
            className={cn(
              "rounded p-1 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
              !disabled && "cursor-pointer"
            )}
          >
            <Star
              className={cn(
                sizeClass,
                filled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        );
      })}
    </span>
  );
}
