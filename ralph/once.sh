#!/bin/bash

issues=$(gh issue list --state open --json number,title,body,comments)
commits=$(git log -n 5 --format="%H%n%ad%n%B---" --date=short 2>/dev/null || echo "No commits found")
prompt=$(cat ralph/prompt.md)

claude --permission-mode acceptEdits \
  "Previous commits: $commits $issues $prompt"
