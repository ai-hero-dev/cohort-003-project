import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";

type DisplayProps = {
  mode: "display";
  average: number | null;
  count: number;
  size?: "sm" | "md";
};

type InputProps = {
  mode: "input";
  courseId: number;
};

type StarRatingProps = DisplayProps | InputProps;

export function StarRating(props: StarRatingProps) {
  if (props.mode === "display") {
    return <DisplayStars {...props} />;
  }
  return <InputStars courseId={props.courseId} />;
}

function DisplayStars({ average, count, size = "sm" }: DisplayProps) {
  if (average === null || count === 0) {
    return null;
  }

  const starClass = size === "md" ? "size-4" : "size-3";
  const textClass = size === "md" ? "text-sm" : "text-xs";

  return (
    <span
      className={`flex items-center gap-1 ${textClass} text-muted-foreground`}
      aria-label={`${average.toFixed(1)} out of 5 stars, ${count} ratings`}
    >
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => {
          const fill = Math.max(0, Math.min(1, average - (n - 1)));
          return (
            <span key={n} className={`relative ${starClass}`}>
              <Star className={`${starClass} text-muted-foreground/40`} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star
                  className={`${starClass} fill-yellow-400 text-yellow-400`}
                />
              </span>
            </span>
          );
        })}
      </span>
      <span className="font-medium text-foreground">{average.toFixed(1)}</span>
      <span>({count})</span>
    </span>
  );
}

function InputStars({ courseId }: { courseId: number }) {
  const fetcher = useFetcher();
  const [hover, setHover] = useState<number | null>(null);
  const submitting = fetcher.state !== "idle";

  return (
    <fetcher.Form
      method="post"
      action="/api/rate-course"
      className="flex items-center gap-1"
    >
      <input type="hidden" name="courseId" value={courseId} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="submit"
          name="rating"
          value={n}
          disabled={submitting}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          aria-label={`Rate ${n} stars`}
          className="rounded p-0.5 transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Star
            className={
              hover !== null && n <= hover
                ? "size-5 fill-yellow-400 text-yellow-400"
                : "size-5 text-muted-foreground/60"
            }
          />
        </button>
      ))}
    </fetcher.Form>
  );
}
