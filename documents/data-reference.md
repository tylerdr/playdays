# PlayDays data reference

## Core entities
### FamilyProfile
Contains parent identity, email, location, kids, schedule, preferences, materials, and notes.

### DailyPlan
Contains date-keyed daily output:
- headline
- encouragement
- weather summary
- exactly 5 activities in slot order
- timeline blocks
- local discovery places
- nap-trap suggestions

### Activity slots
Canonical order and meaning:
1. `outdoor`
2. `indoor`
3. `adventure`
4. `calm`
5. `together`

A lot of UI and generation logic assumes this exact slot set/order.

### HistoryEntry
Records `done`, `skip`, and `saved` actions with timestamp/dateKey/slot/title.
Used as a lightweight behavior signal for future planning and chat context.

### SavedItem
Stores saved activities and places for later recall.

## Persistence rules
- Local storage is currently the primary runtime store
- Saving profile invalidates the cached daily plan
- Daily plan cache is only valid for the current date key
- Pinned place is stored separately and surfaced on `/today`

## Server composition logic
- Weather is fetched first for the user location
- Discovery runs next (Google Places → AI → fallback)
- Daily generation then uses profile + history + weather + discovery
- Replacement flow only swaps a single slot while preserving the rest of the plan/timeline

## Important product truths
- Auth is not yet the canonical state boundary
- A user may look “set up” purely because localStorage is hydrated
- Demo profile behavior is intentional and must keep working during QA and refactors
- External API outages or missing keys should degrade, not dead-end the experience
