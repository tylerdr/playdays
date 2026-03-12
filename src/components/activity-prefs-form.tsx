"use client";

import { useState } from "react";
import {
  ACTIVITY_SETTING_OPTIONS,
  ACTIVITY_TYPE_OPTIONS,
  activityPrefsSchema,
  type ActivityPrefs,
} from "@/lib/schemas";
import { getActivityPrefs, saveActivityPrefs } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const indoorOutdoorOptions: ActivityPrefs["indoorOutdoor"][] = ["indoor", "outdoor", "both"];
const energyOptions: ActivityPrefs["energyLevel"][] = ["low", "medium", "high"];

export function ActivityPrefsForm() {
  const [values, setValues] = useState<ActivityPrefs>(() => getActivityPrefs());
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleInList(key: "types" | "settings", value: string) {
    setValues((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  }

  function save() {
    try {
      const parsed = activityPrefsSchema.parse(values);
      saveActivityPrefs(parsed);
      setValues(parsed);
      setStatus("Activity preferences saved on this device.");
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save activity preferences.");
    }
  }

  return (
    <Card className="card-soft border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Activity preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Activity types</Label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TYPE_OPTIONS.map((type) => (
              <Button
                key={type}
                type="button"
                variant={values.types.includes(type) ? "default" : "outline"}
                className="touch-safe rounded-full px-4 capitalize"
                onClick={() => toggleInList("types", type)}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Preferred settings</Label>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_SETTING_OPTIONS.map((setting) => (
              <Button
                key={setting}
                type="button"
                variant={values.settings.includes(setting) ? "default" : "outline"}
                className="touch-safe rounded-full px-4 capitalize"
                onClick={() => toggleInList("settings", setting)}
              >
                {setting}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label>Indoor or outdoor</Label>
            <div className="flex flex-wrap gap-2">
              {indoorOutdoorOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={values.indoorOutdoor === option ? "default" : "outline"}
                  className="touch-safe rounded-full px-4 capitalize"
                  onClick={() => setValues((current) => ({ ...current, indoorOutdoor: option }))}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Typical energy level</Label>
            <div className="flex flex-wrap gap-2">
              {energyOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={values.energyLevel === option ? "default" : "outline"}
                  className="touch-safe rounded-full px-4 capitalize"
                  onClick={() => setValues((current) => ({ ...current, energyLevel: option }))}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {status ? <p className="text-sm text-primary">{status}</p> : null}

        <Button type="button" className="touch-safe rounded-2xl px-6" onClick={save}>
          Save activity preferences
        </Button>
      </CardContent>
    </Card>
  );
}
