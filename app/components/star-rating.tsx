import { useState } from "react";
import { Form, useNavigation } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";
import { MAX_RATING } from "~/db/schema";

const STARS = Array.from({ length: MAX_RATING }, (_, i) => i + 1);

/**
 * Read-only average rating. Renders partial fills by overlaying a clipped row
 * of solid stars on a row of outlines, so 4.3 reads as 4.3 rather than 4.
 */
export function StarRating({
  average,
  count,
  size = "sm",
  showCount = true,
  className,
}: {
  average: number | null;
  count: number;
  size?: "sm" | "md";
  showCount?: boolean;
  className?: string;
}) {
  const starClass = size === "md" ? "size-5" : "size-3.5";
  const textClass = size === "md" ? "text-sm" : "text-xs";

  if (average === null || count === 0) {
    return (
      <span className={cn("text-muted-foreground", textClass, className)}>
        No ratings yet
      </span>
    );
  }

  const fillPercent = (average / MAX_RATING) * 100;

  return (
    <span
      className={cn("flex items-center gap-1.5", className)}
      aria-label={`Rated ${average} out of ${MAX_RATING} from ${count} ${
        count === 1 ? "rating" : "ratings"
      }`}
    >
      <span className="relative inline-flex" aria-hidden="true">
        <span className="flex">
          {STARS.map((star) => (
            <Star key={star} className={cn(starClass, "text-muted-foreground/40")} />
          ))}
        </span>
        <span
          className="absolute inset-0 flex overflow-hidden"
          style={{ width: `${fillPercent}%` }}
        >
          {STARS.map((star) => (
            <Star
              key={star}
              className={cn(starClass, "shrink-0 fill-amber-400 text-amber-400")}
            />
          ))}
        </span>
      </span>
      <span className={cn("font-medium text-foreground", textClass)}>
        {average.toFixed(1)}
      </span>
      {showCount && (
        <span className={cn("text-muted-foreground", textClass)}>({count})</span>
      )}
    </span>
  );
}

/**
 * Interactive star picker. Submits to the enclosing route's action as soon as
 * a star is clicked — there is no written review to compose, so there is
 * nothing to confirm.
 */
export function RateCourseForm({
  currentRating,
  className,
}: {
  currentRating: number | null;
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const navigation = useNavigation();
  const isSubmitting = navigation.formData?.get("intent") === "rate";

  // Optimistically reflect the star being submitted.
  const submitted = navigation.formData?.get("rating");
  const pendingRating = submitted ? Number(submitted) : null;
  const active = hovered ?? pendingRating ?? currentRating ?? 0;

  return (
    <Form method="post" className={cn("space-y-2", className)}>
      <input type="hidden" name="intent" value="rate" />
      <div
        className="flex items-center gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="submit"
            name="rating"
            value={star}
            disabled={isSubmitting}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            aria-label={`Rate ${star} out of ${MAX_RATING}`}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
          >
            <Star
              className={cn(
                "size-6",
                star <= active
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {currentRating
          ? `You rated this ${currentRating} out of ${MAX_RATING}. Click to change.`
          : "Tap a star to rate this course."}
      </p>
    </Form>
  );
}
