# PlayDays chat + email implementation plan — 2026-03-12

## Goal
Implement authenticated Supabase-backed server context for chat and daily digest flows, add lightweight event discovery and digest-composition agents, and preserve explicit degraded behavior for demo/local use when auth, OpenAI, or event data are unavailable.

## Scope
- Upgrade chat to use authenticated Supabase family profile, recent history, saved events, custom sources, and nearby discovered events when available.
- Keep honest fallback behavior for unauthenticated users and for missing Supabase/OpenAI/event tables.
- Add function-based server agents for event discovery and daily digest composition.
- Upgrade daily digest content to include today plan, upcoming events, and preference-aware notes.
- Add protected API trigger routes for digest delivery and event discovery.
- Update deployment cron config only where the route can skip safely when prerequisites are missing.

## Files expected
- `src/app/chat/page.tsx`
- `src/app/api/chat/route.ts`
- `src/app/api/email/daily-digest/route.ts`
- `src/app/api/events/discover/route.ts`
- `src/components/chat-assistant.tsx`
- `src/lib/server/email.ts`
- `src/lib/server/ai.ts`
- `src/lib/server/plan.ts`
- `src/lib/server/agents/daily-digest.ts`
- `src/lib/server/agents/event-discovery.ts`
- `src/lib/server/family-context.ts`
- `src/lib/server/supabase-admin.ts`
- `vercel.json`
- `STATUS_CHAT_EMAIL.md`

## Assumptions
- Auth UI and middleware are still incomplete, so server reads must treat Supabase auth as optional.
- Newer Supabase tables from the refined plan may not exist in every environment yet; loaders must catch missing-table errors and continue.
- Event discovery results from AI are low-confidence and must be labeled as such in stored metadata and in downstream notes.
- Local storage remains the primary fallback for demo and pre-auth flows.

## Execution notes
1. Create shared server helpers for session lookup, profile/history/event loading, and service-role access.
2. Pass authenticated server bootstrap data into chat while keeping local/demo mode explicit in the UI.
3. Move digest composition into a typed agent that can use plan output, saved events, custom sources, history, and weather.
4. Add a protected event discovery trigger that supports cron or authenticated user requests and skips safely when prerequisites are missing.
5. Validate with lint, typecheck, and build, then write status and commit.
