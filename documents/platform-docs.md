# PlayDays platform docs

## Product summary
PlayDays is a mobile-first family planning app for busy parents. The MVP promise is simple: generate one practical plan for today fast, tuned to kids, weather, materials, and local outings.

## Primary routes
- `/` — marketing homepage and product positioning
- `/start-setup` — primary onboarding entry
- `/onboard` — compatibility redirect to `/start-setup`
- `/today` — main app surface; generates the daily plan and shows timeline, weather, discovery picks, and nap-trap ideas
- `/discover` — local place search and outing-anchor flow with honest fallback framing
- `/chat` — assistant surface with saved-family, example-family, and generic fallback states
- `/history` — saved items and lightweight usage history
- `/settings` — settings summary plus optional full profile editing flow

## Core user flows
### 1. First-use setup
1. Parent lands on marketing homepage
2. Taps `Set up my family`
3. Completes 4-step profile form: basics, kids, rhythm, materials
4. Saves profile and is routed to `/today`

### 2. Build today’s plan
1. `/today` loads local profile and cached plan if present
2. If no cached plan for today, client POSTs to `/api/generate-daily`
3. Server composes weather, discovery, and AI/fallback activity suggestions
4. Client renders 5 activity cards, timeline, nearby options, and nap-trap mode

### 3. Adjust the plan
- Parent can refresh the full day
- Parent can skip/done/save activity cards
- Skip triggers a replacement activity for that slot
- Saved items and history persist to localStorage

### 4. Local discovery
1. Parent opens `/discover`
2. Searches by city/zip and selected categories
3. App uses Google Places when configured, otherwise AI/fallback discovery with explicit lower-confidence framing
4. Verified place results can be pinned back into today’s outing anchor; lower-confidence results are saved as backup ideas instead

### 5. AI help
1. Parent opens `/chat`
2. Sends a short situation prompt
3. Chat uses saved family context when available, or stays generic / explicit-example-mode when setup is missing
4. If OpenAI is unavailable, the route streams deterministic backup guidance instead of failing

## Server endpoints
- `POST /api/generate-daily` — returns daily plan or slot replacement
- `POST /api/discover` — returns nearby kid-friendly places
- `POST /api/chat` — returns streaming chat answers
- `POST /api/email/daily-digest` — digest endpoint intended for cron/email use

## Current persistence model
- Family profile: localStorage
- Daily plan cache: localStorage, date-keyed
- History: localStorage
- Saved items: localStorage
- Pinned place: localStorage
- Supabase schema exists but is not yet the default runtime path

## Current product state assumptions
- There is no fully shipped auth/account system yet
- “Logged-in experience” currently means a hydrated family profile + returning-user state rather than true authentication
- The app should still feel useful without API keys by degrading to deterministic or fallback behavior
- Fallback states should be clearly framed in parent-facing language rather than exposing raw implementation sources
