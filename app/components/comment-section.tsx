import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { UserAvatar } from "~/components/user-avatar";
import { MessageSquare, Pin, Trash2, Reply } from "lucide-react";
import type { UserRole } from "~/db/schema";

type Comment = {
  id: number;
  lessonId: number;
  userId: number;
  parentId: number | null;
  content: string;
  status: string;
  isPinned: boolean;
  createdAt: string;
  authorName: string;
  authorAvatarUrl: string | null;
  authorRole: string;
  replies: Comment[];
};

function timeAgo(isoString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function CommentForm({
  lessonId,
  parentId,
  placeholder,
  onCancel,
}: {
  lessonId: number;
  parentId?: number;
  placeholder: string;
  onCancel?: () => void;
}) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (!content.trim()) return;
    const formData = new FormData();
    formData.set("intent", "add-comment");
    formData.set("content", content.trim());
    if (parentId !== undefined) {
      formData.set("parentId", String(parentId));
    }
    fetcher.submit(formData, { method: "post" });
    setContent("");
    onCancel?.();
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={2000}
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? "Posting..." : "Post"}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  lessonId,
  currentUserId,
  canModerate,
  courseInstructorId,
  isReply,
}: {
  comment: Comment;
  lessonId: number;
  currentUserId: number;
  canModerate: boolean;
  courseInstructorId?: number;
  isReply?: boolean;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const fetcher = useFetcher();

  const isOwn = comment.userId === currentUserId;
  const canDelete = isOwn || canModerate;
  const isInstructor = comment.authorRole === "instructor";
  const isDeleted = comment.status === "deleted";

  if (isDeleted) {
    return (
      <div className={isReply ? "ml-10 border-l-2 border-muted pl-4" : ""}>
        <p className="text-sm italic text-muted-foreground">
          [Deleted] &middot; {timeAgo(comment.createdAt)}
        </p>

        {!isReply && (
          <div className="mt-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setShowReplyForm(!showReplyForm)}
            >
              <Reply className="mr-1 size-3" />
              Reply
            </Button>
          </div>
        )}

        {showReplyForm && (
          <div className="mt-2">
            <CommentForm
              lessonId={lessonId}
              parentId={comment.id}
              placeholder="Write a reply..."
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}

        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                lessonId={lessonId}
                currentUserId={currentUserId}
                canModerate={canModerate}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={isReply ? "ml-10 border-l-2 border-muted pl-4" : ""}>
      <div className="flex gap-3">
        <UserAvatar
          name={comment.authorName}
          avatarUrl={comment.authorAvatarUrl}
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.authorName}</span>
            {isInstructor && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                Instructor
              </span>
            )}
            {comment.isPinned && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <Pin className="size-3" />
                Pinned
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>

          <div className="mt-1.5 flex items-center gap-1">
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <Reply className="mr-1 size-3" />
                Reply
              </Button>
            )}
            {canDelete && (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete-comment" />
                <input
                  type="hidden"
                  name="commentId"
                  value={String(comment.id)}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="mr-1 size-3" />
                  Delete
                </Button>
              </fetcher.Form>
            )}
            {canModerate && !isReply && (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="pin-comment" />
                <input
                  type="hidden"
                  name="commentId"
                  value={String(comment.id)}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                >
                  <Pin className="mr-1 size-3" />
                  {comment.isPinned ? "Unpin" : "Pin"}
                </Button>
              </fetcher.Form>
            )}
          </div>

          {showReplyForm && (
            <div className="mt-2">
              <CommentForm
                lessonId={lessonId}
                parentId={comment.id}
                placeholder="Write a reply..."
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              lessonId={lessonId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({
  comments,
  lessonId,
  currentUserId,
  canModerate,
  enrolled,
}: {
  comments: Comment[];
  lessonId: number;
  currentUserId: number;
  canModerate: boolean;
  enrolled: boolean;
}) {
  const totalCount = comments.reduce(
    (sum, c) => sum + 1 + c.replies.length,
    0
  );

  return (
    <div className="mt-8 border-t pt-8">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-5" />
        Discussion
        {totalCount > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            ({totalCount})
          </span>
        )}
      </h3>

      {enrolled && (
        <div className="mt-4">
          <CommentForm
            lessonId={lessonId}
            placeholder="Ask a question or share your thoughts..."
          />
        </div>
      )}

      {comments.length > 0 ? (
        <div className="mt-6 space-y-6">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              lessonId={lessonId}
              currentUserId={currentUserId}
              canModerate={canModerate}
            />
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No comments yet. Be the first to start a discussion!
        </p>
      )}
    </div>
  );
}
