import { useRef, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { MessageSquare, Clock, Pencil, Trash2, Reply, X, Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { UserAvatar } from "~/components/user-avatar";
import { CommentStatus, UserRole } from "~/db/schema";
import { cn } from "~/lib/utils";

type Comment = {
  id: number;
  userId: number;
  content: string;
  status: CommentStatus;
  createdAt: string;
  editedAt?: string | null;
  parentCommentId?: number | null;
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

function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  lessonId,
  replies,
  isEnrolled,
}: {
  comment: Comment;
  currentUserId: number | null;
  currentUserRole: UserRole | null;
  lessonId: number;
  replies: Comment[];
  isEnrolled: boolean;
}) {
  const fetcher = useFetcher({ key: `comment-action-${comment.id}` });
  const replyFetcher = useFetcher({ key: `reply-${comment.id}` });
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingJson: any = fetcher.state !== "idle" ? fetcher.json : null;

  const isDeleted = pendingJson?.intent === "delete";

  const canEdit = currentUserId === comment.userId;
  const canDelete =
    currentUserId === comment.userId ||
    currentUserRole === UserRole.Instructor ||
    currentUserRole === UserRole.Admin;

  useEffect(() => {
    if (replyFetcher.state === "idle" && replyFetcher.data?.ok && replyRef.current) {
      replyRef.current.value = "";
      setReplying(false);
    }
  }, [replyFetcher.state, replyFetcher.data]);

  if (isDeleted) return null;

  const displayContent =
    pendingJson?.intent === "edit" ? pendingJson.content : comment.content;

  const displayEdited = pendingJson?.intent === "edit" || !!comment.editedAt;

  function submitIntent(body: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetcher.submit(body as any, { method: "post", action: "/api/lesson-comment", encType: "application/json" });
  }

  return (
    <div className={cn("flex gap-3", comment.status === CommentStatus.Rejected && "opacity-60")}>
      <UserAvatar
        name={comment.authorName}
        avatarUrl={comment.authorAvatarUrl}
        className="mt-0.5 size-8 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium">{comment.authorName}</span>
          <StatusBadge status={comment.status} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {formatRelativeTime(comment.createdAt)}
          </span>
          {displayEdited && (
            <span className="text-xs text-muted-foreground">(edited)</span>
          )}
          <span className="ml-auto flex items-center gap-1">
            {canEdit && !editing && (
              <button
                type="button"
                onClick={() => { setEditing(true); setEditContent(comment.content); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit comment"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {canDelete && !editing && (
              <button
                type="button"
                onClick={() => submitIntent({ intent: "delete", commentId: comment.id })}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Delete comment"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        </div>

        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              maxLength={2000}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  const content = editContent.trim();
                  if (!content) return;
                  submitIntent({ intent: "edit", commentId: comment.id, content });
                  setEditing(false);
                }}
              >
                <Check className="size-3 mr-1" /> Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setEditing(false)}
              >
                <X className="size-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{displayContent}</p>
        )}

        {!editing && isEnrolled && currentUserId && !comment.parentCommentId && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Reply className="size-3" /> Reply
          </button>
        )}

        {replying && (
          <div className="mt-2 space-y-2">
            <Textarea
              ref={replyRef}
              placeholder="Write a reply..."
              rows={2}
              maxLength={2000}
              disabled={replyFetcher.state !== "idle"}
              className="resize-none text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={replyFetcher.state !== "idle"}
                onClick={() => {
                  const content = replyRef.current?.value.trim();
                  if (!content) return;
                  replyFetcher.submit(
                    { parentCommentId: comment.id, content, intent: "reply" },
                    { method: "post", action: "/api/lesson-comment", encType: "application/json" }
                  );
                }}
              >
                {replyFetcher.state !== "idle" ? "Posting..." : "Post Reply"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setReplying(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-muted pl-4">
            {replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                lessonId={lessonId}
                replies={[]}
                isEnrolled={isEnrolled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentSection({
  comments,
  currentUserId,
  currentUserRole,
  isEnrolled,
  lessonId,
}: {
  comments: Comment[];
  currentUserId: number | null;
  currentUserRole?: UserRole | null;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingJson: any = isSubmitting ? fetcher.json : null;
  const optimisticComment =
    isSubmitting && pendingJson?.intent === "create"
      ? {
          id: -1,
          userId: currentUserId ?? -1,
          content: String(pendingJson.content ?? ""),
          status: CommentStatus.Pending,
          createdAt: new Date().toISOString(),
          editedAt: null,
          parentCommentId: null,
          authorName: "You",
          authorAvatarUrl: null,
        }
      : null;

  const topLevel = (optimisticComment ? [optimisticComment, ...comments] : comments).filter(
    (c) => !c.parentCommentId
  );
  const repliesByParent = comments.reduce<Record<number, Comment[]>>((acc, c) => {
    if (c.parentCommentId) {
      acc[c.parentCommentId] = [...(acc[c.parentCommentId] ?? []), c];
    }
    return acc;
  }, {});

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
                fetcher.submit(
                  { content: textarea.value.trim(), lessonId, intent: "create" },
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

      {topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to ask a question!
        </p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole ?? null}
              lessonId={lessonId}
              replies={repliesByParent[comment.id] ?? []}
              isEnrolled={isEnrolled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
