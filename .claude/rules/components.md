# Component Rules

Apply these rules when working on files matching: components/** and app/**/*.tsx

- Always use shadcn/ui primitives — never raw <button>, <input>, <select>
- Use `cn()` from lib/utils for conditional class merging
- Every interactive element must have keyboard support (tabIndex, onKeyDown if custom)
- Add aria-label to icon-only buttons
- Use CSS variables for colors — no hardcoded hex or tailwind color classes outside theme
- Keep components under ~200 lines — extract sub-components if larger
