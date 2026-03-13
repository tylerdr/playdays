# Onboarding UX Fix Plan — 2026-03-13

## Summary

User testing surfaced 9 issues with the onboarding flow (`/start-setup`). The current `ProfileForm` is a dense 4-step wizard crammed into a two-column layout. The core problems: broken interests input, missing suggestions, disorganized rhythm step, layout/overflow bugs, schema validation errors on save, and a "Sign In" button that ignores local-only profiles. The most impactful change is redesigning the flow from a form-heavy wizard into a conversational, Typeform-style experience — one concept at a time, chip-based answers, minimal free text.

This plan covers all 9 issues plus the Typeform redesign, organized as individual implementation sections with root causes and fix approaches.

## Implementation note

- `framer-motion` is not installed in this repo as of 2026-03-13, so the conversational slide transition should use the CSS animation fallback described in Bug 7.

## Status

- 2026-03-13: Implemented the onboarding UX overhaul in code and verified it with `npm run lint`, `npm run typecheck`, and `npm run build`.

---

## Files to change

| File | Purpose |
|---|---|
| `src/components/profile-form.tsx` | Main form component — complete rewrite to conversational flow |
| `src/lib/schemas.ts` | Add meal time fields to `scheduleSchema`, add `INTEREST_SUGGESTIONS` |
| `src/components/site-shell.tsx` | Fix footer stickiness, fix Sign In → Profile logic |
| `src/app/globals.css` | Add conversational-step utilities, time-input styling |
| `src/app/layout.tsx` | Add `flex flex-col` to body for sticky footer |
| `src/lib/storage.ts` | No changes needed (already has `getProfile()`) |
| `src/app/start-setup/page.tsx` | May need layout wrapper adjustments |
| `src/components/ui/input.tsx` | Audit `type="time"` styling |

---

## Bug 1 — Interests input broken

### Root cause

`profile-form.tsx:500` renders the interests input as:

```tsx
value={kid.interests.join(", ")}
onChange={(event) =>
  updateKid(index, {
    interests: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
  })
}
```

Every keystroke splits on `,`, trims, and filters. Typing `"dinosaurs, "` immediately becomes `["dinosaurs"]` → displayed as `"dinosaurs"` — the trailing comma and space are eaten. The cursor jumps and partially-typed words get dropped.

### Fix approach

1. Add a `interestDrafts` state map (`Record<string, string>`) keyed by `kid.id`.
2. Initialize each draft from `kid.interests.join(", ")` when the step mounts.
3. Bind the `<Input>` to the draft string, updating only the draft on `onChange`.
4. Parse the draft into an array on `onBlur` and on Enter key:

```tsx
const [interestDrafts, setInterestDrafts] = useState<Record<string, string>>({});

function getInterestDraft(kid: ChildProfile) {
  return interestDrafts[kid.id] ?? kid.interests.join(", ");
}

function commitInterests(kidIndex: number, kidId: string) {
  const raw = interestDrafts[kidId] ?? "";
  const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  updateKid(kidIndex, { interests: parsed });
}

// In JSX:
<Input
  value={getInterestDraft(kid)}
  onChange={(e) => setInterestDrafts((d) => ({ ...d, [kid.id]: e.target.value }))}
  onBlur={() => commitInterests(index, kid.id)}
  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitInterests(index, kid.id); } }}
/>
```

5. Below the input, render selected interests as removable tag chips:

```tsx
<div className="flex flex-wrap gap-2 mt-2">
  {kid.interests.map((interest) => (
    <Badge key={interest} variant="outline" className="gap-1 rounded-full px-3 py-1">
      {interest}
      <button type="button" onClick={() => removeInterest(index, interest)}>
        <X className="size-3" />
      </button>
    </Badge>
  ))}
</div>
```

This is also addressed in the Typeform redesign below, where interests become primarily chip-based.

---

## Bug 2 — No interest suggestions

### Root cause

No suggestion data exists. The input is freeform-only.

### Fix approach

1. Add an `INTEREST_SUGGESTIONS` constant to `src/lib/schemas.ts`:

```ts
export const INTEREST_SUGGESTIONS = [
  "dinosaurs", "trucks", "painting", "music", "animals",
  "books", "water play", "sports", "dancing", "cooking",
  "building", "dolls", "cars", "nature", "trains",
  "puzzles", "dress-up", "science", "superheroes", "crafts",
] as const;
```

2. Render a suggestion panel of tappable chips below the interests input. Filter out already-selected interests:

```tsx
const suggestions = INTEREST_SUGGESTIONS.filter(
  (s) => !kid.interests.includes(s)
);

<div className="flex flex-wrap gap-2">
  {suggestions.map((s) => (
    <button
      key={s}
      type="button"
      className="rounded-full border border-border/60 bg-white/70 px-3 py-1.5 text-sm
                 hover:bg-primary/10 hover:border-primary/30 transition-colors"
      onClick={() => updateKid(index, { interests: [...kid.interests, s] })}
    >
      + {s}
    </button>
  ))}
</div>
```

3. In the Typeform redesign, this becomes the primary input mechanism — a grid of large tappable chips, with a small "Add custom" input at the bottom.

---

## Bug 3 — Rhythm page disorganized

### Root cause

`profile-form.tsx:523-698` lays out rhythm fields in a `grid md:grid-cols-2` with each field in its own grid cell. Nap 1 start and end land on separate rows. There are no meal time fields. The `napWindow` freeform text field (line 596-604) is redundant since structured nap times already exist.

### Fix approach

1. **Remove the `napWindow` text field** — the structured nap1/nap2 start/end fields replace it. Keep the `napWindow` field in the schema for backward compat but stop rendering it in the form. Populate it automatically on save from nap1Start/nap1End:

```ts
napWindow: profile.schedule.nap1Start && profile.schedule.nap1End
  ? `${profile.schedule.nap1Start}-${profile.schedule.nap1End}`
  : ""
```

2. **Group nap times on the same row** — wrap each nap pair in a dedicated container:

```tsx
<div className="space-y-2 md:col-span-2">
  <Label>Nap 1</Label>
  <div className="grid grid-cols-2 gap-3">
    <Input type="time" value={profile.schedule.nap1Start} ... />
    <Input type="time" value={profile.schedule.nap1End} ... />
  </div>
</div>
```

3. **Add meal time fields** to `scheduleSchema` in `src/lib/schemas.ts`:

```ts
export const scheduleSchema = z.object({
  // ... existing fields ...
  breakfastTime: z.string().default("07:30"),
  lunchTime: z.string().default("12:00"),
  dinnerTime: z.string().default("17:30"),
});
```

Update `createEmptyProfile()` and `createDemoProfile()` with defaults.

4. **Visual timeline layout** — render the rhythm step as a vertical day timeline:

```tsx
<div className="space-y-4">
  {/* Each block is a labeled time row */}
  <TimeRow label="Wake" value={wakeTime} onChange={...} />
  <TimeRow label="Breakfast" value={breakfastTime} onChange={...} />
  <TimeRow label="Nap 1" startValue={nap1Start} endValue={nap1End} onChange={...} />
  <TimeRow label="Lunch" value={lunchTime} onChange={...} />
  <TimeRow label="Nap 2" startValue={nap2Start} endValue={nap2End} onChange={...} />
  <TimeRow label="Dinner" value={dinnerTime} onChange={...} />
  <TimeRow label="Bedtime" value={bedtime} onChange={...} />
</div>
```

Each `TimeRow` is a small inline component:

```tsx
function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-white/70 px-4 py-3">
      <span className="w-24 text-sm font-medium text-foreground">{label}</span>
      <Input type="time" value={value} onChange={(e) => onChange(e.target.value)}
             className="touch-safe max-w-32 rounded-2xl" />
    </div>
  );
}
```

---

## Bug 4 — Footer not sticky at bottom

### Root cause

`site-shell.tsx:125` wraps everything in `<div className="min-h-screen pb-24 sm:pb-10">`. The `<main>` element (line 207) has no flex-grow, so when page content is short, `<footer>` (line 209) sits right after it instead of at the bottom.

### Fix approach

Change the SiteShell outer div and main:

```tsx
// site-shell.tsx line 125 — change:
<div className="min-h-screen pb-24 sm:pb-10">
// to:
<div className="flex min-h-screen flex-col pb-24 sm:pb-10">

// line 207 — change:
<main>{children}</main>
// to:
<main className="flex-1">{children}</main>
```

This is a two-line change. The footer will always be pushed to the bottom regardless of content height.

---

## Bug 5 — Step 4 textarea grows the entire page

### Root cause

`profile-form.tsx:340` — the right-side Card has no height constraint or overflow handling:

```tsx
<Card className="card-soft border-border/60">
  <CardContent className="space-y-8 pt-6">
```

The `Textarea` at line 725-733 has `rows={5}` but no max-height. As content grows, the Card grows, which grows the page.

### Fix approach

Add overflow constraints to the right Card:

```tsx
<Card className="card-soft border-border/60 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
```

And constrain the Textarea itself:

```tsx
<Textarea
  ...
  rows={5}
  className="max-h-40 resize-y rounded-3xl"
/>
```

The `max-h-40` (160px ≈ 5 lines) caps the textarea; `resize-y` lets users drag it within reason. The Card's `overflow-y-auto` ensures scrolling within the card on desktop.

---

## Bug 6 — Input type="time" not styled as shadcn

### Root cause

Native `<input type="time">` renders browser-default time pickers which don't match the shadcn design tokens. The `Input` component from `src/components/ui/input.tsx` applies base styling, but `type="time"` inputs have browser-specific chrome (spinner, AM/PM toggle) that isn't tamed.

### Fix approach

Add time-input-specific styles to `src/app/globals.css`:

```css
@layer base {
  input[type="time"] {
    @apply appearance-none;
  }

  input[type="time"]::-webkit-calendar-picker-indicator {
    @apply cursor-pointer opacity-50 hover:opacity-100 transition-opacity;
  }
}
```

Verify that all `<input type="time">` elements in the form use the shadcn `<Input>` component (they already do — confirmed at lines 538, 549, 559, 569, 579, 589). The `touch-safe rounded-2xl` classes are already applied. The CSS additions above handle the remaining browser chrome.

---

## Bug 7 — Typeform-style onboarding redesign

This is the largest change. The current 4-step form packs too many fields into dense grids. The redesign presents one concept at a time with large text, tappable answers, and minimal typing.

### Proposed new step structure

Replace the current 4 steps with 6-8 lightweight "slides." Each slide has:
- One large question in display font (Nunito)
- A single input mechanism (chips, slider, time picker, or short text)
- A big "Next" button at the bottom
- Smooth transition between slides

| Slide | Question | Input type | Fields covered |
|---|---|---|---|
| 1 | "What's your name?" | Single text input, auto-focus | `parentName` |
| 2 | "Where do you live?" | City + zip in one row | `location.city`, `location.zip` |
| 3 | "Tell us about your kids" | Name + age per kid, "Add another" button | `kids[].name`, `kids[].age` |
| 4 | "What are {kidName}'s favorite things?" | Chip grid (suggestions) + custom input | `kids[].interests` |
| 5 | "What's a typical day look like?" | Visual timeline with time pickers | `wakeTime`, `nap1Start/End`, `bedtime`, meal times |
| 6 | "What do you have at home?" | Tappable chip grid (materials) | `materials[]` |
| 7 | "Almost done — a few preferences" | Slider + toggle cluster | `messTolerance`, `energyLevelToday`, `indoorOutdoor`, `digestEnabled` |
| 8 | "Anything else we should know?" | Optional textarea + save button | `notes`, `email` (optional) |

### UX patterns per slide

**Slide 1–2 (Text inputs):**
- Centered layout, max-w-lg
- Large placeholder text in muted color
- Auto-focus on mount
- Enter key advances to next slide
- No label needed — the question IS the label

```tsx
<div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
  <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl text-center">
    What's your name?
  </h2>
  <p className="mt-2 text-lg text-muted-foreground text-center">
    Just your first name — it helps us make plans feel personal.
  </p>
  <Input
    autoFocus
    value={profile.parentName}
    onChange={...}
    onKeyDown={(e) => e.key === "Enter" && advance()}
    placeholder="e.g. Maya"
    className="mt-8 max-w-sm text-center text-lg touch-safe rounded-2xl"
  />
</div>
```

**Slide 3 (Kids):**
- Each kid is a mini card with name input + age selector
- Age uses a horizontal chip strip: `<1`, `1`, `2`, `3`, `4`, ..., `10+`
- "Add another child" as a ghost button below

```tsx
// Age selector — chips instead of number input
<div className="flex flex-wrap gap-2">
  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((age) => (
    <button
      key={age}
      type="button"
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors border",
        kid.age === age
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border/60 bg-white/70 hover:bg-primary/10"
      )}
      onClick={() => updateKid(index, { age })}
    >
      {age === 0 ? "<1" : age}
    </button>
  ))}
</div>
```

**Slide 4 (Interests):**
- Separate slide per kid (if >1 kid, repeat with kid's name in the question)
- Large chip grid with `INTEREST_SUGGESTIONS`
- Selected chips get primary color fill
- Small "Type your own" input below the chips
- Tapping a selected chip removes it

```tsx
<div className="flex flex-wrap gap-3 justify-center max-w-xl mx-auto">
  {INTEREST_SUGGESTIONS.map((interest) => {
    const selected = kid.interests.includes(interest);
    return (
      <button
        key={interest}
        type="button"
        className={cn(
          "rounded-full px-5 py-2.5 text-sm font-medium transition-all border",
          selected
            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/15"
            : "border-border/60 bg-white/70 hover:bg-primary/5 hover:border-primary/30"
        )}
        onClick={() =>
          selected
            ? updateKid(i, { interests: kid.interests.filter((x) => x !== interest) })
            : updateKid(i, { interests: [...kid.interests, interest] })
        }
      >
        {interest}
      </button>
    );
  })}
</div>
```

**Slide 5 (Daily rhythm):**
- Vertical timeline with connecting line
- Each milestone is a labeled row with a time picker
- Pre-populated with sensible defaults
- Nap rows have start + end on same line

```tsx
<div className="relative mx-auto max-w-md space-y-1">
  {/* Vertical connecting line */}
  <div className="absolute left-6 top-4 bottom-4 w-px bg-border/60" />

  <TimelineRow icon="☀️" label="Wake up" value={wakeTime} onChange={...} />
  <TimelineRow icon="🥣" label="Breakfast" value={breakfastTime} onChange={...} />
  <TimelineRow icon="😴" label="Nap 1" start={nap1Start} end={nap1End} onChange={...} />
  <TimelineRow icon="🍽️" label="Lunch" value={lunchTime} onChange={...} />
  <TimelineRow icon="😴" label="Nap 2" start={nap2Start} end={nap2End} onChange={...} optional />
  <TimelineRow icon="🍽️" label="Dinner" value={dinnerTime} onChange={...} />
  <TimelineRow icon="🌙" label="Bedtime" value={bedtime} onChange={...} />
</div>
```

**Slide 6 (Materials):**
- Same chip-grid pattern as interests
- Pre-select the 3 defaults from `createEmptyProfile()`
- Two-column grid on mobile, three on desktop

**Slide 7 (Preferences):**
- Slider components for mess tolerance and energy level — these already use shadcn `Slider`
- Indoor/outdoor as three large tappable cards (not a Select dropdown)
- Digest toggle stays as a Switch

```tsx
<div className="grid gap-3 sm:grid-cols-3 max-w-lg mx-auto">
  {(["mostly-indoor", "balanced", "mostly-outdoor"] as const).map((pref) => (
    <button
      key={pref}
      type="button"
      className={cn(
        "rounded-2xl border p-4 text-center transition-all",
        profile.preferences.indoorOutdoorPreference === pref
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-border/60 bg-white/70 hover:bg-primary/5"
      )}
      onClick={() => updateProfile({ preferences: { ...profile.preferences, indoorOutdoorPreference: pref } })}
    >
      <span className="text-2xl">{pref === "mostly-indoor" ? "🏠" : pref === "balanced" ? "⚖️" : "🌳"}</span>
      <p className="mt-1 text-sm font-medium">{pref === "mostly-indoor" ? "Mostly inside" : pref === "balanced" ? "A bit of both" : "Mostly outside"}</p>
    </button>
  ))}
</div>
```

**Slide 8 (Wrap-up):**
- Optional email field with helper text: "For the daily 7am digest. Skip if you don't want it."
- Optional notes textarea (short, 3 rows)
- Prominent "Build my first day" CTA
- Small note: "Stays on this device. Sign in later to sync across devices."

### Layout structure for conversational flow

Replace the current two-column `lg:grid-cols-[0.9fr_1.1fr]` grid with a single centered column:

```tsx
<div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col items-center justify-center px-4 py-10">
  {/* Progress bar at top */}
  <div className="w-full max-w-xs mb-8">
    <Progress value={progress} className="h-1.5" />
  </div>

  {/* Slide content — centered, spacious */}
  <div className="flex-1 flex flex-col items-center justify-center w-full">
    {currentSlide}
  </div>

  {/* Navigation at bottom */}
  <div className="flex w-full items-center justify-between mt-8">
    <Button variant="ghost" onClick={back} disabled={slide === 0}>Back</Button>
    <Button onClick={advance} disabled={!canAdvance} className="rounded-2xl px-8">
      {isLastSlide ? "Build my first day ✨" : "Next"}
    </Button>
  </div>
</div>
```

### Tailwind v4 class patterns (matching existing design language)

The project uses Tailwind v4 with CSS-first config (`@theme inline` in globals.css). Key patterns to maintain:

- Rounded corners: `rounded-2xl` (maps to `calc(var(--radius) + 10px)` ≈ 31.6px) for cards/buttons, `rounded-full` for chips/badges
- Touch targets: `touch-safe` (custom utility, `min-height: 48px`)
- Card surfaces: `border border-border/60 bg-white/70` for nested cards within `card-soft` parents
- Spacing: `space-y-4` to `space-y-8` for vertical rhythm, `gap-3` for chip grids
- Text hierarchy: `text-3xl sm:text-4xl font-bold` for slide questions (use `font-display` / Nunito), `text-lg text-muted-foreground` for supporting text
- Transitions: `transition-colors` on interactive elements, `transition-all` on chips that change size/shadow

### Component decisions

- **Do NOT use** a carousel library. Simple conditional rendering (`{slide === N && ...}`) with CSS transitions is sufficient.
- **Wrap each slide** in a `<motion.div>` from framer-motion if already installed, otherwise use CSS `@keyframes` fade-in. Check `package.json` first.
- **Keep the existing `profile` state shape** — the conversational UI is purely a presentation change. The underlying `FamilyProfile` type and `save()` function remain identical.
- **Keep the left-column "How this personalizes your plan" card** only in `profile`/`settings` mode. In onboard mode, go single-column.

---

## Bug 8 — Invalid schema error at end of step 4

### Root cause

`profile-form.tsx:152` calls `familyProfileSchema.parse(...)` in the `save()` function. Two likely failure points:

1. **`email` field** — `schemas.ts:55`: `z.string().email().optional().or(z.literal(""))`. A partially-typed email like `"maya@"` fails `.email()` validation and doesn't match `z.literal("")`. The `.optional()` only passes if the value is `undefined`, not an empty-ish string.

2. **`kids[].name` with `z.string().min(1)`** — if a user adds a second kid but doesn't fill in the name, `.min(1)` fails. The `canAdvance` guard (line 191) checks this, but only prevents advancing from step 1. A user could go back to step 1, add a kid, jump to step 3/4 via the step buttons, and then save.

3. **Error display** — line 183 dumps `caughtError.message` which for Zod is a raw JSON array of validation issues.

### Fix approach

1. **Pre-validate before calling `parse()`** with user-friendly error messages:

```tsx
async function save(modeAfterSave: "today" | "stay") {
  // Pre-validation with friendly messages
  const errors: string[] = [];

  if (!profile.parentName.trim()) {
    errors.push("Please enter your name (step 1).");
  }

  if (profile.email && profile.email.trim() !== "") {
    const emailResult = z.string().email().safeParse(profile.email);
    if (!emailResult.success) {
      errors.push("Please enter a valid email address or leave it blank (step 1).");
    }
  }

  if (!profile.location.city && !profile.location.zip) {
    errors.push("Please enter a city or zip code (step 1).");
  }

  const emptyKids = profile.kids.filter((k) => !k.name.trim());
  if (emptyKids.length > 0) {
    errors.push(`Please name all kids or remove empty entries (step 2).`);
  }

  if (profile.kids.length === 0) {
    errors.push("Please add at least one child (step 2).");
  }

  if (errors.length > 0) {
    setError(errors.join(" "));
    return;
  }

  // Now safe to parse
  try {
    const parsed = familyProfileSchema.parse({ ... });
    // ... rest of save logic
  } catch (caughtError) {
    setError("Something went wrong saving your profile. Please check all fields and try again.");
  }
}
```

2. **Normalize email before parse** — convert empty/whitespace-only email to `""`:

```tsx
email: profile.email?.trim() || "",
```

3. **Enforce `canAdvance` when using step buttons** — the step navigation buttons (line 261-270) currently allow jumping to any step. Add validation:

```tsx
onClick={() => {
  // Only allow jumping forward if current step passes validation
  if (index > step && !canAdvance) return;
  setStep(index);
}}
```

Or keep free navigation but validate on save (preferred — less frustrating for users who want to jump around).

---

## Bug 9 — Sign In shows after local setup

### Root cause

`site-shell.tsx:82-92` — the `AuthButtons` component:

```tsx
if (!hasSupabaseEnv()) {
  return null;  // No Supabase → hide auth buttons entirely
}

if (!user) {
  return (
    <Button asChild ...><Link href="/auth/login">Sign in</Link></Button>
  );
}
```

When Supabase env vars are configured but the user hasn't signed in (common for local-only usage), the component shows "Sign in" even though the user has a complete local profile. There's no check for localStorage profile existence.

### Fix approach

1. Add a `hasLocalProfile` state to `AuthButtons`:

```tsx
function AuthButtons({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [hasLocalProfile, setHasLocalProfile] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Check localStorage for profile
    setHasLocalProfile(Boolean(getProfile()));

    // ... existing Supabase auth check
  }, []);
```

2. When there's no Supabase user but a local profile exists, show "Profile" instead of "Sign in":

```tsx
if (!user) {
  if (hasLocalProfile) {
    return (
      <Button asChild variant="outline" className="touch-safe rounded-full px-5">
        <Link href="/profile">Profile</Link>
      </Button>
    );
  }

  return (
    <Button asChild className="touch-safe rounded-full px-5">
      <Link href="/auth/login">Sign in</Link>
    </Button>
  );
}
```

3. Add import for `getProfile` from `@/lib/storage` in `site-shell.tsx`.

4. During onboarding (slide 8 / wrap-up), add the note:

```tsx
<p className="text-sm text-muted-foreground text-center mt-4">
  Everything stays on this device. Sign in to sync across devices.
</p>
```

---

## Validation & testing

### Manual test script

1. **Interests input (bugs 1+2):**
   - Type "dinosaurs, trucks" → verify no cursor jump, both words display as chips on blur
   - Tap suggestion chips → verify they appear as selected tags
   - Remove a tag → verify it reappears in suggestions
   - Type a custom interest not in suggestions → verify it persists

2. **Rhythm page (bug 3):**
   - Verify nap 1 start/end are on the same row
   - Verify meal times (breakfast, lunch, dinner) appear with sensible defaults
   - Verify napWindow freeform field is gone
   - Verify the vertical timeline renders correctly on mobile and desktop

3. **Footer (bug 4):**
   - Navigate to a page with short content → verify footer is at the viewport bottom
   - Navigate to a page with long content → verify footer is after content (normal flow)

4. **Textarea overflow (bug 5):**
   - Go to the notes step, paste a long block of text → verify the Card scrolls internally, page height stays fixed
   - Verify textarea has a visible scrollbar when content exceeds max-height

5. **Time inputs (bug 6):**
   - Check time inputs on Chrome, Safari, Firefox → verify consistent styling
   - Verify the picker indicator is visible and clickable

6. **Conversational flow (bug 7):**
   - Complete full onboarding from `/start-setup` → verify all slides appear in order
   - Verify Enter key advances on text inputs
   - Verify Back button works on every slide
   - Verify progress bar fills correctly
   - Verify mobile layout is centered and touch-friendly
   - Verify the `profile`/`settings` modes still work (two-column view preserved for editing)

7. **Validation (bug 8):**
   - Leave parent name blank, try to save → verify friendly error
   - Type partial email "foo@" → verify friendly error on save
   - Add second kid, leave name blank, jump to last slide, save → verify friendly error
   - Complete all fields correctly → verify save succeeds

8. **Sign In button (bug 9):**
   - Complete local setup → verify nav shows "Profile" not "Sign in"
   - Clear localStorage → verify "Sign in" reappears (when Supabase env exists)
   - Without Supabase env → verify no auth buttons at all (unchanged behavior)

### Build verification

```bash
npm run build   # Verify no TypeScript errors
npm run lint    # Verify no lint issues
```

---

## Deployment

1. Implement all changes on a feature branch: `git checkout -b fix/onboarding-ux-2026-03-13`
2. Commit incrementally per bug group (layout fixes, interests, rhythm, validation, typeform redesign)
3. Run `npm run build` to verify no build errors
4. Test locally at `http://localhost:3000/start-setup`
5. Visual test on mobile viewport (375px) and desktop (1440px)
6. Merge to `main` and push
7. Verify production deploy succeeds

### Implementation order (recommended)

1. **Bug 4** (footer sticky) — 2 lines, zero risk, immediate visual improvement
2. **Bug 5** (textarea overflow) — small CSS change
3. **Bug 6** (time input styling) — CSS-only
4. **Bug 9** (Sign In → Profile) — small logic change in site-shell
5. **Bug 1 + 2** (interests input + suggestions) — moderate, schema + form changes
6. **Bug 3** (rhythm page) — schema additions + layout restructure
7. **Bug 8** (validation) — pre-save validation logic
8. **Bug 7** (Typeform redesign) — largest change, depends on all others being stable first
