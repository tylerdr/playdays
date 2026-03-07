"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { getHistory, getSavedItems } from "@/lib/storage";
import type { HistoryEntry, SavedItem } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function HistoryBoard() {
  const [history] = useState<HistoryEntry[]>(() => getHistory());
  const [saved] = useState<SavedItem[]>(() => getSavedItems());

  const summary = useMemo(() => {
    const thisMonthKey = format(new Date(), "yyyy-MM");
    const monthEntries = history.filter((entry) => entry.dateKey.startsWith(thisMonthKey));
    const doneEntries = monthEntries.filter((entry) => entry.action === "done");
    const slotCounts = doneEntries.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.slot] = (accumulator[entry.slot] ?? 0) + 1;
      return accumulator;
    }, {});
    const favoriteSlot = Object.entries(slotCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none yet";

    return {
      monthDone: doneEntries.length,
      monthSkipped: monthEntries.filter((entry) => entry.action === "skip").length,
      favoriteSlot,
    };
  }, [history]);

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">Preference learning</Badge>
            <CardTitle className="text-4xl text-balance">The app gets sharper as you use it.</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
              <p className="text-sm text-muted-foreground">This month done</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">{summary.monthDone}</p>
            </div>
            <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
              <p className="text-sm text-muted-foreground">This month skipped</p>
              <p className="mt-2 text-4xl font-semibold text-foreground">{summary.monthSkipped}</p>
            </div>
            <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
              <p className="text-sm text-muted-foreground">Top category</p>
              <p className="mt-2 text-2xl font-semibold capitalize text-foreground">{summary.favoriteSlot}</p>
            </div>
            <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-5 text-sm leading-7 text-muted-foreground sm:col-span-3">
              This month you did {summary.monthDone} activities. Top category: {summary.favoriteSlot}. The next quality jump comes from tapping Done it and Skip honestly so the model can learn your real rhythm.
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">Saved for later</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {saved.length ? (
              saved.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <Badge variant="outline" className="rounded-full">{item.type}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Saved ideas and places will show up here once you start bookmarking them.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">Recent activity log</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {history.length ? (
              history.slice(0, 20).map((entry) => (
                <div key={entry.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{entry.title}</p>
                      <p className="text-sm capitalize text-muted-foreground">{entry.slot} · {entry.action}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">{new Date(entry.timestamp).toLocaleString()}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Start marking activities done, skipped, or saved and the history will stack up here.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
