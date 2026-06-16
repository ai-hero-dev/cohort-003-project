import { useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { MessageSquare, Clock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { UserAvatar } from "~/components/user-avatar";
import { CommentStatus } from "~/db/schema";
import { cn } from "~/lib/utils";

type Comment = {
  id: number;
  userId: number;
  content: string;
  status: CommentStatus;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusBadge({ status }: { status: CommentStatus }) {
  if (status === CommentStatus.Approved) return null;
  return (
    <span
      className={cn(
        "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
        status === CommentStatus.Pending
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
      )}
    >
      {status === CommentStatus.Pending ? "Pending review" : "Rejected"}
    </span>
  );
}

export function CommentSection({
  comments,
  currentUserId,
  isEnrolled,
  lessonId,
}: {
  comments: Comment[];
  currentUserId: number | null;
  isEnrolled: boolean;
  lessonId: number;
}) {
  const fetcher = useFetcher({ key: `comment-${lessonId}` });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [fetcher.state, fetcher.data]);

  const optimisticComment =
    isSubmitting && fetcher.formData
      ? {
          id: -1,
          userId: currentUserId ?? -1,
          content: String(fetcher.formData.get("content") ?? ""),
          status: CommentStatus.Pending,
          createdAt: new Date().toISOString(),
          authorName: "You",
          authorAvatarUrl: null,
        }
      : null;

  const displayComments = optimisticComment
    ? [optimisticComment, ...comments]
    : comments;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center gap-2">
        <MessageSquare className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Comments</h2>
        {comments.length > 0 && (
          <span className="text-sm text-muted-foreground">
            ({comments.filter((c) => c.status === CommentStatus.Approved).length} approved)
          </span>
        )}
      </div>

      {isEnrolled && currentUserId && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <fetcher.Form
              method="post"
              action="/api/lesson-comment"
              onSubmit={(e) => {
                const form = e.currentTarget;
                const textarea = form.querySelector("textarea");
                if (!textarea?.value.trim()) {
                  e.preventDefault();
                  return;
                }
                const formData = new FormData();
                formData.set("content", textarea.value.trim());
                formData.set("lessonId", String(lessonId));
                fetcher.submit(
                  { content: textarea.value.trim(), lessonId },
                  {
                    method: "post",
                    action: "/api/lesson-comment",
                    encType: "application/json",
                  }
                );
                e.preventDefault();
              }}
            >
              <Textarea
                ref={textareaRef}
                name="content"
                placeholder="Ask a question or leave a comment..."
                rows={3}
                maxLength={2000}
                disabled={isSubmitting}
                className="mb-3 resize-none"
              />
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? "Posting..." : "Post Comment"}
              </Button>
            </fetcher.Form>
          </CardContent>
        </Card>
      )}

      {displayComments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to ask a question!
        </p>
      ) : (
        <div className="space-y-4">
          {displayComments.map((comment) => (
            <div
              key={comment.id}
              className={cn(
                "flex gap-3",
                comment.status === CommentStatus.Rejected && "opacity-60"
              )}
            >
              <UserAvatar
                name={comment.authorName}
                avatarUrl={comment.authorAvatarUrl}
                className="mt-0.5 size-8 shrink-0"
              />
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  <StatusBadge status={comment.status} />
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />
                    {formatRelativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
