# STATUS_CHAT_EMAIL

## What changed
- Chat now prefers authenticated Supabase-backed family context on the server when available, including profile, recent history, saved events, custom sources, and nearby upcoming events.
- Chat keeps explicit degraded behavior for anonymous users, missing Supabase rows, and missing OpenAI, while preserving local browser/demo fallback modes.
- Added lightweight server agents for daily digest composition and AI-assisted event discovery with honest low-confidence labeling.
- Daily digest delivery now supports cron or authenticated-user triggers, reads Supabase family data when available, falls back to the legacy env-profile path when needed, and logs digest attempts when `daily_digest_logs` exists.
- Added a protected `/api/events/discover` trigger route for cron or authenticated requests, plus a safe cron hook that skips cleanly when `PLAYDAYS_EVENT_DISCOVERY_AREA`, OpenAI, or service-role storage are unavailable.
- Added a scoped implementation plan in `documents/plan-chat-email-2026-03-12.md`.

## Files changed
- `documents/plan-chat-email-2026-03-12.md`
- `src/app/api/chat/route.ts`
- `src/app/api/email/daily-digest/route.ts`
- `src/app/api/events/discover/route.ts`
- `src/app/chat/page.tsx`
- `src/components/chat-assistant.tsx`
- `src/lib/server/agents/daily-digest.ts`
- `src/lib/server/agents/event-discovery.ts`
- `src/lib/server/email.ts`
- `src/lib/server/family-context.ts`
- `src/lib/server/plan.ts`
- `src/lib/server/request-auth.ts`
- `src/lib/server/supabase-admin.ts`
- `vercel.json`

## Open questions
- `saved_events`, `custom_sources`, `events`, and `event_discovery_runs` are treated as optional. If the refined-plan migration is not applied yet, the new routes degrade safely but those context sections stay empty.
- Event discovery remains AI-generated and intentionally low-confidence. It is stored and surfaced as “verify before going,” not as verified local listings.
- The cron routes now expect `CRON_SECRET` for protection. Event discovery cron also expects `PLAYDAYS_EVENT_DISCOVERY_AREA` if you want it to do real work.

## Validation
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Notes
- No `/events` UI or auth middleware was added in this pass.
- Existing local/demo chat behavior remains available when authenticated Supabase context is missing.
