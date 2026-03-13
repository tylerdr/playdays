# STATUS_EVENTS

## What changed
- Added a scoped Supabase migration for `events`, `saved_events`, `custom_sources`, and `event_discovery_runs`.
- Added shared schemas and local-storage support for:
  - schedule preferences
  - activity preferences
  - saved event lists
  - recurring custom sources
- Built `/events` and `/events/[id]` with:
  - honest shared-feed loading states
  - on-device save actions
  - recurring-program visibility
  - detail-page saved-list actions
- Added `/api/events` and `/api/events/discover` contracts for shared-feed reads and future discovery/save wiring.
- Replaced the old settings destination with a unified `/profile` hub:
  - Overview
  - Schedule
  - Preferences
  - Saved
  - Programs
- Updated app navigation to expose `Events` and `Profile`, with `/settings` now redirecting to `/profile`.

## Open questions
- Saved events still persist locally because auth/session-backed writes are intentionally out of scope for this pass.
- Shared event discovery requires `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and an OpenAI key; without them the UI/API return explicit unavailable states.
- The current public feed assumes event rows can be read directly from Supabase with the new SELECT policy. If auth rollout changes that access path, `src/lib/server/events.ts` will need to switch to the approved server client pattern for that phase.

## Validation
- `npm install` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
