# PlayDays design, functional, and positioning review plan — 2026-03-12

## Goal
Audit every user-facing page and core feature in PlayDays, with special attention to new functionality and the returning-user / pseudo-logged-in experience, then document findings and fix the issues in priority order.

## Why this cycle matters
This is the next non-trivial repo cycle for PlayDays. The repo previously lacked the minimum docs foundation, so this cycle starts by backfilling `/documents/` and `AGENTS.md` before deeper execution.

## Research notes informing this review
### External onboarding/activation guidance
- UXCam onboarding roundup: progressive onboarding, minimal friction, and getting users to the aha moment quickly are common patterns in successful mobile apps.
- Plotline onboarding roundup: delay unnecessary signup friction, personalize with a few smart questions, drive quick wins early, and use in-context prompts/tooltips to activate key behaviors.

### Applied implications for PlayDays
- The first-run setup should feel progressive, not exhausting.
- The product should get to a useful plan quickly after setup.
- Returning-user state should feel faster and calmer than first-run state.
- Empty states, demo states, and degraded API/fallback states matter a lot because true auth/persistence is not fully shipped yet.
- Positioning should emphasize relief from decision fatigue and “one good plan for today,” not generic AI magic.

## Pages/routes to review
- `/`
- `/start-setup`
- `/onboard`
- `/today`
- `/discover`
- `/chat`
- `/history`
- `/settings`

## Key feature surfaces to test
- Onboarding/profile save flow
- Returning-user hydration from localStorage
- Daily plan generation
- Refresh full day
- Replace/skip/save/done activity actions
- Discovery search and pin-to-today flow
- Chat assistant prompts and responses
- History and saved items surfaces
- Mobile nav and sheet nav
- Empty states / no-profile states / demo-family states

## Logged-in experience note
There appears to be no fully shipped auth wall yet. For this review, “logged-in experience” means:
- user has completed setup or loaded demo family
- localStorage is hydrated
- returning-user flows, saved data, and app navigation behave like a signed-in state

## Deliverables
1. A written review doc in `documents/review-design-functional-positioning-2026-03-12.md`
2. Full-page/page-level screenshots of core routes during review (captured via browser tooling; direct Chrome CDP/headless capture is acceptable if the OpenClaw browser relay is unstable)
3. A design-review-skill critique pass that explicitly scores design while also covering functionality and market positioning
4. A prioritized issue list: critical / major / minor
5. Follow-on fix passes for the highest-value issues (out of scope for this review-only subagent unless separately requested)
6. Validation notes after fixes (`lint`, `typecheck`, `build`, plus manual browser retest)

## Scope / assumptions update — 2026-03-12 review pass
- Auth is still not fully shipped, so the review treats the “logged-in” experience as a localStorage-hydrated returning-user state after setup or demo-family load.
- The OpenClaw browser relay was unreliable in this run, so route capture may use direct Chrome CDP/headless screenshots against `http://localhost:3000`.
- This pass is review/documentation focused. It will identify and prioritize issues, not implement fixes unless a separate execution step is requested.

## Scope / assumptions update — 2026-03-12 fix pass
- This pass executes the fixes requested from `documents/review-design-functional-positioning-2026-03-12.md`, staying inside the reviewed issue list unless a directly related fix is required.
- Trust and product honesty take priority over feature breadth, especially for fallback/demo states and missing external integrations.
- `/start-setup` is the canonical onboarding route. `/onboard` should remain only as a compatibility redirect unless implementation constraints force a different approach.
- Settings should preserve the existing profile-editing logic, but the default surface should feel like maintenance rather than first-run onboarding.

## Execution approach
### Phase 0 — foundation
- [x] Backfill `/documents/` pack and repo `AGENTS.md`
- [x] Update this plan if findings change scope

### Phase 1 — audit setup
- [x] Run local app
- [x] Capture baseline screenshots for key reviewed routes (`/`, `/start-setup`, `/onboard`, `/today`, `/chat`, `/history`, `/settings`; `/discover` reviewed functionally and via API/code even though the direct screenshot pass was less reliable)
- [~] Test mobile and desktop layouts (desktop directly reviewed; mobile assessed selectively and should get a dedicated follow-up screenshot pass if fixes are made)
- [x] Test empty-state and returning-user state

### Phase 2 — review
- [~] Run an Opus subagent review using the design-review skill (attempted, but Anthropic image review hit rate limits; completed the same structured pass with screenshot analysis and the design-review framework)
- [x] Focus review output on three dimensions: design, functionality, positioning
- [x] Write findings into `documents/review-design-functional-positioning-2026-03-12.md`

### Phase 3 — fixes
- [x] Prioritize issues by launch/user impact
- [x] Fix weather-unit trust issues end to end
- [x] Make chat degrade gracefully when OpenAI is unavailable
- [x] Remove silent demo-family context in chat and label demo/example mode explicitly
- [x] Make discovery fallback honest and useful without leaking internal source states
- [x] Separate marketing/setup shell behavior from in-app navigation
- [x] Canonicalize onboarding to `/start-setup` and redirect `/onboard`
- [x] Make `/settings` feel like settings first, not forced re-onboarding
- [x] Make discovery and pinned-outing CTAs truthful about what they do
- [x] Remove history claims that overstate learning
- [x] Tighten secondary-screen hierarchy/copy where it directly supports the reviewed issues
- [x] Keep scope explicit and update docs/plan when implementation reality changes

### Phase 4 — validation
- [ ] Re-test changed flows in browser
- [x] Run `npm run lint`
- [x] Run `npm run typecheck`
- [x] Run `npm run build`
- [ ] Commit review docs and fixes

## Likely files to touch
- `src/app/page.tsx`
- `src/app/onboard/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/start-setup/page.tsx`
- `src/app/api/chat/route.ts`
- `src/components/chat-assistant.tsx`
- `src/components/discover-board.tsx`
- `src/components/history-board.tsx`
- `src/components/profile-form.tsx`
- `src/components/site-shell.tsx`
- `src/components/today-board.tsx`
- `src/lib/schemas.ts`
- `src/lib/server/discovery.ts`
- `src/lib/server/weather.ts`
- `src/lib/server/plan.ts`
- `src/lib/site.ts`
- `documents/*`
- `AGENTS.md`

## Fix pass notes — 2026-03-12
- Weather now requests Fahrenheit directly from Open-Meteo so `/today` temperatures and planning thresholds align again.
- Chat now has three honest states: saved-family context, explicit example-family context, and generic pre-setup help. The API route falls back to streamed backup guidance instead of 500ing when OpenAI is unavailable.
- Discovery fallback no longer pretends placeholder category names are vetted venues. Fallback cards are framed as map-ready searches, and only verified Google results can be pinned as the outing anchor for `/today`.
- The site shell is now split by intent: marketing, setup, and in-app views do not share the same route exposure.
- `/onboard` is kept as a compatibility redirect to `/start-setup`.
- `/settings` now defaults to a summary/maintenance surface and only opens the full stepper when the parent chooses to edit.

## Validation notes — 2026-03-12
- `npm run lint` passed.
- `npm run typecheck` passed after rerunning with write access because TypeScript needed to emit `tsconfig.tsbuildinfo`.
- `npm run build` passed.

## Things to avoid touching unless clearly required
- Supabase schema/migrations
- unrelated deployment config
- broad visual rewrites that do not map to a specific review finding
