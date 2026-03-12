# AGENTS.md

PlayDays repo instructions for agents.

## Reference docs
- `documents/platform-docs.md`
- `documents/ICPs.md`
- `documents/styleguide.md`
- `documents/vision.md`
- `documents/data-reference.md`
- Active review/fix plan: `documents/plan-design-functional-review-2026-03-12.md`

## Commands
- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

## Architecture constraints
- Next.js 16 app router in `src/app`
- UI is mobile-first and uses Tailwind v4 + shadcn-style primitives from `src/components/ui`
- Product currently behaves like a lightweight PWA with localStorage-backed state; real auth/persistence is not fully shipped yet
- Server routes live under `src/app/api/*` and should degrade gracefully when external keys are missing
- Prefer improving existing flows/components before adding new abstractions

## Footguns / do not do
- Do not introduce hard dependency on OpenAI / Google Places for baseline UX; fallback paths are part of the MVP promise
- Do not break the local demo flow; empty-state and demo-state behavior are core review surfaces
- Do not silently change slot order (`outdoor`, `indoor`, `adventure`, `calm`, `together`) without updating docs and generation logic
- Do not store assumptions only in chat; write them into docs/plan/status files

## Scope discipline
- For non-trivial work: research first, save/update a markdown plan, then execute against it
- Name files you will touch before broad changes
- Update the plan when reality changes instead of drifting
