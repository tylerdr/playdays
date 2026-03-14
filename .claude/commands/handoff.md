# Session Handoff

Generate a session handoff document. Review what was accomplished this session and:

1. **Overwrite documents/HANDOFF.md** with: status, what is done, pick-up instructions, key context, decisions made, tech debt created, files changed
2. **Append to documents/CHANGELOG.md** for anything that shipped
3. **Update documents/BACKLOG.md** — check off completed tasks, add new debt or open questions
4. **Update documents/SPEC.md** if scope changed this session
5. **Write 3-5 bullet update to the venture STATUS.md** at the appropriate workspace-ventures path

Then commit: `git add documents/ && git commit -m "docs: session handoff $(date +%Y-%m-%d)"`
