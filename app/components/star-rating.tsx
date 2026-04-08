import { Star } from "lucide-react";
import { useState } from "react";

interface StarRatingDisplayProps {
  average: number;
  count: number;
}

export function StarRatingDisplay({ average, count }: StarRatingDisplayProps) {
  if (count === 0) return null;

  const rounded = Math.round(average * 10) / 10;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-3.5 ${
              i < Math.round(average)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rounded} ({count})
      </span>
    </div>
  );
}

export function StarRatingInput() {
  const [hoveredStar, setHoveredStar] = useState(0);

  return (
    <form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value="rate" />
      <span className="text-sm text-muted-foreground">Rate this course:</span>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => {
          const starValue = i + 1;
          return (
            <button
              key={i}
              type="submit"
              name="rating"
              value={starValue}
              onMouseEnter={() => setHoveredStar(starValue)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-0.5 transition-transform hover:scale-110"
              title={`Rate ${starValue} star${starValue > 1 ? "s" : ""}`}
            >
              <Star
                className={`size-5 ${
                  starValue <= hoveredStar
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          );
        })}
      </div>
    </form>
  );
}

interface StarRatingLockedProps {
  rating: number;
}

export function StarRatingLocked({ rating }: StarRatingLockedProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Your rating:</span>
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-5 ${
              i < rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
