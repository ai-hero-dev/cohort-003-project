import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card, CardContent } from "~/components/ui/card";
import { MessageSquare } from "lucide-react";
import { CommentItem, type CommentItemModel } from "./comment-item";

type Props = {
  lessonId: number;
  comments: CommentItemModel[];
  currentUserId: number | null;
  currentUserName: string | null;
  currentUserAvatarUrl: string | null;
  canPost: boolean;
  canModerate: boolean;
};

export function LessonComments({
  lessonId,
  comments,
  currentUserId,
  canPost,
  canModerate,
}: Props) {
  const topLevel = comments.filter((c) => c.parentId === null);
  const repliesByParent = new Map<number, CommentItemModel[]>();
  for (const c of comments) {
    if (c.parentId !== null) {
      const arr = repliesByParent.get(c.parentId) ?? [];
      arr.push(c);
      repliesByParent.set(c.parentId, arr);
    }
  }

  return (
    <section className="mb-8 mt-8 border-t pt-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <MessageSquare className="size-5" />
        Discussion
        <span className="text-sm font-normal text-muted-foreground">
          ({topLevel.length})
        </span>
      </h2>

      {currentUserId === null ? (
        <Card className="mb-4">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Sign in to join the discussion.
          </CardContent>
        </Card>
      ) : canPost ? (
        <Composer lessonId={lessonId} />
      ) : (
        <Card className="mb-4">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Enroll in this course to join the discussion.
          </CardContent>
        </Card>
      )}

      {topLevel.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No comments yet — be the first to start the discussion.
        </p>
      ) : (
        <div className="space-y-3">
          {topLevel.map((top) => {
            const replies = repliesByParent.get(top.id) ?? [];
            return (
              <div key={top.id} className="space-y-2">
                <CommentItem
                  comment={top}
                  currentUserId={currentUserId}
                  canPost={canPost}
                  canModerate={canModerate}
                  isReply={false}
                />
                {replies.map((r) => (
                  <CommentItem
                    key={r.id}
                    comment={r}
                    currentUserId={currentUserId}
                    canPost={canPost}
                    canModerate={canModerate}
                    isReply={true}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Composer({ lessonId }: { lessonId: number }) {
  const fetcher = useFetcher({ key: `composer-${lessonId}` });
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok && ref.current) {
      ref.current.value = "";
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <fetcher.Form
      method="post"
      action="/api/lesson-comments"
      className="mb-6"
    >
      <input type="hidden" name="intent" value="create" />
      <input type="hidden" name="lessonId" value={lessonId} />
      <Textarea
        ref={ref}
        name="body"
        rows={3}
        placeholder="Add to the discussion..."
        required
        maxLength={2000}
        className="mb-2"
      />
      <Button type="submit" disabled={fetcher.state !== "idle"}>
        {fetcher.state !== "idle" ? "Posting..." : "Post comment"}
      </Button>
    </fetcher.Form>
  );
}
