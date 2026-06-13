import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { CommentStatus, type CommentStatus as CommentStatusType } from "~/db/schema";
import {
  MessageSquare,
  Pencil,
  Trash2,
  Flag,
  EyeOff,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { cn } from "~/lib/utils";

export type CommentItemModel = {
  id: number;
  lessonId: number;
  userId: number;
  parentId: number | null;
  body: string;
  status: CommentStatusType;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

type Props = {
  comment: CommentItemModel;
  currentUserId: number | null;
  canPost: boolean;
  canModerate: boolean;
  isReply: boolean;
};

export function CommentItem({
  comment,
  currentUserId,
  canPost,
  canModerate,
  isReply,
}: Props) {
  const isAuthor = currentUserId === comment.userId;
  const isHidden = comment.status === CommentStatus.Hidden;
  const isDeleted = !!comment.deletedAt;

  const editFetcher = useFetcher({ key: `edit-${comment.id}` });
  const deleteFetcher = useFetcher({ key: `delete-${comment.id}` });
  const reportFetcher = useFetcher({ key: `report-${comment.id}` });
  const moderateFetcher = useFetcher({ key: `moderate-${comment.id}` });

  const [editing, setEditing] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    if (editFetcher.state === "idle" && editFetcher.data?.ok) {
      setEditing(false);
    }
  }, [editFetcher.state, editFetcher.data]);

  useEffect(() => {
    if (reportFetcher.state === "idle" && reportFetcher.data?.ok) {
      setReported(true);
    }
  }, [reportFetcher.state, reportFetcher.data]);

  // Hidden placeholder — but only for non-moderators. Moderators see the
  // original body (with a banner) so they can unhide intelligently.
  if (isHidden && !canModerate) {
    return (
      <CommentShell isReply={isReply} hidden>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" />
          Removed by instructor
        </div>
      </CommentShell>
    );
  }

  return (
    <CommentShell isReply={isReply} hidden={isHidden}>
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <Avatar name={comment.authorName} url={comment.authorAvatarUrl} />
        <span className="text-sm font-medium">{comment.authorName}</span>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(comment.createdAt)}
        </span>
        {comment.editedAt && (
          <span className="text-xs text-muted-foreground">(edited)</span>
        )}
        {isHidden && canModerate && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            Hidden
          </span>
        )}
      </div>

      {/* Body */}
      {isDeleted ? (
        <p className="text-sm italic text-muted-foreground">[deleted]</p>
      ) : editing ? (
        <editFetcher.Form method="post" action="/api/lesson-comments">
          <input type="hidden" name="intent" value="edit" />
          <input type="hidden" name="commentId" value={comment.id} />
          <Textarea
            name="body"
            defaultValue={comment.body}
            rows={3}
            required
            maxLength={2000}
            className="mb-2"
          />
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={editFetcher.state !== "idle"}
            >
              {editFetcher.state !== "idle" ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </editFetcher.Form>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      )}

      {/* Actions */}
      {!isDeleted && !editing && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {isAuthor && !isHidden && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
                Edit
              </button>
              <deleteFetcher.Form method="post" action="/api/lesson-comments">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="commentId" value={comment.id} />
                <button
                  type="submit"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    if (!confirm("Delete this comment?")) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="size-3" />
                  Delete
                </button>
              </deleteFetcher.Form>
            </>
          )}

          {!isAuthor && canPost && !isHidden && (
            <>
              {reported ? (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Flag className="size-3" />
                  Reported
                </span>
              ) : (
                <reportFetcher.Form method="post" action="/api/lesson-comments">
                  <input type="hidden" name="intent" value="report" />
                  <input type="hidden" name="commentId" value={comment.id} />
                  <button
                    type="submit"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    disabled={reportFetcher.state !== "idle"}
                  >
                    <Flag className="size-3" />
                    Report
                  </button>
                </reportFetcher.Form>
              )}
            </>
          )}

          {canModerate && (
            <moderateFetcher.Form method="post" action="/api/lesson-comments">
              <input
                type="hidden"
                name="intent"
                value={isHidden ? "unhide" : "hide"}
              />
              <input type="hidden" name="commentId" value={comment.id} />
              <button
                type="submit"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                disabled={moderateFetcher.state !== "idle"}
              >
                {isHidden ? (
                  <>
                    <Eye className="size-3" />
                    Unhide
                  </>
                ) : (
                  <>
                    <EyeOff className="size-3" />
                    Hide
                  </>
                )}
              </button>
            </moderateFetcher.Form>
          )}
        </div>
      )}

      {/* Reply form (top-level only) */}
      {!isReply && !isDeleted && !isHidden && canPost && !isAuthor && (
        <ReplyForm lessonId={comment.lessonId} parentId={comment.id} />
      )}
    </CommentShell>
  );
}

function CommentShell({
  children,
  isReply,
  hidden,
}: {
  children: React.ReactNode;
  isReply: boolean;
  hidden?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        isReply && "ml-8 border-l-2 border-l-muted",
        hidden && "bg-muted/40"
      )}
    >
      {children}
    </div>
  );
}

function ReplyForm({
  lessonId,
  parentId,
}: {
  lessonId: number;
  parentId: number;
}) {
  const fetcher = useFetcher({ key: `reply-${parentId}` });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setOpen(false);
      if (ref.current) ref.current.value = "";
    }
  }, [fetcher.state, fetcher.data]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <MessageSquare className="size-3" />
        Reply
      </button>
    );
  }

  return (
    <fetcher.Form
      method="post"
      action="/api/lesson-comments"
      className="mt-3"
    >
      <input type="hidden" name="intent" value="reply" />
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="parentId" value={parentId} />
      <Textarea
        ref={ref}
        name="body"
        rows={2}
        placeholder="Write a reply..."
        required
        maxLength={2000}
        className="mb-2"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={fetcher.state !== "idle"}>
          {fetcher.state !== "idle" ? "Posting..." : "Reply"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="size-6 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {initials}
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}
