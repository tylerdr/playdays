"use client";

import { useMemo, useState } from "react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { Bot, LoaderCircle, Send } from "lucide-react";
import { createDemoProfile, type FamilyProfile } from "@/lib/schemas";
import { getHistory, getProfile } from "@/lib/storage";
import { quickQuestions } from "@/lib/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function ChatAssistant() {
  const [profile] = useState<FamilyProfile>(() => getProfile() ?? createDemoProfile());
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          profile: profile ?? createDemoProfile(),
          history: getHistory(),
        }),
      }),
    [profile],
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

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">AI assistant</Badge>
            <CardTitle className="text-4xl text-balance">Ask for the next move when the day goes sideways.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              The chat knows your kids, location, weather, and recent activity patterns. It is built for quick, practical answers rather than essay mode.
            </p>
            <div className="grid gap-2">
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
            </div>
            {profile ? (
              <p className="rounded-[1.4rem] border border-border/60 bg-white/70 px-4 py-3">
                Chat context: {profile.parentName}, {profile.kids.map((child) => `${child.name || "kid"} (${child.age})`).join(", ")} · {profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="card-soft border-border/60">
          <CardHeader>
            <CardTitle className="text-2xl">PlayDays chat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid max-h-[34rem] gap-3 overflow-y-auto rounded-[1.5rem] border border-border/60 bg-white/75 p-4">
              {messages.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-background/70 p-4 text-sm text-muted-foreground">
                  Ask for help with meltdowns, weather pivots, dinosaur obsessions, nap-trap mode, or local plans for the weekend.
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
                  Thinking through todays best move...
                </div>
              ) : null}
            </div>
            <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-white/75 p-4">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={4}
                placeholder="I am solo with both kids, one is melting down, and we can only leave the house for an hour. What should we do?"
                className="rounded-[1.3rem]"
              />
              <div className="flex items-center justify-between gap-3">
                {error ? <p className="text-sm text-destructive">{error.message}</p> : <span className="text-sm text-muted-foreground">Short prompts work great here.</span>}
                <Button className="touch-safe rounded-2xl px-5" disabled={busy || input.trim().length === 0} onClick={() => void submit(input)}>
                  {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
