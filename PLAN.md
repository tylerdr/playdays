# PlayDays Build Plan

## Goal
Ship a polished, mobile-first daily planning app for parents that combines AI-generated activities, live weather context, local discovery, chat help, and daily email delivery.

## Approach
1. Use a clean Next.js app-router scaffold with Tailwind v4 and shadcn-style components.
2. Store onboarding data locally first so the product works before auth is finished.
3. Add real OpenAI, Open-Meteo, Google Places, and Resend integrations behind stable API routes.
4. Keep Supabase-ready schema and helpers in the repo so auth/history can move server-side without rework.
5. Validate with lint + build, then wire GitHub and Vercel.

## MVP Definition
- Working onboarding flow
- Working /today generation with weather-aware cards
- Working /discover with Google Places or AI fallback
- Working /chat with personalized prompt
- Working daily digest endpoint + cron scaffold
- Installable PWA manifest and mobile nav
