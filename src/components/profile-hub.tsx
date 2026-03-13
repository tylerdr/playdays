"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEventDateRange } from "@/lib/events";
import type { CustomSource, SavedEvent } from "@/lib/schemas";
import { getCustomSources, getSavedEvents, removeCustomSource, removeSavedEvent, saveCustomSource, upsertSavedEvent } from "@/lib/storage";
import { ProfileForm } from "@/components/profile-form";
import { ActivityPrefsForm } from "@/components/activity-prefs-form";
import { CustomSourceForm } from "@/components/custom-source-form";
import { SchedulePrefsForm } from "@/components/schedule-prefs-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const savedListOrder: SavedEvent["listName"][] = ["saved", "want_to_try", "done"];

function getSavedEventTitle(item: SavedEvent) {
  return item.eventSnapshot?.title || item.customEvent?.title || "Saved event";
}

function getSavedEventSubtitle(item: SavedEvent) {
  const event = item.eventSnapshot ?? item.customEvent;
  if (!event) {
    return "Saved on this device";
  }

  return [formatEventDateRange(event), event.locationName || event.city].filter(Boolean).join(" · ");
}

export function ProfileHub() {
  const [savedEvents, setSavedEvents] = useState<SavedEvent[]>(() => getSavedEvents());
  const [customSources, setCustomSources] = useState<CustomSource[]>(() => getCustomSources());
  const [editingSource, setEditingSource] = useState<CustomSource | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const groupedSaved = useMemo(
    () =>
      Object.fromEntries(
        savedListOrder.map((listName) => [listName, savedEvents.filter((item) => item.listName === listName)]),
      ) as Record<SavedEvent["listName"], SavedEvent[]>,
    [savedEvents],
  );

  function handleSaveSource(source: CustomSource) {
    const next = saveCustomSource(source);
    setCustomSources(next);
    setEditingSource(null);
    setStatus(`${source.name} saved in your recurring programs.`);
  }

  function handleRemoveSource(id: string) {
    setCustomSources(removeCustomSource(id));
    setStatus("Recurring program removed from this device.");
  }

  function moveSavedEvent(item: SavedEvent, listName: SavedEvent["listName"]) {
    const next = upsertSavedEvent({
      id: item.id,
      eventId: item.eventId ?? undefined,
      eventSnapshot: item.eventSnapshot ?? null,
      customEvent: item.customEvent ?? null,
      listName,
      notes: item.notes,
      createdAt: item.createdAt,
    });
    setSavedEvents(next);
    setStatus(`${getSavedEventTitle(item)} moved to ${listName.replaceAll("_", " ")}.`);
  }

  function removeSaved(item: SavedEvent) {
    const next = removeSavedEvent({ id: item.id, eventId: item.eventId ?? undefined });
    setSavedEvents(next);
    setStatus(`${getSavedEventTitle(item)} removed from saved events.`);
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="space-y-6">
        <Card className="card-soft border-border/60">
          <CardHeader className="space-y-4">
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">Profile</Badge>
            <CardTitle className="text-4xl text-balance">Keep your family context, saved lists, and recurring programs in one place.</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            This page still saves to the current device until auth-backed persistence lands. The contracts match the later Supabase model, but nothing here pretends to be synced yet.
            {status ? <p className="mt-3 text-primary">{status}</p> : null}
          </CardContent>
        </Card>

        <Tabs defaultValue="overview" className="gap-5">
          <TabsList variant="line" className="w-full justify-start gap-2 overflow-x-auto rounded-full border border-border/60 bg-white/70 p-1">
            <TabsTrigger value="overview" className="rounded-full px-4">
              Overview
            </TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-full px-4">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="preferences" className="rounded-full px-4">
              Preferences
            </TabsTrigger>
            <TabsTrigger value="saved" className="rounded-full px-4">
              Saved
            </TabsTrigger>
            <TabsTrigger value="programs" className="rounded-full px-4">
              Programs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ProfileForm mode="profile" />
          </TabsContent>

          <TabsContent value="schedule">
            <SchedulePrefsForm />
          </TabsContent>

          <TabsContent value="preferences">
            <ActivityPrefsForm />
          </TabsContent>

          <TabsContent value="saved">
            <div className="grid gap-5 lg:grid-cols-3">
              {savedListOrder.map((listName) => (
                <Card key={listName} className="card-soft border-border/60">
                  <CardHeader>
                    <CardTitle className="text-2xl capitalize">{listName.replaceAll("_", " ")}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {groupedSaved[listName].length ? (
                      groupedSaved[listName].map((item) => (
                        <div key={item.id} className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4">
                          <p className="font-medium text-foreground">{getSavedEventTitle(item)}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{getSavedEventSubtitle(item)}</p>
                          <div className="mt-3 flex flex-col gap-3">
                            {item.eventId ? (
                              <Button asChild variant="outline" className="touch-safe rounded-2xl">
                                <Link href={`/events/${item.eventId}`}>Open event</Link>
                              </Button>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {savedListOrder
                                .filter((option) => option !== listName)
                                .map((option) => (
                                  <Button
                                    key={option}
                                    type="button"
                                    variant="ghost"
                                    className="touch-safe rounded-full capitalize"
                                    onClick={() => moveSavedEvent(item, option)}
                                  >
                                    Move to {option.replaceAll("_", " ")}
                                  </Button>
                                ))}
                              <Button
                                type="button"
                                variant="ghost"
                                className="touch-safe rounded-full text-destructive"
                                onClick={() => removeSaved(item)}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
                        No events in this list yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="programs">
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <CustomSourceForm
                key={editingSource?.id ?? "new-source"}
                initialValue={editingSource}
                onSave={handleSaveSource}
                onCancel={editingSource ? () => setEditingSource(null) : undefined}
              />

              <Card className="card-soft border-border/60">
                <CardHeader>
                  <CardTitle className="text-2xl">Recurring programs</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {customSources.length ? (
                    customSources.map((source) => (
                      <div key={source.id} className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{source.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {[source.dayOfWeek, source.recurrenceText].filter(Boolean).join(" · ") || "Recurring details not set yet"}
                            </p>
                          </div>
                          <Badge variant={source.isActive ? "default" : "outline"} className="rounded-full">
                            {source.isActive ? "Active" : "Paused"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {[source.locationName, source.locationAddress].filter(Boolean).join(" · ") || "Location not set yet"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="touch-safe rounded-full"
                            onClick={() => setEditingSource(source)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="touch-safe rounded-full"
                            onClick={() =>
                              handleSaveSource({
                                ...source,
                                isActive: !source.isActive,
                              })
                            }
                          >
                            {source.isActive ? "Pause" : "Resume"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="touch-safe rounded-full text-destructive"
                            onClick={() => handleRemoveSource(source.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
                      Add recurring sources like KidsClub, swim lessons, library story time, or your weekly open gym. They will also appear at the top of the Events page.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
}
