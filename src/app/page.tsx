import Link from "next/link";
import { MapPin, Mail, Sparkles, Wind } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { slotMeta } from "@/lib/site";

const highlights = [
  {
    icon: Sparkles,
    title: "Five-card daily plan",
    body: "Outdoor, indoor, adventure, calm, and together-time ideas tuned to your actual family rhythm.",
  },
  {
    icon: Wind,
    title: "Weather-smart",
    body: "Open-Meteo steers the plan so the outside idea matches the day instead of ignoring it.",
  },
  {
    icon: MapPin,
    title: "Local discovery",
    body: "Pull parks, libraries, museums, and kid-friendly spots into the same planning flow.",
  },
  {
    icon: Mail,
    title: "Morning digest",
    body: "Ship the day by email before 7am so the plan is waiting before the chaos starts.",
  },
];

export default function HomePage() {
  return (
    <SiteShell>
      <section className="page-shell relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <div className="grid-fade absolute inset-0 opacity-40" />
        <div className="hero-wash relative grid gap-8 rounded-[2.4rem] border border-border/60 px-5 py-8 shadow-2xl shadow-primary/5 sm:px-8 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
          <div className="space-y-6">
            <Badge className="rounded-full bg-primary text-primary-foreground">Daily Family Activity Planner</Badge>
            <h1 className="text-balance text-5xl leading-[0.96] sm:text-6xl lg:text-7xl">
              The home-screen app that answers, &quot;What are we doing today?&quot;
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              PlayDays gives parents one practical plan each morning: five activity cards, local outing ideas, nap-trap mode, and a chat assistant that knows your kids.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="touch-safe rounded-full px-7">
                <Link href="/onboard">Set up my family</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="touch-safe rounded-full px-7">
                <Link href="/today">Preview today</Link>
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
                "Skips, saves, and done-it signals so the plan gets sharper over time.",
                "Local parks, libraries, museums, splash pads, farms, and indoor play options.",
                "Daily digest route ready for Vercel cron or manual trigger.",
              ].map((item) => (
                <div key={item} className="rounded-[1.5rem] border border-border/60 bg-white/80 p-4 text-sm leading-7 text-muted-foreground">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="card-soft border-border/60">
            <CardHeader>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">MVP pricing</p>
              <CardTitle className="text-4xl">Free while the first family shapes it.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>
                MVP is free. The premium direction later is simple: full daily plan, unlimited chat, local event depth, and daily email digest for $6.99/mo.
              </p>
              <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-4">
                <p className="font-medium text-foreground">What is ready right now</p>
                <p className="mt-2">Onboarding, daily plan generation, local discovery, personalized chat, history tracking, settings, PWA manifest, and digest endpoint.</p>
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
              <Link href="/chat">Try the AI assistant</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-4">
            {[
              ["Does it use real AI?", "Yes. Daily generation and chat are wired to real OpenAI calls when your API key is present."],
              ["Will weather actually change the plan?", "Yes. Open-Meteo informs the outdoor card, timing guidance, and the tone of the day."],
              ["What if local places are not available?", "PlayDays uses Google Places when configured, then falls back to AI-generated local ideas."],
              ["Can I install it on my phone?", "Yes. The app includes a manifest and installable PWA setup for home-screen use."],
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
