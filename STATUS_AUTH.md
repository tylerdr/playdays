# STATUS_AUTH

## What changed

### New files
- `src/middleware.ts` — SSR session refresh + protected-route redirects (follows Supabase SSR pattern exactly)
- `src/lib/supabase/middleware.ts` — `updateSession` helper used by middleware
- `src/lib/supabase/storage.ts` — Supabase-backed read/write for profile, history, and saved items
- `src/app/auth/login/page.tsx` — Magic-link email entry (Suspense-wrapped for Next.js static export compat)
- `src/app/auth/verify/page.tsx` — "Check your email" holding page
- `src/app/auth/callback/route.ts` — Code exchange + new-user detection → /start-setup or /today
- `supabase/migrations/20260312_v2_auth_events.sql` — Adds auth FK, unique constraint, RLS, schedule_prefs, activity_prefs, email_prefs, timezone columns

### Modified files
- `src/lib/supabase/server.ts` — Exposes `getServerUser()` helper
- `src/lib/storage.ts` — All reads/writes try Supabase first, fall back to localStorage for anonymous/no-env users
- `src/components/site-shell.tsx` — Sign In / Sign Out in nav, auth-aware state
- `src/components/today-board.tsx` — Reads from Supabase when authenticated, localStorage otherwise
- `src/components/history-board.tsx` — Reads from Supabase when authenticated
- `src/components/profile-form.tsx` — Writes to Supabase on submit when authenticated
- `src/components/discover-board.tsx` — Minor: removed unused function, cleaned hook call
- `src/app/page.tsx` — Auth-aware CTA (Sign In if not logged in)
- `src/app/start-setup/page.tsx` — Creates Supabase profile record post-submit when authenticated
- `src/app/today/page.tsx` — Passes user context down to TodayBoard
- `src/app/history/page.tsx` — Passes user context down to HistoryBoard
- `src/app/settings/page.tsx` — Passes user context to ProfileForm

## Validation
- `npm run lint` — clean (0 errors)
- `npm run typecheck` — clean
- `npm run build` — passed, all routes generated successfully

## Open questions / notes for next phase
- Middleware uses deprecated `middleware.ts` convention (Next.js 16 prefers `proxy.ts`); build warns but works fine — update when other teams are done merging
- `schedule_prefs`, `activity_prefs`, and `email_prefs` columns are now in the migration but not yet surfaced in any UI — that's the events/profile workstream's job
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is needed for cron/email routes; anon key is sufficient for user-facing flows
- Migration must be applied manually to the live Supabase project before auth works in production
