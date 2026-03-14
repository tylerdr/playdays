# playdays — Agent Guide

> Keep this file under 100 lines. It's a map, not a manual. Point to documents/ for depth.

---

## Stack
- Next.js 15 (app router), TypeScript, Supabase, shadcn/ui, Tailwind v4
- Vercel hosting, Vercel AI SDK

## Commands
```bash
npm run dev      # start local dev server
npm run build    # build and typecheck
npm run lint     # lint
npm test         # run test suite
```

## Code Standards
- **UI components:** Always use shadcn/ui — never raw HTML elements
- **Theming:** CSS variables (no hardcoded colors)
- **TypeScript:** Strict mode, no `any`
- **Accessibility:** All interactive elements must be keyboard navigable
- **Logging:** No `console.log` in production code

## Git Workflow
- Feature branch → PR → merge (never push to main directly)
- Branch naming: `feature/description`, `fix/description`, `chore/description`
- PRs must pass: lint + typecheck + build

## Key Docs
Always read these at session start for non-trivial tasks:
- `documents/HANDOFF.md` — where we left off, what's next
- `documents/BACKLOG.md` — current tasks and priorities
- `documents/DECISIONS.md` — decisions already made (don't re-debate)
- `documents/SPEC.md` — product vision and feature definitions

## Architecture
[3-5 bullets describing core architecture patterns and key files]

---

## Session Protocol

### At session start (for any non-trivial task):
1. Read `documents/HANDOFF.md` to orient
2. Read `documents/BACKLOG.md` for priorities
3. Check `documents/DECISIONS.md` before major architectural choices
4. Capture Tyler's prompt: if Tyler's opening message includes new scope/direction, **append to `documents/PROMPTS.md` first** before doing any work

### At session end (mandatory, no exceptions):
1. **`documents/HANDOFF.md`** — overwrite with current state: what's done, what's next, key context
2. **`documents/CHANGELOG.md`** — append what shipped this session
3. **`documents/BACKLOG.md`** — check off completed items, add new debt/questions
4. **`documents/SPEC.md`** — update if scope changed this session
5. **Venture STATUS.md** — write 3-5 bullet summary to the venture workspace at:
   `~/openclaw/workspace/workspace-ventures/ai-ventures/ventures/playdays.com/STATUS.md`
6. Commit all `documents/` changes: `git add documents/ && git commit -m "docs: session handoff YYYY-MM-DD"`
