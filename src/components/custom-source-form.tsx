"use client";

import { useState } from "react";
import { dayOfWeekSchema, customSourceSchema, type CustomSource } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const defaultSource: Omit<CustomSource, "id" | "createdAt"> = {
  name: "",
  locationName: "",
  locationAddress: "",
  dayOfWeek: "",
  startTime: "",
  endTime: "",
  recurrenceText: "",
  notes: "",
  isActive: true,
};

export function CustomSourceForm({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue?: CustomSource | null;
  onSave: (source: CustomSource) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Omit<CustomSource, "id" | "createdAt"> & Partial<Pick<CustomSource, "id" | "createdAt">>>(
    initialValue ?? defaultSource,
  );
  const [error, setError] = useState<string | null>(null);

  function submit() {
    try {
      const parsed = customSourceSchema.parse({
        ...values,
        id: values.id ?? crypto.randomUUID(),
        createdAt: values.createdAt ?? new Date().toISOString(),
      });
      onSave(parsed);
      setValues(defaultSource);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save recurring source.");
    }
  }

  return (
    <Card className="card-soft border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">
          {initialValue ? "Edit recurring program" : "Add recurring program"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="source-name">Program name</Label>
            <Input
              id="source-name"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Lifetime KidsClub"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-location-name">Location name</Label>
            <Input
              id="source-location-name"
              value={values.locationName}
              onChange={(event) => setValues((current) => ({ ...current, locationName: event.target.value }))}
              placeholder="Lifetime Fitness"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-location-address">Address</Label>
            <Input
              id="source-location-address"
              value={values.locationAddress}
              onChange={(event) => setValues((current) => ({ ...current, locationAddress: event.target.value }))}
              placeholder="123 Main St"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label>Day of week</Label>
            <Select
              value={values.dayOfWeek || "__none__"}
              onValueChange={(value) =>
                setValues((current) => ({ ...current, dayOfWeek: value === "__none__" ? "" : value as CustomSource["dayOfWeek"] }))
              }
            >
              <SelectTrigger className="touch-safe w-full rounded-2xl">
                <SelectValue placeholder="Choose a day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No fixed day yet</SelectItem>
                {dayOfWeekSchema.options.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-recurrence">Recurrence notes</Label>
            <Input
              id="source-recurrence"
              value={values.recurrenceText}
              onChange={(event) => setValues((current) => ({ ...current, recurrenceText: event.target.value }))}
              placeholder="Every Saturday except holiday weekends"
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-start">Start time</Label>
            <Input
              id="source-start"
              type="time"
              value={values.startTime}
              onChange={(event) => setValues((current) => ({ ...current, startTime: event.target.value }))}
              className="touch-safe rounded-2xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-end">End time</Label>
            <Input
              id="source-end"
              type="time"
              value={values.endTime}
              onChange={(event) => setValues((current) => ({ ...current, endTime: event.target.value }))}
              className="touch-safe rounded-2xl"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="source-notes">Notes</Label>
          <Textarea
            id="source-notes"
            value={values.notes}
            onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
            rows={4}
            placeholder="Examples: bring grip socks, sibling can use childwatch, easiest after nap."
            className="rounded-3xl"
          />
        </div>

        <div className="flex items-center justify-between rounded-[1.35rem] border border-border/60 bg-white/80 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Active in planning</p>
            <p className="text-sm text-muted-foreground">Keep this recurring source visible in profile and events.</p>
          </div>
          <Switch
            checked={values.isActive}
            onCheckedChange={(checked) => setValues((current) => ({ ...current, isActive: checked }))}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="touch-safe rounded-2xl px-6" onClick={submit}>
            {initialValue ? "Save changes" : "Add program"}
          </Button>
          {onCancel ? (
            <Button type="button" variant="outline" className="touch-safe rounded-2xl" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
