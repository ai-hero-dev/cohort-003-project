import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import { MessageSquare, EyeOff, Eye, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { cn } from "~/lib/utils";

type Comment = {
  id: number;
  userId: number;
  content: string;
  contentHtml: string;
  status: string;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function LessonComments({
  comments,
  lessonId,
  currentUserId,
  isInstructorOrAdmin,
  canComment,
}: {
  comments: Comment[];
  lessonId: number;
  currentUserId: number | null;
  isInstructorOrAdmin: boolean;
  canComment: boolean;
}) {
  const postFetcher = useFetcher({ key: `post-comment-${lessonId}` });
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isPosting = postFetcher.state !== "idle";

  useEffect(() => {
    if (postFetcher.state === "idle" && postFetcher.data?.commentPosted) {
      setContent("");
      toast.success("Comment posted");
    }
  }, [postFetcher.state, postFetcher.data]);

  const visibleCount = comments.filter((c) => c.status === "visible").length;

  return (
    <div className="mb-8 border-t pt-8">
      <div className="mb-6 flex items-center gap-2">
        <MessageSquare className="size-5" />
        <h2 className="text-xl font-semibold">Discussion</h2>
        <span className="text-sm text-muted-foreground">
          ({visibleCount})
        </span>
      </div>

      {canComment && (
        <postFetcher.Form method="post" className="mb-6">
          <input type="hidden" name="intent" value="post-comment" />
          <Textarea
            ref={textareaRef}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a comment... (Markdown supported)"
            rows={3}
            className="mb-2 resize-y"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPosting || content.trim().length === 0}
          >
            {isPosting ? "Posting..." : "Post Comment"}
          </Button>
        </postFetcher.Form>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to start a discussion.
        </p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              isInstructorOrAdmin={isInstructorOrAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  isInstructorOrAdmin,
}: {
  comment: Comment;
  currentUserId: number | null;
  isInstructorOrAdmin: boolean;
}) {
  const moderateFetcher = useFetcher({ key: `moderate-${comment.id}` });
  const isOwner = currentUserId === comment.userId;
  const isHidden = comment.status === "hidden";
  const isActing = moderateFetcher.state !== "idle";

  useEffect(() => {
    if (moderateFetcher.state === "idle" && moderateFetcher.data?.commentHidden) {
      toast.success("Comment hidden");
    }
    if (moderateFetcher.state === "idle" && moderateFetcher.data?.commentUnhidden) {
      toast.success("Comment restored");
    }
    if (moderateFetcher.state === "idle" && moderateFetcher.data?.commentDeleted) {
      toast.success("Comment deleted");
    }
  }, [moderateFetcher.state, moderateFetcher.data]);

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isHidden && "border-dashed border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30"
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <UserAvatar
            name={comment.authorName}
            avatarUrl={comment.authorAvatarUrl}
            className="size-7"
          />
          <span className="text-sm font-medium">{comment.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(comment.createdAt)}
          </span>
          {isHidden && (
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-800 dark:text-amber-200">
              Hidden
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {isInstructorOrAdmin && (
            <>
              {isHidden ? (
                <moderateFetcher.Form method="post">
                  <input type="hidden" name="intent" value="unhide-comment" />
                  <input type="hidden" name="commentId" value={comment.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isActing}
                    title="Restore comment"
                  >
                    <Eye className="size-4" />
                  </Button>
                </moderateFetcher.Form>
              ) : (
                <moderateFetcher.Form method="post">
                  <input type="hidden" name="intent" value="hide-comment" />
                  <input type="hidden" name="commentId" value={comment.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={isActing}
                    title="Hide comment"
                  >
                    <EyeOff className="size-4" />
                  </Button>
                </moderateFetcher.Form>
              )}
            </>
          )}

          {(isOwner || isInstructorOrAdmin) && (
            <moderateFetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-comment" />
              <input type="hidden" name="commentId" value={comment.id} />
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                disabled={isActing}
                className="text-destructive hover:text-destructive"
                title="Delete comment"
              >
                <Trash2 className="size-4" />
              </Button>
            </moderateFetcher.Form>
          )}
        </div>
      </div>

      <div
        className="prose prose-sm prose-neutral dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: comment.contentHtml }}
      />
    </div>
  );
}
