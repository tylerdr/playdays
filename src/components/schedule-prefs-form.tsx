"use client";

import { useState } from "react";
import { SCHEDULE_FREE_DAY_OPTIONS, schedulePrefsSchema, type SchedulePrefs } from "@/lib/schemas";
import { getSchedulePrefs, saveSchedulePrefs } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const budgetOptions: SchedulePrefs["budget"][] = ["free", "moderate", "flexible"];

export function SchedulePrefsForm() {
  const [values, setValues] = useState<SchedulePrefs>(() => getSchedulePrefs());
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: (typeof SCHEDULE_FREE_DAY_OPTIONS)[number]) {
    setValues((current) => ({
      ...current,
      freeDays: current.freeDays.includes(day)
        ? current.freeDays.filter((item) => item !== day)
        : [...current.freeDays, day],
    }));
  }

  function save() {
    try {
      const parsed = schedulePrefsSchema.parse(values);
      saveSchedulePrefs(parsed);
      setValues(parsed);
      setStatus("Schedule preferences saved on this device.");
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save schedule preferences.");
    }
  }

  return (
    <Card className="card-soft border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Schedule preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Best free days</Label>
          <div className="flex flex-wrap gap-2">
            {SCHEDULE_FREE_DAY_OPTIONS.map((day) => (
              <Button
                key={day}
                type="button"
                variant={values.freeDays.includes(day) ? "default" : "outline"}
                className="touch-safe rounded-full px-4 capitalize"
                onClick={() => toggleDay(day)}
              >
                {day}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4 text-left"
            onClick={() => setValues((current) => ({ ...current, morningFree: !current.morningFree }))}
          >
            <p className="text-sm text-muted-foreground">Morning</p>
            <Badge className="mt-3 rounded-full">{values.morningFree ? "Usually free" : "Usually booked"}</Badge>
          </button>
          <button
            type="button"
            className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4 text-left"
            onClick={() => setValues((current) => ({ ...current, afternoonFree: !current.afternoonFree }))}
          >
            <p className="text-sm text-muted-foreground">Afternoon</p>
            <Badge className="mt-3 rounded-full">{values.afternoonFree ? "Usually free" : "Usually booked"}</Badge>
          </button>
          <button
            type="button"
            className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4 text-left"
            onClick={() => setValues((current) => ({ ...current, eveningFree: !current.eveningFree }))}
          >
            <p className="text-sm text-muted-foreground">Evening</p>
            <Badge className="mt-3 rounded-full">{values.eveningFree ? "Usually free" : "Usually booked"}</Badge>
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="max-drive">Max drive minutes</Label>
            <Input
              id="max-drive"
              type="number"
              min={5}
              max={180}
              value={values.maxDriveMinutes}
              onChange={(event) =>
                setValues((current) => ({ ...current, maxDriveMinutes: Number(event.target.value) || 30 }))
              }
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Budget comfort</Label>
            <div className="flex flex-wrap gap-2">
              {budgetOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={values.budget === option ? "default" : "outline"}
                  className="touch-safe rounded-full px-4 capitalize"
                  onClick={() => setValues((current) => ({ ...current, budget: option }))}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nap-start">Nap start</Label>
            <Input
              id="nap-start"
              type="time"
              value={values.napStart}
              onChange={(event) => setValues((current) => ({ ...current, napStart: event.target.value }))}
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nap-end">Nap end</Label>
            <Input
              id="nap-end"
              type="time"
              value={values.napEnd}
              onChange={(event) => setValues((current) => ({ ...current, napEnd: event.target.value }))}
              className="touch-safe rounded-2xl"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-sm text-primary">{status}</p> : null}

        <Button type="button" className="touch-safe rounded-2xl px-6" onClick={save}>
          Save schedule preferences
        </Button>
      </CardContent>
    </Card>
  );
}
