# API Handler Rules

Apply these rules when working on files matching: app/api/**

- Use Next.js route handlers (not Express-style middleware)
- Always validate input with Zod at the route boundary — never trust raw request.json()
- Return consistent error shapes: `{ error: string, code?: string }`
- Use the Supabase server helper at `lib/supabase/server.ts` (not raw client)
- Rate limit sensitive endpoints
- Log errors with context before returning error responses
