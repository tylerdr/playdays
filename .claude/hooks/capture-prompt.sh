#!/bin/bash
# Captures Tyler's prompt verbatim to documents/PROMPTS.md
# Fires on UserPromptSubmit before Claude processes the message

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M UTC')

[ -z "$PROMPT" ] && exit 0
[ -z "$(git rev-parse --show-toplevel 2>/dev/null)" ] && exit 0

ROOT=$(git rev-parse --show-toplevel)
PROMPTS_FILE="$ROOT/documents/PROMPTS.md"

[ ! -f "$PROMPTS_FILE" ] && exit 0

TMPFILE=$(mktemp)
cat > "$TMPFILE" << ENTRY

---

## $TIMESTAMP

**Tyler's exact words:**
> $PROMPT

**Classified as:** \`pending-review\`
**Spec impact:** pending

ENTRY

# Insert after header (line 4)
head -n 4 "$PROMPTS_FILE" > /tmp/prompts_merged.md
cat "$TMPFILE" >> /tmp/prompts_merged.md
tail -n +5 "$PROMPTS_FILE" >> /tmp/prompts_merged.md
mv /tmp/prompts_merged.md "$PROMPTS_FILE"
rm "$TMPFILE"
exit 0
