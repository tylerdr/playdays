"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { createEmptyProfile, familyProfileSchema, MATERIAL_OPTIONS, type FamilyProfile } from "@/lib/schemas";
import { getProfile, saveProfile } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const steps = ["Basics", "Kids", "Rhythm", "Materials"];

function buildInitialProfile(initialProfile: FamilyProfile | null, authUserEmail?: string | null) {
  const existing = initialProfile ?? getProfile();
  if (existing) {
    return existing;
  }

  const emptyProfile = createEmptyProfile();
  if (authUserEmail) {
    emptyProfile.email = authUserEmail;
  }
  return emptyProfile;
}

export function ProfileForm({
  mode,
  initialProfile = null,
  authUserEmail = null,
}: {
  mode: "onboard" | "settings";
  initialProfile?: FamilyProfile | null;
  authUserEmail?: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [hasExistingProfile, setHasExistingProfile] = useState(
    () => Boolean(initialProfile ?? getProfile())
  );
  const [editing, setEditing] = useState(() => mode === "onboard");
  const [profile, setProfile] = useState<FamilyProfile>(() =>
    buildInitialProfile(initialProfile, authUserEmail)
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title =
    mode === "onboard"
      ? "Build your first calmer day"
      : editing
        ? "Edit family details"
        : "Family settings";
  const description =
    mode === "onboard"
      ? "Takes about two minutes. Just enough to shape your first weather-smart plan."
      : editing
        ? "Update the details that shape your plan, discovery, and chat context."
        : "Review what PlayDays knows about your family, then make quick edits only when something changes.";

  const progress = useMemo(() => ((step + 1) / steps.length) * 100, [step]);

  function updateProfile(patch: Partial<FamilyProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  function updateKid(index: number, patch: Partial<FamilyProfile["kids"][number]>) {
    setProfile((current) => ({
      ...current,
      kids: current.kids.map((kid, kidIndex) => (kidIndex === index ? { ...kid, ...patch } : kid)),
    }));
  }

  function updateSchedule(patch: Partial<FamilyProfile["schedule"]>) {
    setProfile((current) => ({
      ...current,
      schedule: {
        ...current.schedule,
        ...patch,
      },
    }));
  }

  function addKid() {
    setProfile((current) => ({
      ...current,
      kids: [
        ...current.kids,
        {
          id: crypto.randomUUID(),
          name: "",
          age: 2,
          interests: [],
        },
      ],
    }));
  }

  function removeKid(index: number) {
    setProfile((current) => ({
      ...current,
      kids: current.kids.filter((_, kidIndex) => kidIndex !== index),
    }));
  }

  function toggleMaterial(material: string, checked: boolean) {
    const next = checked
      ? [...profile.materials, material]
      : profile.materials.filter((item) => item !== material);
    updateProfile({ materials: Array.from(new Set(next)) });
  }

  async function save(modeAfterSave: "today" | "stay") {
    try {
      const parsed = familyProfileSchema.parse({
        ...profile,
        location: {
          ...profile.location,
          label:
            profile.location.label ||
            [profile.location.city, profile.location.zip].filter(Boolean).join(", "),
        },
        email: profile.email || authUserEmail || "",
      });
      const result = await saveProfile(parsed);
      setProfile(result.profile);
      setHasExistingProfile(true);
      setError(null);
      setStatus(
        mode === "onboard"
          ? result.persistence === "supabase"
            ? "Profile saved to your account. Building your day next."
            : "Profile saved on this device. Building your day next."
          : result.persistence === "supabase"
            ? "Settings saved to your account."
            : "Settings saved on this device."
      );
      if (modeAfterSave === "today") {
        router.push("/today");
        return;
      }
      if (mode === "settings") {
        setEditing(false);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save profile.");
    }
  }

  const canAdvance =
    step === 0
      ? Boolean(profile.parentName && (profile.location.city || profile.location.zip))
      : step === 1
        ? profile.kids.every((kid) => kid.name.trim().length > 0)
        : true;

  if (mode === "settings" && !hasExistingProfile) {
    return (
      <div className="page-shell py-10 sm:py-14">
        <Card className="card-soft mx-auto max-w-3xl border-border/60">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              Settings
            </Badge>
            <CardTitle className="text-4xl text-balance">Finish setup before you use settings.</CardTitle>
            <CardDescription className="text-base leading-7">
              Settings are for maintaining a saved family profile. Start setup first, or open the demo day if you just want to look around.
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

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="card-soft border-border/60 lg:sticky lg:top-24 lg:h-fit">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">
              {mode === "onboard" ? "First-time setup" : "Family profile"}
            </Badge>
            <CardTitle className="text-4xl text-balance">{title}</CardTitle>
            <CardDescription className="text-base leading-7">{description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {mode === "onboard" || editing ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{steps[step]}</span>
                    <span>{step + 1} / {steps.length}</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <div className="grid gap-2">
                  {steps.map((item, index) => (
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
                    {profile.kids.length} kids, {profile.materials.length} materials saved, digest{" "}
                    {profile.preferences.digestEnabled ? "on" : "off"}.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
                  <p className="font-medium text-foreground">Today&apos;s shape</p>
                  <p className="mt-2">
                    {profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")} · wake{" "}
                    {profile.schedule.wakeTime} · bedtime {profile.schedule.bedtime}
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-[1.25rem] border border-border/60 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">
                {mode === "onboard" ? "How this personalizes your first plan" : "What these settings shape"}
              </p>
              <p>
                Weather fit, activity difficulty, one-handed options, local outing picks, and the tone of chat guidance.
              </p>
            </div>
            {mode === "onboard" ? (
              <Button
                type="button"
                variant="outline"
                className="touch-safe w-full rounded-2xl"
                onClick={() => {
                  const demo = familyProfileSchema.parse({
                    parentName: "Maya",
                    email: "maya@example.com",
                    location: { city: "Newport Beach", zip: "92660", label: "Newport Beach, CA" },
                    kids: [
                      { id: crypto.randomUUID(), name: "Nora", age: 4, interests: ["dinosaurs", "music"] },
                      { id: crypto.randomUUID(), name: "Leo", age: 2, interests: ["trucks", "animals"] },
                    ],
                    schedule: {
                      schoolHours: "No school today",
                      napWindow: "1-3pm",
                      freeTimeWindows: "9-11am, 3:30-5pm",
                      wakeTime: "07:00",
                      nap1Start: "13:00",
                      nap1End: "15:00",
                      nap2Start: "",
                      nap2End: "",
                      bedtime: "19:30",
                    },
                    preferences: { indoorOutdoorPreference: "balanced", messTolerance: 3, energyLevelToday: 4, digestEnabled: true },
                    materials: ["Craft supplies", "Bubbles", "Books", "Play-doh"],
                    notes: "A sleeping baby often changes the afternoon plan.",
                  });
                  setProfile(demo);
                  setStatus("Demo family loaded into the form. Save when you want to use it.");
                  setError(null);
                }}
              >
                <Sparkles className="mr-2 size-4" />
                Load demo family
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card className="card-soft border-border/60">
          <CardContent className="space-y-8 pt-6">
            {mode === "settings" && !editing ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Used for weather, nearby outings, and calmer same-day pivots.
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] border border-border/60 bg-white/75 p-5">
                    <p className="text-sm text-muted-foreground">Kids</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {profile.kids.map((kid) => kid.name).join(", ")}
                    </p>
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
                  Settings keep your saved family profile current. History and saved items still live on this device.
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {status ? <p className="text-sm text-primary">{status}</p> : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" className="touch-safe rounded-2xl px-6" onClick={() => setEditing(true)}>
                    Edit family details
                  </Button>
                  <Button asChild variant="outline" className="touch-safe rounded-2xl">
                    <Link href="/today">Open today</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {mode === "settings" && !editing ? null : (
              <>
            {step === 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
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
            ) : null}

            {step === 1 ? (
              <div className="space-y-4">
                {profile.kids.map((kid, index) => (
                  <Card key={kid.id} className="border-border/60 bg-white/70">
                    <CardHeader className="pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-2xl">Kid {index + 1}</CardTitle>
                          <CardDescription>PlayDays uses interests and age to tune ideas.</CardDescription>
                        </div>
                        {profile.kids.length > 1 ? (
                          <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => removeKid(index)}>
                            <Trash2 className="size-4" />
                            <span className="sr-only">Remove kid</span>
                          </Button>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
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
                      <div className="space-y-2">
                        <Label htmlFor={`kid-age-${kid.id}`}>Age</Label>
                        <Input
                          id={`kid-age-${kid.id}`}
                          type="number"
                          min={0}
                          max={12}
                          value={kid.age}
                          onChange={(event) => updateKid(index, { age: Number(event.target.value) || 0 })}
                          className="touch-safe rounded-2xl"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`kid-interests-${kid.id}`}>Interests</Label>
                        <Input
                          id={`kid-interests-${kid.id}`}
                          value={kid.interests.join(", ")}
                          onChange={(event) =>
                            updateKid(index, {
                              interests: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="dinosaurs, trucks, painting"
                          className="touch-safe rounded-2xl"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button type="button" variant="outline" className="touch-safe rounded-2xl" onClick={addKid}>
                  <Plus className="mr-2 size-4" />
                  Add another child
                </Button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="schoolHours">School hours</Label>
                  <Input
                    id="schoolHours"
                    value={profile.schedule.schoolHours}
                    onChange={(event) => updateSchedule({ schoolHours: event.target.value })}
                    placeholder="Mon/Wed preschool 9am-12pm"
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wakeTime">Wake time</Label>
                  <Input
                    id="wakeTime"
                    type="time"
                    value={profile.schedule.wakeTime}
                    onChange={(event) => updateSchedule({ wakeTime: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nap1Start">Nap 1 start</Label>
                  <Input
                    id="nap1Start"
                    type="time"
                    value={profile.schedule.nap1Start}
                    onChange={(event) => updateSchedule({ nap1Start: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nap1End">Nap 1 end</Label>
                  <Input
                    id="nap1End"
                    type="time"
                    value={profile.schedule.nap1End}
                    onChange={(event) => updateSchedule({ nap1End: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nap2Start">Nap 2 start</Label>
                  <Input
                    id="nap2Start"
                    type="time"
                    value={profile.schedule.nap2Start}
                    onChange={(event) => updateSchedule({ nap2Start: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nap2End">Nap 2 end</Label>
                  <Input
                    id="nap2End"
                    type="time"
                    value={profile.schedule.nap2End}
                    onChange={(event) => updateSchedule({ nap2End: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedtime">Bedtime</Label>
                  <Input
                    id="bedtime"
                    type="time"
                    value={profile.schedule.bedtime}
                    onChange={(event) => updateSchedule({ bedtime: event.target.value })}
                    className="touch-safe rounded-2xl"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="napWindow">Nap notes</Label>
                  <Input
                    id="napWindow"
                    value={profile.schedule.napWindow}
                    onChange={(event) => updateSchedule({ napWindow: event.target.value })}
                    placeholder="Carrier nap around 1-3pm if we are out"
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
                <div className="space-y-2">
                  <Label>Indoor or outdoor bias</Label>
                  <Select
                    value={profile.preferences.indoorOutdoorPreference}
                    onValueChange={(value) =>
                      updateProfile({
                        preferences: {
                          ...profile.preferences,
                          indoorOutdoorPreference: value as FamilyProfile["preferences"]["indoorOutdoorPreference"],
                        },
                      })
                    }
                  >
                    <SelectTrigger className="touch-safe w-full rounded-2xl">
                      <SelectValue placeholder="Choose a bias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mostly-indoor">Mostly indoor</SelectItem>
                      <SelectItem value="balanced">Balanced</SelectItem>
                      <SelectItem value="mostly-outdoor">Mostly outdoor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Mess tolerance</Label>
                    <Badge variant="outline" className="rounded-full">{profile.preferences.messTolerance}/5</Badge>
                  </div>
                  <Slider
                    value={[profile.preferences.messTolerance]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(value) =>
                      updateProfile({
                        preferences: {
                          ...profile.preferences,
                          messTolerance: value[0] ?? 3,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Energy level today</Label>
                    <Badge variant="outline" className="rounded-full">{profile.preferences.energyLevelToday}/5</Badge>
                  </div>
                  <Slider
                    value={[profile.preferences.energyLevelToday]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(value) =>
                      updateProfile({
                        preferences: {
                          ...profile.preferences,
                          energyLevelToday: value[0] ?? 3,
                        },
                      })
                    }
                  />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/70 px-4 py-3">
                    <div>
                      <Label htmlFor="digestEnabled">Daily 7am digest</Label>
                      <p className="text-sm text-muted-foreground">Send the five-card plan and local picks by email.</p>
                    </div>
                    <Switch
                      id="digestEnabled"
                      checked={profile.preferences.digestEnabled}
                      onCheckedChange={(checked) =>
                        updateProfile({
                          preferences: {
                            ...profile.preferences,
                            digestEnabled: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Materials at home</Label>
                    <Badge variant="outline" className="rounded-full">{profile.materials.length} selected</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {MATERIAL_OPTIONS.map((material) => {
                      const checked = profile.materials.includes(material);
                      return (
                        <label
                          key={material}
                          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-sm text-foreground"
                        >
                          <Checkbox checked={checked} onCheckedChange={(value) => toggleMaterial(material, value === true)} />
                          <span>{material}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Anything PlayDays should know?</Label>
                  <Textarea
                    id="notes"
                    value={profile.notes}
                    onChange={(event) => updateProfile({ notes: event.target.value })}
                    rows={5}
                    placeholder="Examples: one child gets overstimulated fast, mornings are best, baby often sleeps in the carrier."
                    className="rounded-3xl"
                  />
                </div>
                <div className="rounded-[1.5rem] border border-border/60 bg-white/70 p-5 text-sm leading-7 text-muted-foreground">
                  <p className="font-medium text-foreground">Ready for the first real run</p>
                  <p>
                    PlayDays will use this setup for today&apos;s cards, local discovery, nap-trap mode, and the AI chat context.
                  </p>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {status ? <p className="text-sm text-primary">{status}</p> : null}

            <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="outline"
                className="touch-safe rounded-2xl"
                disabled={step === 0}
                onClick={() => setStep((current) => Math.max(0, current - 1))}
              >
                Back
              </Button>
              <div className="flex flex-col gap-3 sm:flex-row">
                {mode === "settings" ? (
                  <Button type="button" variant="ghost" className="touch-safe rounded-2xl" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                ) : null}
                {step < steps.length - 1 ? (
                  <Button
                    type="button"
                    className="touch-safe rounded-2xl px-6"
                    disabled={!canAdvance}
                    onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="button" className="touch-safe rounded-2xl px-6" onClick={() => save(mode === "onboard" ? "today" : "stay")}>
                    {mode === "onboard" ? "Save and build today" : "Save settings"}
                  </Button>
                )}
              </div>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
