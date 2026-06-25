ALTER TABLE lesson_comments ADD COLUMN parent_comment_id INTEGER REFERENCES lesson_comments(id);
ALTER TABLE lesson_comments ADD COLUMN deleted_at TEXT;
ALTER TABLE lesson_comments ADD COLUMN edited_at TEXT;
