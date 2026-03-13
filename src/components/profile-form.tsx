"use client";

import Link from "next/link";
import { startTransition, type ReactNode, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { z } from "zod";
import {
  createDemoProfile,
  createEmptyProfile,
  familyProfileSchema,
  INTEREST_SUGGESTIONS,
  MATERIAL_OPTIONS,
  type ChildProfile,
  type FamilyProfile,
} from "@/lib/schemas";
import { getProfile, saveProfile } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const EDIT_STEPS = ["Basics", "Kids", "Rhythm", "Materials"];
const AGE_OPTIONS = Array.from({ length: 13 }, (_, index) => index);
const INDOOR_OUTDOOR_OPTIONS = [
  { value: "mostly-indoor", label: "Mostly inside", icon: "🏠" },
  { value: "balanced", label: "A bit of both", icon: "⚖️" },
  { value: "mostly-outdoor", label: "Mostly outside", icon: "🌳" },
] as const;

type OnboardingSlide =
  | { id: "parent"; label: "You"; kind: "parent" }
  | { id: "location"; label: "Location"; kind: "location" }
  | { id: "kids"; label: "Kids"; kind: "kids" }
  | { id: `interests-${string}`; label: string; kind: "interests"; kidId: string; kidIndex: number }
  | { id: "rhythm"; label: "Rhythm"; kind: "rhythm" }
  | { id: "materials"; label: "Materials"; kind: "materials" }
  | { id: "preferences"; label: "Preferences"; kind: "preferences" }
  | { id: "wrap"; label: "Finish"; kind: "wrap" };

type ValidationTarget = "parent" | "location" | "kids" | "email";

function subscribeToClientHydration() {
  return () => {};
}

function buildInitialProfile(initialProfile: FamilyProfile | null, authUserEmail?: string | null) {
  if (initialProfile) {
    return initialProfile;
  }

  const emptyProfile = createEmptyProfile();
  if (authUserEmail) {
    emptyProfile.email = authUserEmail;
  }
  return emptyProfile;
}

function buildInterestDraftMap(kids: ChildProfile[]) {
  return Object.fromEntries(kids.map((kid) => [kid.id, kid.interests.join(", ")]));
}

function buildCustomInterestDraftMap(kids: ChildProfile[]) {
  return Object.fromEntries(kids.map((kid) => [kid.id, ""]));
}

function buildLocationLabel(location: FamilyProfile["location"]) {
  return location.label || [location.city, location.zip].filter(Boolean).join(", ");
}

function buildLegacyNapWindow(schedule: FamilyProfile["schedule"]) {
  if (schedule.nap1Start && schedule.nap1End) {
    return `${schedule.nap1Start}-${schedule.nap1End}`;
  }

  return "";
}

function parseInterestList(raw: string) {
  const unique = new Map<string, string>();

  for (const item of raw.split(",")) {
    const value = item.trim();
    if (!value) {
      continue;
    }

    const normalized = value.toLowerCase();
    if (!unique.has(normalized)) {
      unique.set(normalized, value);
    }
  }

  return Array.from(unique.values());
}

function buildOnboardingSlides(profile: FamilyProfile): OnboardingSlide[] {
  return [
    { id: "parent", label: "You", kind: "parent" },
    { id: "location", label: "Location", kind: "location" },
    { id: "kids", label: "Kids", kind: "kids" },
    ...profile.kids.map((kid, kidIndex) => ({
      id: `interests-${kid.id}` as const,
      label: kid.name.trim() ? `${kid.name.trim()}'s favorites` : `Kid ${kidIndex + 1}`,
      kind: "interests" as const,
      kidId: kid.id,
      kidIndex,
    })),
    { id: "rhythm", label: "Rhythm", kind: "rhythm" },
    { id: "materials", label: "Materials", kind: "materials" },
    { id: "preferences", label: "Preferences", kind: "preferences" },
    { id: "wrap", label: "Finish", kind: "wrap" },
  ];
}

function SelectableChip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "touch-safe rounded-full border px-4 py-2 text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/15"
          : "border-border/60 bg-white/70 hover:border-primary/30 hover:bg-primary/5",
        className,
      )}
    >
      {children}
    </button>
  );
}

function AgeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (age: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {AGE_OPTIONS.map((age) => (
        <SelectableChip key={age} selected={value === age} onClick={() => onChange(age)}>
          {age === 0 ? "<1" : age}
        </SelectableChip>
      ))}
    </div>
  );
}

function TimeRow({
  icon,
  label,
  value,
  hint,
  onChange,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative pl-14">
      <div className="absolute left-0 top-3 flex size-10 items-center justify-center rounded-2xl border border-border/60 bg-white/85 text-lg shadow-sm">
        <span aria-hidden="true">{icon}</span>
      </div>
      <div className="rounded-[1.5rem] border border-border/60 bg-white/75 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">{label}</p>
            {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          </div>
          <Input
            type="time"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="time-input touch-safe max-w-40 rounded-2xl bg-white/90"
          />
        </div>
      </div>
    </div>
  );
}

function TimeRangeRow({
  icon,
  label,
  startValue,
  endValue,
  hint,
  onStartChange,
  onEndChange,
}: {
  icon: string;
  label: string;
  startValue: string;
  endValue: string;
  hint?: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="relative pl-14">
      <div className="absolute left-0 top-3 flex size-10 items-center justify-center rounded-2xl border border-border/60 bg-white/85 text-lg shadow-sm">
        <span aria-hidden="true">{icon}</span>
      </div>
      <div className="rounded-[1.5rem] border border-border/60 bg-white/75 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-medium text-foreground">{label}</p>
            {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="time"
              value={startValue}
              onChange={(event) => onStartChange(event.target.value)}
              className="time-input touch-safe max-w-40 rounded-2xl bg-white/90"
            />
            <Input
              type="time"
              value={endValue}
              onChange={(event) => onEndChange(event.target.value)}
              className="time-input touch-safe max-w-40 rounded-2xl bg-white/90"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RhythmTimeline({
  schedule,
  onChange,
}: {
  schedule: FamilyProfile["schedule"];
  onChange: (patch: Partial<FamilyProfile["schedule"]>) => void;
}) {
  return (
    <div className="relative mx-auto w-full max-w-2xl space-y-4">
      <div className="absolute bottom-4 left-5 top-4 w-px bg-border/60" aria-hidden="true" />
      <TimeRow icon="☀️" label="Wake up" value={schedule.wakeTime} onChange={(value) => onChange({ wakeTime: value })} />
      <TimeRow
        icon="🥣"
        label="Breakfast"
        value={schedule.breakfastTime}
        onChange={(value) => onChange({ breakfastTime: value })}
      />
      <TimeRangeRow
        icon="😴"
        label="Nap 1"
        hint="Start and end stay on the same row."
        startValue={schedule.nap1Start}
        endValue={schedule.nap1End}
        onStartChange={(value) => onChange({ nap1Start: value })}
        onEndChange={(value) => onChange({ nap1End: value })}
      />
      <TimeRow icon="🍽️" label="Lunch" value={schedule.lunchTime} onChange={(value) => onChange({ lunchTime: value })} />
      <TimeRangeRow
        icon="😴"
        label="Nap 2"
        hint="Optional for families still on a two-nap day."
        startValue={schedule.nap2Start}
        endValue={schedule.nap2End}
        onStartChange={(value) => onChange({ nap2Start: value })}
        onEndChange={(value) => onChange({ nap2End: value })}
      />
      <TimeRow icon="🍲" label="Dinner" value={schedule.dinnerTime} onChange={(value) => onChange({ dinnerTime: value })} />
      <TimeRow icon="🌙" label="Bedtime" value={schedule.bedtime} onChange={(value) => onChange({ bedtime: value })} />
    </div>
  );
}

function MaterialsPicker({
  selected,
  onToggle,
  large = false,
}: {
  selected: string[];
  onToggle: (material: string) => void;
  large?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", large ? "grid-cols-2 md:grid-cols-3" : "sm:grid-cols-2")}>
      {MATERIAL_OPTIONS.map((material) => {
        const isSelected = selected.includes(material);
        return (
          <button
            key={material}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onToggle(material)}
            className={cn(
              "touch-safe rounded-[1.5rem] border px-4 py-3 text-left text-sm font-medium transition-all",
              isSelected
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-border/60 bg-white/70 text-foreground hover:border-primary/30 hover:bg-primary/5",
            )}
          >
            {material}
          </button>
        );
      })}
    </div>
  );
}

function PreferenceEditor({
  preferences,
  onChange,
}: {
  preferences: FamilyProfile["preferences"];
  onChange: (patch: Partial<FamilyProfile["preferences"]>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="text-center sm:text-left">
          <p className="text-sm font-medium text-foreground">Indoor or outdoor bias</p>
          <p className="text-sm text-muted-foreground">Pick the general mood you want PlayDays to favor first.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {INDOOR_OUTDOOR_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={preferences.indoorOutdoorPreference === option.value}
              onClick={() => onChange({ indoorOutdoorPreference: option.value })}
              className={cn(
                "rounded-[1.5rem] border p-4 text-center transition-all",
                preferences.indoorOutdoorPreference === option.value
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border/60 bg-white/70 hover:border-primary/30 hover:bg-primary/5",
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {option.icon}
              </span>
              <p className="mt-2 text-sm font-medium text-foreground">{option.label}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
        <div className="flex items-center justify-between gap-3">
          <Label>Mess tolerance</Label>
          <Badge variant="outline" className="rounded-full">
            {preferences.messTolerance}/5
          </Badge>
        </div>
        <Slider
          value={[preferences.messTolerance]}
          min={1}
          max={5}
          step={1}
          className="mt-4"
          onValueChange={(value) => onChange({ messTolerance: value[0] ?? 3 })}
        />
      </div>

      <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
        <div className="flex items-center justify-between gap-3">
          <Label>Energy level today</Label>
          <Badge variant="outline" className="rounded-full">
            {preferences.energyLevelToday}/5
          </Badge>
        </div>
        <Slider
          value={[preferences.energyLevelToday]}
          min={1}
          max={5}
          step={1}
          className="mt-4"
          onValueChange={(value) => onChange({ energyLevelToday: value[0] ?? 3 })}
        />
      </div>

      <div className="flex items-center justify-between rounded-[1.5rem] border border-border/60 bg-white/75 px-4 py-4">
        <div className="pr-4">
          <Label htmlFor="digestEnabled">Daily 7am digest</Label>
          <p className="text-sm text-muted-foreground">Send the five-card plan and local picks by email.</p>
        </div>
        <Switch id="digestEnabled" checked={preferences.digestEnabled} onCheckedChange={(checked) => onChange({ digestEnabled: checked })} />
      </div>
    </div>
  );
}

function QuestionBlock({
  title,
  description,
  children,
  align = "center",
}: {
  title: string;
  description: string;
  children: ReactNode;
  align?: "center" | "left";
}) {
  const centered = align === "center";

  return (
    <div className={cn("w-full space-y-6", centered ? "text-center" : "text-left")}>
      <div className={cn("space-y-2", centered ? "mx-auto max-w-2xl" : "max-w-2xl")}>
        <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{title}</h2>
        <p className="text-lg leading-8 text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function ProfileForm({
  mode,
  initialProfile = null,
  authUserEmail = null,
}: {
  mode: "onboard" | "profile" | "settings";
  initialProfile?: FamilyProfile | null;
  authUserEmail?: string | null;
}) {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeToClientHydration,
    () => true,
    () => false,
  );
  const [step, setStep] = useState(0);
  const [hasExistingProfile, setHasExistingProfile] = useState(() => Boolean(initialProfile));
  const [editing, setEditing] = useState(() => mode !== "profile");
  const [profile, setProfile] = useState<FamilyProfile>(() =>
    buildInitialProfile(initialProfile, authUserEmail),
  );
  const [interestDrafts, setInterestDrafts] = useState<Record<string, string>>(() =>
    buildInterestDraftMap(buildInitialProfile(initialProfile, authUserEmail).kids),
  );
  const [customInterestDrafts, setCustomInterestDrafts] = useState<Record<string, string>>(() =>
    buildCustomInterestDraftMap(buildInitialProfile(initialProfile, authUserEmail).kids),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onboardingSlides = useMemo(() => buildOnboardingSlides(profile), [profile]);
  const currentOnboardingSlide = onboardingSlides[step] ?? onboardingSlides[0];
  const stepCount = mode === "onboard" ? onboardingSlides.length : EDIT_STEPS.length;
  const progress = useMemo(() => ((step + 1) / stepCount) * 100, [step, stepCount]);

  useEffect(() => {
    if (initialProfile) {
      return;
    }

    const cachedProfile = getProfile();
    if (!cachedProfile) {
      return;
    }

    startTransition(() => {
      setProfile(cachedProfile);
      setInterestDrafts(buildInterestDraftMap(cachedProfile.kids));
      setCustomInterestDrafts(buildCustomInterestDraftMap(cachedProfile.kids));
      setHasExistingProfile(true);
    });
  }, [initialProfile]);

  useEffect(() => {
    setInterestDrafts((current) => {
      const next = Object.fromEntries(
        profile.kids.map((kid) => [kid.id, current[kid.id] ?? kid.interests.join(", ")]),
      );

      if (Object.keys(current).length === Object.keys(next).length) {
        const unchanged = profile.kids.every((kid) => current[kid.id] === next[kid.id]);
        if (unchanged) {
          return current;
        }
      }

      return next;
    });

    setCustomInterestDrafts((current) => {
      const next = Object.fromEntries(profile.kids.map((kid) => [kid.id, current[kid.id] ?? ""]));

      if (Object.keys(current).length === Object.keys(next).length) {
        const unchanged = profile.kids.every((kid) => current[kid.id] === next[kid.id]);
        if (unchanged) {
          return current;
        }
      }

      return next;
    });
  }, [profile.kids]);

  useEffect(() => {
    if (mode !== "onboard") {
      return;
    }

    if (step > onboardingSlides.length - 1) {
      setStep(Math.max(0, onboardingSlides.length - 1));
    }
  }, [mode, onboardingSlides.length, step]);

  const title =
    mode === "onboard"
      ? "Build your first calmer day"
      : editing
        ? "Edit family details"
        : "Family profile";
  const description =
    mode === "onboard"
      ? "One question at a time. Just enough detail to shape a weather-smart plan that fits your real day."
      : editing
        ? "Update the details that shape your plan, discovery, events, and chat context."
        : "Review what PlayDays knows about your family, then make quick edits only when something changes.";

  function clearError() {
    setError(null);
  }

  function updateProfile(patch: Partial<FamilyProfile>) {
    clearError();
    setProfile((current) => ({ ...current, ...patch }));
  }

  function updatePreferences(patch: Partial<FamilyProfile["preferences"]>) {
    clearError();
    setProfile((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...patch,
      },
    }));
  }

  function updateKid(index: number, patch: Partial<FamilyProfile["kids"][number]>) {
    clearError();
    setProfile((current) => ({
      ...current,
      kids: current.kids.map((kid, kidIndex) => (kidIndex === index ? { ...kid, ...patch } : kid)),
    }));
  }

  function replaceKidInterests(index: number, kidId: string, interests: string[]) {
    const deduped = parseInterestList(interests.join(", "));
    updateKid(index, { interests: deduped });
    setInterestDrafts((current) => ({ ...current, [kidId]: deduped.join(", ") }));
  }

  function updateSchedule(patch: Partial<FamilyProfile["schedule"]>) {
    clearError();
    setProfile((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        ...patch,
      },
    }));
  }

  function addKid() {
    clearError();
    const kidId = crypto.randomUUID();
    setProfile((current) => ({
      ...current,
      kids: [
        ...current.kids,
        {
          id: kidId,
          name: "",
          age: 2,
          interests: [],
        },
      ],
    }));
    setInterestDrafts((current) => ({ ...current, [kidId]: "" }));
    setCustomInterestDrafts((current) => ({ ...current, [kidId]: "" }));
  }

  function removeKid(index: number) {
    clearError();
    const kidId = profile.kids[index]?.id;
    setProfile((current) => ({
      ...current,
      kids: current.kids.filter((_, kidIndex) => kidIndex !== index),
    }));

    if (!kidId) {
      return;
    }

    setInterestDrafts((current) => {
      const next = { ...current };
      delete next[kidId];
      return next;
    });
    setCustomInterestDrafts((current) => {
      const next = { ...current };
      delete next[kidId];
      return next;
    });
  }

  function toggleMaterial(material: string) {
    clearError();
    const checked = profile.materials.includes(material);
    const next = checked
      ? profile.materials.filter((item) => item !== material)
      : [...profile.materials, material];
    updateProfile({ materials: Array.from(new Set(next)) });
  }

  function getInterestDraft(kid: ChildProfile) {
    return interestDrafts[kid.id] ?? kid.interests.join(", ");
  }

  function commitInterestDraft(kidIndex: number, kidId: string) {
    const raw = interestDrafts[kidId] ?? "";
    const parsed = parseInterestList(raw);
    replaceKidInterests(kidIndex, kidId, parsed);
  }

  function toggleInterest(kidIndex: number, kid: ChildProfile, interest: string) {
    const selected = kid.interests.includes(interest);
    replaceKidInterests(
      kidIndex,
      kid.id,
      selected ? kid.interests.filter((item) => item !== interest) : [...kid.interests, interest],
    );
  }

  function removeInterest(kidIndex: number, kid: ChildProfile, interest: string) {
    replaceKidInterests(
      kidIndex,
      kid.id,
      kid.interests.filter((item) => item !== interest),
    );
  }

  function addCustomInterest(kidIndex: number, kid: ChildProfile) {
    const draft = customInterestDrafts[kid.id] ?? "";
    const parsed = parseInterestList(draft);
    if (parsed.length === 0) {
      return;
    }

    const next = parseInterestList([...kid.interests, ...parsed].join(", "));
    replaceKidInterests(kidIndex, kid.id, next);
    setCustomInterestDrafts((current) => ({ ...current, [kid.id]: "" }));
  }

  function loadDemoFamily() {
    const demo = createDemoProfile();
    setProfile(demo);
    setInterestDrafts(buildInterestDraftMap(demo.kids));
    setCustomInterestDrafts(buildCustomInterestDraftMap(demo.kids));
    setStatus("Demo family loaded into the form. Save when you want to use it.");
    setError(null);
  }

  function getCurrentStepValid() {
    if (mode === "onboard") {
      switch (currentOnboardingSlide.kind) {
        case "parent":
          return Boolean(profile.parentName.trim());
        case "location":
          return Boolean(profile.location.city.trim() || profile.location.zip.trim());
        case "kids":
          return profile.kids.length > 0 && profile.kids.every((kid) => kid.name.trim().length > 0);
        default:
          return true;
      }
    }

    if (step === 0) {
      return Boolean(profile.parentName.trim() && (profile.location.city.trim() || profile.location.zip.trim()));
    }

    if (step === 1) {
      return profile.kids.length > 0 && profile.kids.every((kid) => kid.name.trim().length > 0);
    }

    return true;
  }

  function focusValidationTarget(target: ValidationTarget) {
    if (mode === "onboard") {
      const stepByTarget: Record<ValidationTarget, number> = {
        parent: onboardingSlides.findIndex((slide) => slide.kind === "parent"),
        location: onboardingSlides.findIndex((slide) => slide.kind === "location"),
        kids: onboardingSlides.findIndex((slide) => slide.kind === "kids"),
        email: onboardingSlides.findIndex((slide) => slide.kind === "wrap"),
      };
      const nextStep = stepByTarget[target];
      if (nextStep >= 0) {
        setStep(nextStep);
      }
      return;
    }

    setEditing(true);
    setStep(target === "kids" ? 1 : 0);
  }

  function validateBeforeSave() {
    const messages: string[] = [];
    let target: ValidationTarget | null = null;

    if (!profile.parentName.trim()) {
      messages.push("Please enter your name.");
      target ??= "parent";
    }

    const trimmedEmail = profile.email?.trim() ?? "";
    if (trimmedEmail) {
      const emailResult = z.string().email().safeParse(trimmedEmail);
      if (!emailResult.success) {
        messages.push("Please enter a valid email address or leave it blank.");
        target ??= "email";
      }
    }

    if (!profile.location.city.trim() && !profile.location.zip.trim()) {
      messages.push("Please enter a city or zip code.");
      target ??= "location";
    }

    if (profile.kids.length === 0) {
      messages.push("Please add at least one child.");
      target ??= "kids";
    } else if (profile.kids.some((kid) => !kid.name.trim())) {
      messages.push("Please name all kids or remove empty entries.");
      target ??= "kids";
    }

    return { messages, target };
  }

  async function save(modeAfterSave: "today" | "stay") {
    const validation = validateBeforeSave();
    if (validation.messages.length > 0) {
      setError(validation.messages.join(" "));
      setStatus(null);
      if (validation.target) {
        focusValidationTarget(validation.target);
      }
      return;
    }

    try {
      const parsed = familyProfileSchema.parse({
        ...profile,
        location: {
          ...profile.location,
          label: buildLocationLabel(profile.location),
        },
        email: profile.email?.trim() || authUserEmail || "",
        schedule: {
          ...profile.schedule,
          napWindow: buildLegacyNapWindow(profile.schedule),
        },
      });

      const result = await saveProfile(parsed);
      setProfile(result.profile);
      setInterestDrafts(buildInterestDraftMap(result.profile.kids));
      setCustomInterestDrafts(buildCustomInterestDraftMap(result.profile.kids));
      setHasExistingProfile(true);
      setError(null);
      setStatus(
        mode === "onboard"
          ? result.persistence === "supabase"
            ? "Profile saved to your account. Building your day next."
            : "Profile saved on this device. Building your day next."
          : result.persistence === "supabase"
            ? "Settings saved to your account."
            : "Settings saved on this device.",
      );

      if (modeAfterSave === "today") {
        router.push("/today");
        return;
      }

      if (mode === "profile") {
        setEditing(false);
      }
    } catch {
      setError("Something went wrong saving your profile. Please check all fields and try again.");
      setStatus(null);
    }
  }

  function goToNextStep() {
    setStep((current) => Math.min(stepCount - 1, current + 1));
  }

  function goToPreviousStep() {
    setStep((current) => Math.max(0, current - 1));
  }

  function renderInterestTags(kidIndex: number, kid: ChildProfile) {
    if (kid.interests.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {kid.interests.map((interest) => (
          <Badge key={interest} variant="outline" className="gap-1 rounded-full px-3 py-1 text-foreground">
            {interest}
            <button type="button" onClick={() => removeInterest(kidIndex, kid, interest)} className="rounded-full">
              <X className="size-3" />
              <span className="sr-only">Remove {interest}</span>
            </button>
          </Badge>
        ))}
      </div>
    );
  }

  function renderProfileOverview() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
            <p className="text-sm text-muted-foreground">Location</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{buildLocationLabel(profile.location)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Used for weather, nearby outings, event filtering, and calmer same-day pivots.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
            <p className="text-sm text-muted-foreground">Kids</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{profile.kids.map((kid) => kid.name).join(", ")}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Ages {profile.kids.map((kid) => kid.age).join(", ")} · interests help tune the activity mix.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
            <p className="text-sm text-muted-foreground">Rhythm</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              Wake {profile.schedule.wakeTime} · Bed {profile.schedule.bedtime}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Free windows: {profile.schedule.freeTimeWindows || "not set yet"}.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
            <p className="text-sm text-muted-foreground">Materials</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{profile.materials.length} ready at home</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.materials.slice(0, 4).join(", ")}
              {profile.materials.length > 4 ? "..." : ""}
            </p>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-5 text-sm leading-7 text-muted-foreground">
          Profile basics stay on this device right now, alongside your history and saved items.
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-sm text-primary">{status}</p> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="touch-safe rounded-2xl px-6" onClick={() => setEditing(true)}>
            Edit family details
          </Button>
          <Button asChild variant="outline" className="touch-safe rounded-2xl">
            <Link href="/events">Open events</Link>
          </Button>
        </div>
      </div>
    );
  }

  function renderBasicsStep() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="parentName">Parent name</Label>
            <Input
              id="parentName"
              value={profile.parentName}
              onChange={(event) => updateProfile({ parentName: event.target.value })}
              placeholder="Alyssa"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email for daily digest</Label>
            <Input
              id="email"
              type="email"
              value={profile.email ?? ""}
              onChange={(event) => updateProfile({ email: event.target.value })}
              placeholder="you@example.com"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={profile.location.city}
              onChange={(event) => updateProfile({ location: { ...profile.location, city: event.target.value } })}
              placeholder="Newport Beach"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">Zip code</Label>
            <Input
              id="zip"
              value={profile.location.zip}
              onChange={(event) => updateProfile({ location: { ...profile.location, zip: event.target.value } })}
              placeholder="92660"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="label">Location label</Label>
            <Input
              id="label"
              value={profile.location.label}
              onChange={(event) => updateProfile({ location: { ...profile.location, label: event.target.value } })}
              placeholder="Newport Beach, CA"
              className="touch-safe rounded-2xl"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderKidsStep() {
    return (
      <div className="space-y-4">
        {profile.kids.map((kid, index) => {
          const suggestions = INTEREST_SUGGESTIONS.filter((suggestion) => !kid.interests.includes(suggestion));

          return (
            <Card key={kid.id} className="border-border/60 bg-white/70">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-2xl">Kid {index + 1}</CardTitle>
                    <CardDescription>PlayDays uses age and interests to keep ideas realistic.</CardDescription>
                  </div>
                  {profile.kids.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => removeKid(index)}>
                      <Trash2 className="size-4" />
                      <span className="sr-only">Remove kid</span>
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-2">
                  <Label htmlFor={`kid-name-${kid.id}`}>Name</Label>
                  <Input
                    id={`kid-name-${kid.id}`}
                    value={kid.name}
                    onChange={(event) => updateKid(index, { name: event.target.value })}
                    placeholder="Nora"
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-3">
                  <Label>Age</Label>
                  <AgeSelector value={kid.age} onChange={(age) => updateKid(index, { age })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`kid-interests-${kid.id}`}>Interests</Label>
                  <Input
                    id={`kid-interests-${kid.id}`}
                    value={getInterestDraft(kid)}
                    onChange={(event) =>
                      setInterestDrafts((current) => ({
                        ...current,
                        [kid.id]: event.target.value,
                      }))
                    }
                    onBlur={() => commitInterestDraft(index, kid.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        commitInterestDraft(index, kid.id);
                      }
                    }}
                    placeholder="dinosaurs, trucks, painting"
                    className="touch-safe rounded-2xl"
                  />
                  {renderInterestTags(index, kid)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Quick suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => replaceKidInterests(index, kid.id, [...kid.interests, suggestion])}
                        className="rounded-full border border-border/60 bg-white/70 px-3 py-1.5 text-sm transition-colors hover:border-primary/30 hover:bg-primary/10"
                      >
                        + {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Button type="button" variant="outline" className="touch-safe rounded-2xl" onClick={addKid}>
          <Plus className="mr-2 size-4" />
          Add another child
        </Button>
      </div>
    );
  }

  function renderRhythmStep() {
    return (
      <div className="space-y-6">
        <RhythmTimeline schedule={profile.schedule} onChange={updateSchedule} />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="schoolHours">School hours or commitments</Label>
            <Input
              id="schoolHours"
              value={profile.schedule.schoolHours}
              onChange={(event) => updateSchedule({ schoolHours: event.target.value })}
              placeholder="Mon/Wed preschool 9am-12pm"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="freeTimeWindows">Best free windows</Label>
            <Input
              id="freeTimeWindows"
              value={profile.schedule.freeTimeWindows}
              onChange={(event) => updateSchedule({ freeTimeWindows: event.target.value })}
              placeholder="9-11am, 3:30-5pm"
              className="touch-safe rounded-2xl"
            />
          </div>
        </div>
        <PreferenceEditor preferences={profile.preferences} onChange={updatePreferences} />
      </div>
    );
  }

  function renderMaterialsStep() {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label>Materials at home</Label>
            <Badge variant="outline" className="rounded-full">
              {profile.materials.length} selected
            </Badge>
          </div>
          <MaterialsPicker selected={profile.materials} onToggle={toggleMaterial} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Anything PlayDays should know?</Label>
          <Textarea
            id="notes"
            value={profile.notes}
            onChange={(event) => updateProfile({ notes: event.target.value })}
            rows={5}
            placeholder="Examples: one child gets overstimulated fast, mornings are best, baby often sleeps in the carrier."
            className="max-h-40 resize-y rounded-3xl"
          />
        </div>
        <div className="rounded-[1.5rem] border border-border/60 bg-white/70 p-5 text-sm leading-7 text-muted-foreground">
          <p className="font-medium text-foreground">Ready for the first real run</p>
          <p>PlayDays will use this setup for today&apos;s cards, local discovery, nap-trap mode, and the AI chat context.</p>
        </div>
      </div>
    );
  }

  function renderConversationalSlide() {
    switch (currentOnboardingSlide.kind) {
      case "parent":
        return (
          <QuestionBlock
            title="What's your name?"
            description="Just your first name. It helps PlayDays make the plan feel personal without asking for much."
          >
            <div className="mx-auto max-w-sm">
              <Input
                autoFocus
                value={profile.parentName}
                onChange={(event) => updateProfile({ parentName: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && profile.parentName.trim()) {
                    event.preventDefault();
                    goToNextStep();
                  }
                }}
                placeholder="e.g. Maya"
                className="touch-safe rounded-2xl text-center text-lg"
              />
            </div>
          </QuestionBlock>
        );

      case "location":
        return (
          <QuestionBlock
            title="Where do you live?"
            description="City or zip is enough. PlayDays uses it for weather and nearby outing ideas."
          >
            <div className="mx-auto grid max-w-xl gap-4 sm:grid-cols-2">
              <Input
                autoFocus
                value={profile.location.city}
                onChange={(event) => updateProfile({ location: { ...profile.location, city: event.target.value } })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (profile.location.city.trim() || profile.location.zip.trim())) {
                    event.preventDefault();
                    goToNextStep();
                  }
                }}
                placeholder="City"
                className="touch-safe rounded-2xl text-center text-lg sm:text-left"
              />
              <Input
                value={profile.location.zip}
                onChange={(event) => updateProfile({ location: { ...profile.location, zip: event.target.value } })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (profile.location.city.trim() || profile.location.zip.trim())) {
                    event.preventDefault();
                    goToNextStep();
                  }
                }}
                placeholder="Zip code"
                className="touch-safe rounded-2xl text-center text-lg sm:text-left"
              />
            </div>
          </QuestionBlock>
        );

      case "kids":
        return (
          <QuestionBlock
            title="Tell us about your kids"
            description="A name and age per child is enough. You can add more than one."
            align="left"
          >
            <div className="space-y-4">
              {profile.kids.map((kid, index) => (
                <div key={kid.id} className="rounded-[1.75rem] border border-border/60 bg-white/75 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Child {index + 1}</p>
                      <p className="text-sm text-muted-foreground">We use this to tune age-fit and pacing.</p>
                    </div>
                    {profile.kids.length > 1 ? (
                      <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => removeKid(index)}>
                        <Trash2 className="size-4" />
                        <span className="sr-only">Remove child</span>
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    value={kid.name}
                    onChange={(event) => updateKid(index, { name: event.target.value })}
                    placeholder="Name"
                    className="mt-4 touch-safe rounded-2xl text-lg"
                  />
                  <div className="mt-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">Age</p>
                    <AgeSelector value={kid.age} onChange={(age) => updateKid(index, { age })} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center">
              <Button type="button" variant="outline" className="touch-safe rounded-2xl px-5" onClick={addKid}>
                <Plus className="mr-2 size-4" />
                Add another child
              </Button>
            </div>
          </QuestionBlock>
        );

      case "interests": {
        const kid = profile.kids[currentOnboardingSlide.kidIndex];
        if (!kid) {
          return null;
        }

        const customInterests = kid.interests.filter((interest) => !INTEREST_SUGGESTIONS.includes(interest as (typeof INTEREST_SUGGESTIONS)[number]));

        return (
          <QuestionBlock
            title={`What are ${kid.name.trim() || "your child"}'s favorite things?`}
            description="Tap any that fit. Add custom interests below if they have a very specific obsession right now."
          >
            <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-3">
              {INTEREST_SUGGESTIONS.map((interest) => {
                const selected = kid.interests.includes(interest);
                return (
                  <SelectableChip
                    key={interest}
                    selected={selected}
                    onClick={() => toggleInterest(currentOnboardingSlide.kidIndex, kid, interest)}
                    className="px-5 py-2.5"
                  >
                    {interest}
                  </SelectableChip>
                );
              })}
            </div>

            {customInterests.length > 0 ? (
              <div className="mx-auto max-w-xl text-left">
                <p className="text-sm font-medium text-foreground">Custom picks</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customInterests.map((interest) => (
                    <Badge key={interest} variant="outline" className="gap-1 rounded-full px-3 py-1 text-foreground">
                      {interest}
                      <button
                        type="button"
                        onClick={() => removeInterest(currentOnboardingSlide.kidIndex, kid, interest)}
                        className="rounded-full"
                      >
                        <X className="size-3" />
                        <span className="sr-only">Remove {interest}</span>
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mx-auto max-w-md rounded-[1.75rem] border border-border/60 bg-white/75 p-4 text-left">
              <Label htmlFor={`custom-interest-${kid.id}`}>Add custom</Label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <Input
                  id={`custom-interest-${kid.id}`}
                  value={customInterestDrafts[kid.id] ?? ""}
                  onChange={(event) =>
                    setCustomInterestDrafts((current) => ({
                      ...current,
                      [kid.id]: event.target.value,
                    }))
                  }
                  onBlur={() => addCustomInterest(currentOnboardingSlide.kidIndex, kid)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomInterest(currentOnboardingSlide.kidIndex, kid);
                    }
                  }}
                  placeholder="e.g. bugs, buses, baking"
                  className="touch-safe rounded-2xl"
                />
                <Button type="button" variant="outline" className="touch-safe rounded-2xl" onClick={() => addCustomInterest(currentOnboardingSlide.kidIndex, kid)}>
                  Add
                </Button>
              </div>
            </div>
          </QuestionBlock>
        );
      }

      case "rhythm":
        return (
          <QuestionBlock
            title="What's a typical day look like?"
            description="A rough rhythm is enough. These times shape when PlayDays suggests calm blocks, outings, and backup pivots."
            align="left"
          >
            <RhythmTimeline schedule={profile.schedule} onChange={updateSchedule} />
            <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-2">
              <div className="space-y-2 text-left">
                <Label htmlFor="schoolHours-onboard">School or commitments</Label>
                <Input
                  id="schoolHours-onboard"
                  value={profile.schedule.schoolHours}
                  onChange={(event) => updateSchedule({ schoolHours: event.target.value })}
                  placeholder="Optional"
                  className="touch-safe rounded-2xl"
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="freeTimeWindows-onboard">Best free windows</Label>
                <Input
                  id="freeTimeWindows-onboard"
                  value={profile.schedule.freeTimeWindows}
                  onChange={(event) => updateSchedule({ freeTimeWindows: event.target.value })}
                  placeholder="Optional"
                  className="touch-safe rounded-2xl"
                />
              </div>
            </div>
          </QuestionBlock>
        );

      case "materials":
        return (
          <QuestionBlock
            title="What do you have at home?"
            description="Tap anything you already have around. PlayDays leans on these first before suggesting harder setups."
            align="left"
          >
            <div className="flex items-center justify-center">
              <Badge variant="outline" className="rounded-full px-4 py-1">
                {profile.materials.length} selected
              </Badge>
            </div>
            <MaterialsPicker selected={profile.materials} onToggle={toggleMaterial} large />
          </QuestionBlock>
        );

      case "preferences":
        return (
          <QuestionBlock
            title="Almost done. What mood should today favor?"
            description="This helps PlayDays bias the first pass toward your real energy, tolerance, and environment."
            align="left"
          >
            <PreferenceEditor preferences={profile.preferences} onChange={updatePreferences} />
          </QuestionBlock>
        );

      case "wrap":
        return (
          <QuestionBlock
            title="Anything else we should know?"
            description="Both of these are optional. Add context if it helps, or leave them blank and keep moving."
            align="left"
          >
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="space-y-2">
                <Label htmlFor="wrap-email">Email for the daily digest</Label>
                <Input
                  id="wrap-email"
                  type="email"
                  value={profile.email ?? ""}
                  onChange={(event) => updateProfile({ email: event.target.value })}
                  placeholder="you@example.com"
                  className="touch-safe rounded-2xl"
                />
                <p className="text-sm text-muted-foreground">For the daily 7am digest. Skip if you don&apos;t want it.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wrap-notes">Anything PlayDays should know?</Label>
                <Textarea
                  id="wrap-notes"
                  value={profile.notes}
                  onChange={(event) => updateProfile({ notes: event.target.value })}
                  rows={3}
                  placeholder="Examples: one child gets overstimulated fast, mornings are easiest, carrier naps happen a lot."
                  className="max-h-40 resize-y rounded-3xl"
                />
              </div>
              <div className="rounded-[1.75rem] border border-border/60 bg-white/70 p-5 text-sm leading-7 text-muted-foreground">
                <p className="font-medium text-foreground">What happens next</p>
                <p>PlayDays uses this setup for today&apos;s cards, nearby discovery, nap-trap fallbacks, and chat context.</p>
                <p className="mt-3">Everything stays on this device. Sign in later to sync across devices.</p>
              </div>
            </div>
          </QuestionBlock>
        );
    }
  }

  if (mode === "profile" && !initialProfile && !isHydrated) {
    return (
      <div className="page-shell py-10 sm:py-14">
        <Card className="card-soft mx-auto max-w-3xl border-border/60">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Profile
            </Badge>
            <CardTitle className="text-4xl text-balance">Checking your saved family profile.</CardTitle>
            <CardDescription className="text-base leading-7">
              PlayDays is loading any family details saved in this browser before it decides whether to show your profile or setup guidance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (mode === "profile" && !hasExistingProfile) {
    return (
      <div className="page-shell py-10 sm:py-14">
        <Card className="card-soft mx-auto max-w-3xl border-border/60">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Profile
            </Badge>
            <CardTitle className="text-4xl text-balance">Finish setup before you use your profile.</CardTitle>
            <CardDescription className="text-base leading-7">
              Your profile is for maintaining a saved family setup. Start setup first, or open the demo day if you just want to look around.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="touch-safe rounded-2xl px-6">
              <Link href="/start-setup">Start setup</Link>
            </Button>
            <Button asChild variant="outline" className="touch-safe rounded-2xl">
              <Link href="/today">See demo day</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "onboard") {
    const isLastSlide = currentOnboardingSlide.kind === "wrap";

    return (
      <div className="page-shell py-10 sm:py-14">
        <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-3xl flex-col justify-between gap-8 overflow-hidden">
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3">
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
                First-time setup
              </Badge>
              <div className="w-full max-w-xs space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{currentOnboardingSlide.label}</span>
                  <span>
                    {step + 1} / {onboardingSlides.length}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
              <Button type="button" variant="outline" className="touch-safe rounded-full px-5" onClick={loadDemoFamily}>
                <Sparkles className="mr-2 size-4" />
                Load demo family
              </Button>
            </div>

            <div key={currentOnboardingSlide.id} className="conversational-step flex min-h-[55vh] flex-1 flex-col justify-center">
              {renderConversationalSlide()}
            </div>
          </div>

          <div className="space-y-4">
            {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
            {status ? <p className="text-center text-sm text-primary">{status}</p> : null}
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                className={cn("touch-safe rounded-2xl px-6", step === 0 ? "pointer-events-none opacity-0" : "")}
                onClick={goToPreviousStep}
              >
                Back
              </Button>
              <Button
                type="button"
                className="touch-safe rounded-2xl px-8"
                disabled={isLastSlide ? false : !getCurrentStepValid()}
                onClick={() => {
                  if (isLastSlide) {
                    void save("today");
                    return;
                  }
                  goToNextStep();
                }}
              >
                {isLastSlide ? (
                  <>
                    Build my first day
                    <Sparkles className="ml-2 size-4" />
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="card-soft border-border/60 lg:sticky lg:top-24 lg:h-fit">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Family profile
            </Badge>
            <CardTitle className="text-4xl text-balance">{title}</CardTitle>
            <CardDescription className="text-base leading-7">{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {editing ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{EDIT_STEPS[step]}</span>
                    <span>
                      {step + 1} / {EDIT_STEPS.length}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="grid gap-2">
                  {EDIT_STEPS.map((item, index) => (
                    <Button
                      key={item}
                      type="button"
                      variant={index === step ? "default" : "ghost"}
                      className="touch-safe justify-start rounded-2xl px-4"
                      onClick={() => setStep(index)}
                    >
                      {item}
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <div className="grid gap-3">
                <div className="rounded-[1.25rem] border border-border/60 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
                  <p className="font-medium text-foreground">Family snapshot</p>
                  <p className="mt-2">
                    {profile.kids.length} kids, {profile.materials.length} materials saved, digest {profile.preferences.digestEnabled ? "on" : "off"}.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
                  <p className="font-medium text-foreground">Today&apos;s shape</p>
                  <p className="mt-2">
                    {buildLocationLabel(profile.location)} · wake {profile.schedule.wakeTime} · bedtime {profile.schedule.bedtime}
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-[1.25rem] border border-border/60 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">What this profile shapes</p>
              <p>Weather fit, activity difficulty, one-handed options, local outing picks, and the tone of chat guidance.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft border-border/60 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <CardContent className="space-y-8 pt-6">
            {!editing ? renderProfileOverview() : null}

            {editing ? (
              <>
                {step === 0 ? renderBasicsStep() : null}
                {step === 1 ? renderKidsStep() : null}
                {step === 2 ? renderRhythmStep() : null}
                {step === 3 ? renderMaterialsStep() : null}

                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {status ? <p className="text-sm text-primary">{status}</p> : null}

                <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    className="touch-safe rounded-2xl"
                    disabled={step === 0}
                    onClick={goToPreviousStep}
                  >
                    Back
                  </Button>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="ghost" className="touch-safe rounded-2xl" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                    {step < EDIT_STEPS.length - 1 ? (
                      <Button
                        type="button"
                        className="touch-safe rounded-2xl px-6"
                        disabled={!getCurrentStepValid()}
                        onClick={goToNextStep}
                      >
                        Next
                      </Button>
                    ) : (
                      <Button type="button" className="touch-safe rounded-2xl px-6" onClick={() => void save("stay")}>
                        Save profile
                      </Button>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
