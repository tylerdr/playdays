import Link from "next/link";
import { MapPin, Mail, Sparkles, Wind } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slotMeta } from "@/lib/site";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

const highlights = [
  {
    icon: Sparkles,
    title: "Five-card daily plan",
    body: "Outdoor, indoor, adventure, calm, and together-time ideas tuned to your actual family rhythm.",
  },
  {
    icon: Wind,
    title: "Weather-smart",
    body: "Weather shapes the outdoor idea and backup guidance so the day fits the forecast instead of fighting it.",
  },
  {
    icon: MapPin,
    title: "Local discovery",
    body: "Pull nearby outings into the same planning flow, with honest fallback guidance when live listings are thin.",
  },
  {
    icon: Mail,
    title: "Morning reset",
    body: "Keep the daily plan in one calm place instead of opening six tabs before breakfast.",
  },
];

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const authEnabled = hasSupabaseServerEnv();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  const primaryHref = user
    ? "/today"
    : authEnabled
      ? "/auth/login?next=%2Fstart-setup"
      : "/start-setup";
  const primaryLabel = user
    ? "Open today"
    : authEnabled
      ? "Sign in to start"
      : "Set up my family";
  const secondaryHref = user ? "/history" : "/today";
  const secondaryLabel = user ? "Open history" : "See demo day";

  return (
    <SiteShell variant="marketing">
      <section className="page-shell relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="grid-fade absolute inset-0 opacity-40" />
        <div className="hero-wash relative grid gap-8 rounded-[2.4rem] border border-border/60 px-5 py-8 shadow-2xl shadow-primary/5 sm:px-8 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <div className="space-y-6">
            <Badge className="rounded-full bg-primary text-primary-foreground">Daily Family Activity Planner</Badge>
            <h1 className="text-balance text-5xl leading-[0.96] sm:text-6xl lg:text-7xl">
              The home-screen app that answers, &quot;What are we doing today?&quot;
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              PlayDays gives parents one practical plan each morning: five activity cards, honest outing help, nap-trap backups, and quick guidance when the day swerves.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="touch-safe rounded-full px-7">
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="touch-safe rounded-full px-7">
                <Link href={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card className="card-soft border-border/60">
                <CardContent className="p-5">
                  <p className="text-3xl font-semibold text-foreground">5</p>
                  <p className="mt-1 text-sm text-muted-foreground">cards every day</p>
                </CardContent>
              </Card>
              <Card className="card-soft border-border/60">
                <CardContent className="p-5">
                  <p className="text-3xl font-semibold text-foreground">1</p>
                  <p className="mt-1 text-sm text-muted-foreground">fast plan before 9am</p>
                </CardContent>
              </Card>
              <Card className="card-soft border-border/60">
                <CardContent className="p-5">
                  <p className="text-3xl font-semibold text-foreground">0</p>
                  <p className="mt-1 text-sm text-muted-foreground">tab overload required</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="card-soft overflow-hidden border-border/60">
            <CardHeader>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Today preview</p>
              <CardTitle className="text-3xl">A plan that feels warm and realistic, not robotic</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {Object.entries(slotMeta).map(([slot, meta]) => (
                <div key={slot} className={`rounded-[1.5rem] border border-border/60 bg-gradient-to-r ${meta.accentClass} p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{meta.label}</p>
                      <p className="mt-1 font-semibold text-foreground">{meta.emoji} {slot === "adventure" ? "Mini museum outing" : slot === "calm" ? "Pillow nest reset" : slot === "together" ? "Muffin helper hour" : slot === "outdoor" ? "Backyard treasure trail" : "Countertop makers lab"}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full bg-white/85">{slot === "adventure" ? "1 hr" : "20-30 min"}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell py-8 sm:py-10">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {highlights.map((highlight) => (
            <Card key={highlight.title} className="card-soft border-border/60">
              <CardHeader>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <highlight.icon className="size-5" />
                </div>
                <CardTitle className="text-2xl">{highlight.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted-foreground">{highlight.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell py-8 sm:py-10">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Built for real parent constraints</p>
              <CardTitle className="text-4xl">One-handed, weather-aware, and good under chaos.</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {[
                "Nap-trap mode for carrier naps, sleeping babies, and low-mobility moments.",
                "Done, save, and skip signals stay on this device so you can remember what actually worked.",
                "Local parks, libraries, museums, splash pads, farms, and indoor backups in one place.",
                "Quick backup guidance in chat, with live AI answers when that assistant is available.",
              ].map((item) => (
                <div key={item} className="rounded-[1.5rem] border border-border/60 bg-white/80 p-4 text-sm leading-7 text-muted-foreground">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="card-soft border-border/60">
            <CardHeader>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">What you can use today</p>
              <CardTitle className="text-4xl">A calmer plan first. Honest fallbacks second.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                PlayDays is strongest when it helps you choose one good next move fast. When live services are unavailable, it should still stay useful without pretending that a stub is a verified answer.
              </p>
              <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-4">
                <p className="font-medium text-foreground">Right now, that means</p>
                <p className="mt-2">
                  family setup, a five-card daily plan, saved history on this device, pinned outings from Discover, and chat that falls back to quick guidance when live AI is unavailable.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="page-shell py-8 sm:py-10">
        <div className="rounded-[2rem] border border-border/60 bg-white/75 p-6 shadow-xl shadow-primary/5 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">FAQ</p>
              <h2 className="mt-2 text-4xl">What parents usually need answered first</h2>
            </div>
            <Button asChild variant="outline" className="touch-safe rounded-full px-6">
              <Link href="/chat">Try chat</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4">
            {[
              ["Will weather actually change the plan?", "Yes. The forecast shapes the outdoor idea, pacing, and backup guidance for the day."],
              ["What happens if local places are thin?", "PlayDays shows specific nearby places when it can and switches to map-ready backup searches when it cannot."],
              ["What if live AI is unavailable?", "Chat still replies with quick backup guidance instead of dead-ending, and the rest of the app keeps working."],
              ["Do I need a big setup before it helps?", "No. Setup is meant to take about two minutes, just enough to build your first useful day."],
            ].map(([question, answer]) => (
              <Card key={question} className="card-soft border-border/60">
                <CardHeader>
                  <CardTitle className="text-2xl">{question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-7 text-muted-foreground">{answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
