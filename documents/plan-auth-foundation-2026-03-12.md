# PlayDays auth foundation plan — 2026-03-12

## Goal
Implement Phase 1A and the scoped Phase 1B persistence migration in this worktree:
- Supabase magic-link auth
- SSR middleware session refresh
- login / verify / callback flow
- auth-aware navigation
- authenticated profile persistence to Supabase
- Supabase-first profile/history/saved persistence with localStorage kept as cache/fallback

## Files expected to change
- `supabase/migrations/20260312_v2_auth_events.sql`
- `src/middleware.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/storage.ts`
- `src/lib/schemas.ts`
- `src/lib/storage.ts`
- `src/app/auth/login/page.tsx`
- `src/app/auth/verify/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/page.tsx`
- `src/app/start-setup/page.tsx`
- `src/app/today/page.tsx`
- `src/app/history/page.tsx`
- `src/app/settings/page.tsx`
- `src/components/site-shell.tsx`
- `src/components/profile-form.tsx`
- `src/components/today-board.tsx`
- `src/components/history-board.tsx`
- `src/components/discover-board.tsx`
- `STATUS_AUTH.md`

## Scope notes
- Follow the refined Supabase SSR middleware pattern exactly: `createServerClient`, `request.cookies`, `NextResponse`, `auth.getUser()`, and cookie copy on redirects.
- Keep graceful degraded behavior when Supabase env vars are missing. In that mode, existing local/demo behavior must still work.
- Keep localStorage in place as the unauthenticated fallback and authenticated client cache.
- Do not expand into events, chat data migration, or email beyond auth plumbing that is directly needed here.

## Protected-route interpretation
- The refined plan assumes a wider auth wall.
- This pass keeps middleware-based session refresh for all requests, but route blocking stays scoped to authenticated-account surfaces so the demo/local fallback flow is not broken during preview or when env vars are absent.
- Redirect logged-in users away from `/auth/login`.

## Execution order
1. Add the migration and Supabase auth/session helpers.
2. Add login, verify, callback, and middleware.
3. Add Supabase-backed storage helpers for profile/history/saved items.
4. Update onboarding, today, history, discover, shell, and homepage to use auth-aware persistence.
5. Run validation, write status, and commit.
