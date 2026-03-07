## PlayDays fix plan

1. Replace brittle location resolution with Open-Meteo geocoding that prefers city-only lookups and works without an API key.
2. Make local discovery use Google Places only when configured, otherwise fall back directly to AI-generated city suggestions.
3. Extend onboarding/profile data with simple day rhythm fields and expose schedule-aware timeline blocks on `/today`.
4. Add a `/start-setup` route alias and verify profile data persists through local storage.
5. Validate with `npm run build`, then commit and push.
