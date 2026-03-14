# Pre-PR Code Review

Perform a thorough code review before opening a PR:

1. Run lint + typecheck + build — fix any failures
2. Review all changed files for: TypeScript correctness, shadcn/ui usage, error handling, accessibility
3. Check for console.log statements in production paths
4. Verify tests cover new functionality (write tests if missing)
5. Check for hardcoded values that should be config/env vars
6. Ensure Conventional Commits format on all commits in this branch
7. Update documents/HANDOFF.md if this session is ending
8. Open PR with: title (conventional commits format), description (what + why + how to test), checklist
