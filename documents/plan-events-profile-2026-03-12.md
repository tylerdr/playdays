# PlayDays events + profile implementation plan — 2026-03-12

## Scope
- Implement the events-system database pieces from the refined v2 plan:
  - `events`
  - `saved_events`
  - `custom_sources`
  - `event_discovery_runs`
- Build `/events` feed and `/events/[id]` detail
- Add reusable event feed/card UI with filters and save actions
- Replace `/settings` with a unified `/profile` experience
- Add forms for schedule preferences, activity preferences, and custom recurring sources
- Keep fallback behavior explicit and honest when the shared event feed is not wired

## Constraints
- Do not add auth middleware in this pass
- Assume auth/persistence foundation will merge later
- Keep contracts aligned with future Supabase-backed auth
- Preserve the existing localStorage demo/returning-user flow
- Do not fabricate event placeholders and present them as real events

## Files likely to touch
- `documents/plan-events-profile-2026-03-12.md`
- `supabase/migrations/20260312090000_events_profile.sql`
- `src/app/events/page.tsx`
- `src/app/events/[id]/page.tsx`
- `src/app/profile/page.tsx`
- `src/app/settings/page.tsx`
- `src/app/api/events/route.ts`
- `src/app/api/events/discover/route.ts`
- `src/components/event-card.tsx`
- `src/components/event-feed.tsx`
- `src/components/event-detail.tsx`
- `src/components/profile-hub.tsx`
- `src/components/profile-form.tsx`
- `src/components/schedule-prefs-form.tsx`
- `src/components/activity-prefs-form.tsx`
- `src/components/custom-source-form.tsx`
- `src/components/site-shell.tsx`
- `src/lib/events.ts`
- `src/lib/schemas.ts`
- `src/lib/storage.ts`
- `src/lib/storage-types.ts`
- `src/lib/site.ts`
- `src/lib/server/events.ts`
- `src/lib/server/agents/event-discovery.ts`
- `STATUS_EVENTS.md`

## Execution plan
1. [x] Extend shared schemas and local storage helpers for schedule prefs, activity prefs, saved events, and custom sources.
2. [x] Add the Supabase migration for the shared event tables and a server utility layer for reading/discovery.
3. [x] Build the `/events` feed/detail flow with honest empty and unavailable states.
4. [x] Replace settings with a unified profile page that reuses the existing family profile editor and adds the new tabs/forms.
5. [x] Validate with `lint`, `typecheck`, and `build`, then write status notes and commit.

## Implementation notes
- Public event reads should work when Supabase is configured, but the UI must still render useful empty states when it is not.
- Save actions will remain local-device cache in this pass unless a working authenticated server path is available.
- The profile page should consolidate maintenance flows rather than reopen first-run onboarding by default.

## Validation
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Reality changes during implementation
- `/api/events` keeps a clean POST contract for later auth-backed save/unsave work, but current save actions intentionally stay local-device only.
- `/api/events/discover` is wired for service-role + OpenAI environments and otherwise returns an explicit unavailable state instead of inventing events.
