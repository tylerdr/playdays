# PlayDays

PlayDays is a mobile-first PWA for parents who need a good plan for today fast. It generates a daily set of age-aware activities, layers in weather and local discovery, and keeps learning from what the family actually does.

## Stack
- Next.js 16 app router
- Tailwind CSS v4 + shadcn-style components
- Vercel AI SDK + OpenAI
- Supabase-ready auth/data helpers
- Google Places for local discovery
- Open-Meteo for weather
- Resend for daily digest emails

## Run locally
```bash
npm install
npm run dev
```

## Environment
Copy `.env.example` to `.env.local` and fill in:
- `OPENAI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- Supabase keys when you are ready to persist beyond local storage

## Daily digest cron
`vercel.json` includes a daily cron that calls `/api/email/daily-digest` at `14:00 UTC`.

For the cron path to send a real email, set:
- `PLAYDAYS_DIGEST_EMAIL`
- `PLAYDAYS_DIGEST_PROFILE_JSON`

The profile env is a pragmatic MVP bridge until the digest reads directly from Supabase.

## Supabase
A starter schema lives in `supabase/migrations/20260307181000_playdays_init.sql`.

## Notes
- The product works without auth by storing profile, plan cache, and history in local storage.
- OpenAI-backed generation and chat are fully wired. Without keys, the app falls back to deterministic placeholders where possible.
