"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Bot, LoaderCircle, Send, Sparkles } from "lucide-react";
import { createDemoProfile, type FamilyProfile } from "@/lib/schemas";
import { getHistory, getProfile } from "@/lib/storage";
import { quickQuestions } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMode = "profile" | "example" | "generic";

function formatContext(profile: FamilyProfile) {
  return `${profile.parentName}, ${profile.kids
    .map((child) => `${child.name || "kid"} (${child.age})`)
    .join(", ")} · ${
    profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")
  }`;
}

export function ChatAssistant({ liveAssistantEnabled }: { liveAssistantEnabled: boolean }) {
  const [storedProfile] = useState<FamilyProfile | null>(() => getProfile());
  const [exampleProfile] = useState<FamilyProfile>(() => createDemoProfile());
  const [mode, setMode] = useState<ChatMode>(() => (storedProfile ? "profile" : "generic"));
  const [input, setInput] = useState("");

  const activeProfile =
    mode === "profile" ? storedProfile : mode === "example" ? exampleProfile : null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          profile: activeProfile,
          history: mode === "profile" ? getHistory() : [],
        }),
      }),
    [activeProfile, mode],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  async function submit(text: string) {
    const value = text.trim();
    if (!value) {
      return;
    }

    setInput("");
    await sendMessage({ text: value });
  }

  const introBadge = liveAssistantEnabled ? "AI assistant" : "Quick backup mode";
  const introTitle = liveAssistantEnabled
    ? "Ask for the next move when the day goes sideways."
    : "Quick family backup guidance, even while live AI is offline.";
  const introBody = liveAssistantEnabled
    ? "PlayDays can answer with live AI when it is enabled, and it falls back to practical backup guidance when it is not."
    : "Live AI is unavailable right now, so PlayDays will answer with a lighter backup plan built from your setup when possible.";
  const helperText = liveAssistantEnabled
    ? "One or two lines is enough."
    : "One or two lines is enough. PlayDays will answer in quick backup mode.";

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">{introBadge}</Badge>
            <CardTitle className="text-3xl text-balance">PlayDays chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-h-[34rem] gap-3 overflow-y-auto rounded-[1.5rem] border border-border/60 bg-white/75 p-4">
              {messages.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/70 p-4 text-sm leading-7 text-muted-foreground">
                  {mode === "profile"
                    ? "Ask for a fast pivot, a low-energy backup, or a weather-safe next move. Your saved family setup will shape the answer."
                    : mode === "example"
                      ? "You are chatting with the example family context. It is useful for previewing tone and structure, not for your real household."
                      : "Ask a general family-planning question now, or finish setup to unlock weather-aware and family-specific answers."}
                </div>
              ) : null}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[92%] rounded-[1.5rem] border px-4 py-3 ${
                    message.role === "user"
                      ? "ml-auto border-primary/20 bg-primary/10"
                      : "border-border/60 bg-white/85"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {message.role === "assistant" ? <Bot className="size-3.5" /> : null}
                    <span>{message.role}</span>
                  </div>
                  <div className="space-y-3 text-sm leading-7 text-foreground">
                    {message.parts?.map((part, index) =>
                      part.type === "text" ? <p key={`${message.id}-${index}`}>{part.text}</p> : null,
                    )}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-white/80 px-4 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                  Thinking through the best next move...
                </div>
              ) : null}
            </div>
            <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-white/75 p-4">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={4}
                placeholder="We have 45 minutes, low energy, and need one good next move."
                className="rounded-[1.3rem]"
              />
              <div className="flex items-center justify-between gap-3">
                {error ? (
                  <p className="text-sm text-destructive">{error.message}</p>
                ) : (
                  <span className="text-sm text-muted-foreground">{helperText}</span>
                )}
                <Button
                  className="touch-safe rounded-2xl px-5"
                  disabled={busy || input.trim().length === 0}
                  onClick={() => void submit(input)}
                >
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <Badge className="w-fit rounded-full bg-primary/10 text-primary">
                {mode === "profile"
                  ? "Your family context"
                  : mode === "example"
                    ? "Example family"
                    : "General help"}
              </Badge>
              <CardTitle className="text-4xl text-balance">{introTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>{introBody}</p>
              {mode === "profile" && activeProfile ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
                  <p className="font-medium text-foreground">Using your saved family setup</p>
                  <p className="mt-2">{formatContext(activeProfile)}</p>
                </div>
              ) : null}
              {mode === "example" && activeProfile ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
                  <p className="font-medium text-foreground">Using the example family</p>
                  <p className="mt-2">{formatContext(activeProfile)}</p>
                </div>
              ) : null}
              {mode === "generic" ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-white/75 p-4">
                  <p className="font-medium text-foreground">No saved family context yet</p>
                  <p className="mt-2">
                    You can still ask a general question now, or finish setup for answers that use your kids,
                    location, schedule, and weather.
                  </p>
                </div>
              ) : null}
              {messages.length === 0 && mode === "generic" ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="touch-safe rounded-2xl px-5">
                    <Link href="/start-setup">Finish setup</Link>
                  </Button>
                  <Button variant="outline" className="touch-safe rounded-2xl" onClick={() => setMode("example")}>
                    <Sparkles className="size-4" />
                    Use example family
                  </Button>
                </div>
              ) : null}
              {messages.length === 0 && mode === "example" ? (
                <Button variant="outline" className="touch-safe rounded-2xl" onClick={() => setMode("generic")}>
                  Back to general chat
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">Quick starts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {quickQuestions.map((question) => (
                <Button
                  key={question}
                  type="button"
                  variant="outline"
                  className="touch-safe h-auto justify-start rounded-2xl px-4 py-3 text-left"
                  onClick={() => void submit(question)}
                >
                  {question}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
