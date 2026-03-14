#!/bin/bash
# Fires on SessionEnd — injects reminder to complete handoff docs
# systemMessage must be top-level (not inside hookSpecificOutput) for SessionEnd

TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

jq -n \
  --arg ts "$TIMESTAMP" \
  --arg br "$BRANCH" \
  '{
    systemMessage: ("SESSION ENDING — " + $ts + " on branch " + $br +
      ". MANDATORY BEFORE CLOSING: " +
      "(1) Update documents/HANDOFF.md with what was done and what is next. " +
      "(2) Append to documents/CHANGELOG.md if anything shipped. " +
      "(3) Update documents/BACKLOG.md task status. " +
      "(4) Write 3-5 bullet update to the venture STATUS.md. " +
      "(5) Commit: git add documents/ && git commit -m \"docs: session handoff $(date +%Y-%m-%d)\"")
  }'
