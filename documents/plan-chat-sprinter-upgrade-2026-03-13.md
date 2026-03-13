# PlayDays chat Sprinter upgrade plan — 2026-03-13

## Goal
Replace the current PlayDays chat UI with a copy-adapted version of the Sprinter Registry OS `ai-chat` block while preserving PlayDays-specific family-context behavior, honest fallback behavior, and the app's warm light-mode design.

## Files expected
- `src/components/chat-assistant.tsx`
- `src/app/api/chat/route.ts`
- `package.json`
- `package-lock.json`

## Decision
- Reuse the registry block's client architecture patterns: `useChat`, `DefaultChatTransport`, tool-part rendering, clearer empty state, and a simpler message composer shell.
- Do **not** swap PlayDays to the registry's generic `createChatRoute` as-is. PlayDays still needs server-auth context loading, local profile/history fallback, dynamic prompt selection, and non-AI fallback streaming. Instead, keep the existing route behavior and only borrow the factory shape if it improves structure without dropping capabilities.

## Changes needed
1. Replace the current `chat-assistant.tsx` with a registry-style chat shell that still supports PlayDays modes:
   - `server`, `profile`, `example`, and `generic`
   - profile/history injection via transport body
   - quick question chips
   - context-aware welcome copy and mode summary
2. Update the message renderer:
   - assistant text parts should render through `react-markdown`
   - tool call/result/error parts should render in a reusable card pattern adapted from the registry block
   - loading and empty states should feel intentional in PlayDays light mode
3. Replace all registry-specific theme classes with standard shadcn/Tailwind token usage:
   - `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-muted/50`, `text-primary`, `bg-primary/10`, `border-primary/40`, `text-destructive`
4. Refactor the chat route only enough to improve structure:
   - keep auth-aware context building and fallback response generation
   - keep `nodejs` runtime and current prompt/fallback behavior
   - optionally wrap the existing POST logic in a local route factory if that improves readability without flattening PlayDays-specific behavior
5. Validate with `npm run typecheck` and `npm run build`, then commit with the requested message.

## Assumptions
- The installed AI SDK versions already support `useChat` + `DefaultChatTransport`.
- `react-markdown` may need to be added to this checkout even though it was expected from prior work.
- The chat route still uses OpenAI-only helpers in the current repo state, so this task should avoid touching provider logic in `src/lib/server/ai.ts`.
