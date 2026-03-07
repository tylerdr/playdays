"use client";

import { CheckCircle2, CornerDownRight, RefreshCcw, Save } from "lucide-react";
import { slotMeta } from "@/lib/site";
import type { ActivityCard as ActivityCardType } from "@/lib/schemas";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityCardProps {
  activity: ActivityCardType;
  busy?: boolean;
  onDone: () => void;
  onSkip: () => void;
  onSave: () => void;
}

export function ActivityCard({ activity, busy, onDone, onSkip, onSave }: ActivityCardProps) {
  const meta = slotMeta[activity.slot];

  return (
    <Card className={`card-soft overflow-hidden border-border/60 bg-gradient-to-br ${meta.accentClass}`}>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className={`rounded-full ${meta.pillClass}`}>{meta.label}</Badge>
            <CardTitle className="text-3xl text-balance">
              {activity.emoji} {activity.name}
            </CardTitle>
          </div>
          <Badge variant="outline" className="rounded-full bg-white/85 text-foreground">
            {activity.duration}
          </Badge>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">{activity.summary}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="rounded-full bg-white/80">Ages {activity.ageRange}</Badge>
          <Badge variant="outline" className="rounded-full bg-white/80">Best {activity.bestTime}</Badge>
          {activity.materials.slice(0, 3).map((material) => (
            <Badge key={material} variant="outline" className="rounded-full bg-white/70">
              {material}
            </Badge>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Developmental benefits</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {activity.benefits.map((benefit) => (
              <Badge key={benefit} className="rounded-full bg-secondary text-secondary-foreground">
                {benefit}
              </Badge>
            ))}
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
          <p className="font-medium text-foreground">Why it fits today</p>
          <p>{activity.whyItFits}</p>
        </div>
        <Accordion type="single" collapsible>
          <AccordionItem value={activity.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 px-4">
            <AccordionTrigger className="touch-safe text-left font-medium text-foreground">
              Step-by-step instructions
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-3 pb-2 text-sm leading-7 text-muted-foreground">
                {activity.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              {activity.backupPlan ? (
                <div className="mt-3 flex gap-3 rounded-2xl border border-dashed border-border/80 bg-background/80 px-3 py-3 text-sm text-muted-foreground">
                  <CornerDownRight className="mt-0.5 size-4 text-primary" />
                  <span>{activity.backupPlan}</span>
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
      <CardFooter className="grid gap-3 border-t border-border/50 pt-6 sm:grid-cols-3">
        <Button className="touch-safe rounded-2xl" disabled={busy} onClick={onDone}>
          <CheckCircle2 className="size-4" />
          Done it
        </Button>
        <Button variant="outline" className="touch-safe rounded-2xl" disabled={busy} onClick={onSkip}>
          <RefreshCcw className="size-4" />
          Skip / new one
        </Button>
        <Button variant="secondary" className="touch-safe rounded-2xl" disabled={busy} onClick={onSave}>
          <Save className="size-4" />
          Save for later
        </Button>
      </CardFooter>
    </Card>
  );
}
