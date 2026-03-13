"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown, { type Components } from "react-markdown";
import {
  AlertCircle,
  Bot,
  LoaderCircle,
  Send,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { createDemoProfile, type FamilyProfile } from "@/lib/schemas";
import { getHistory, getProfile } from "@/lib/storage";
import { quickQuestions } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMode = "server" | "profile" | "example" | "generic";

type MessagePart = UIMessage["parts"][number];
type ToolLikePart = Extract<MessagePart, { toolCallId: string }>;

interface ChatServerContext {
  authMode: "unavailable" | "anonymous" | "authenticated";
  userEmail: string | null;
  profile: FamilyProfile | null;
  warnings: string[];
  historyCount: number;
  savedEventCount: number;
  customSourceCount: number;
  upcomingEventCount: number;
  legacySavedItemCount: number;
}

const markdownComponents = {
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-primary underline decoration-primary/40 underline-offset-4"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);

    if (isBlock) {
      return (
        <code className={cn("block overflow-x-auto rounded-xl bg-muted px-3 py-2 font-mono text-xs", className)}>
          {children}
        </code>
      );
    }

    return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
  },
  pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-xl bg-muted p-3 text-xs last:mb-0">{children}</pre>,
} satisfies Components;

function formatContext(profile: FamilyProfile) {
  return `${profile.parentName}, ${profile.kids
    .map((child) => `${child.name || "kid"} (${child.age})`)
    .join(", ")} · ${
    profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")
  }`;
}

function getModeLabel(mode: ChatMode) {
  switch (mode) {
    case "server":
      return "Authenticated family context";
    case "profile":
      return "Your family context";
    case "example":
      return "Example family";
    case "generic":
      return "General help";
  }
}

function getWelcomeCopy(mode: ChatMode, authMode: ChatServerContext["authMode"]) {
  if (mode === "server") {
    return "Ask for a fast pivot, a backup plan, or a weather-aware next move. PlayDays is using your authenticated family context when it is available.";
  }

  if (mode === "profile") {
    return "Ask for a fast pivot, a low-energy backup, or a weather-safe next move. Your browser-saved family setup will shape the answer.";
  }

  if (mode === "example") {
    return "You are previewing the assistant with the example family. It is useful for tone and structure, not for your real household.";
  }

  return authMode === "authenticated"
    ? "Ask a general family-planning question now, or finish setup to unlock synced schedule, weather, and family-aware answers."
    : "Ask a general family-planning question now, or finish setup to unlock weather-aware and family-specific answers.";
}

function serializeToolValue(value: unknown) {
  if (value === undefined) {
    return null;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function isToolLikePart(part: MessagePart): part is ToolLikePart {
  return "toolCallId" in part;
}

function ToolCallCard({ part }: { part: ToolLikePart }) {
  const toolLabel = "toolName" in part ? part.toolName : part.type.replace(/^tool-/, "");
  const title = part.title || toolLabel.replace(/[-_]/g, " ");
  const input = serializeToolValue(part.input);
  const output = serializeToolValue("output" in part ? part.output : undefined);
  const approvalReason = part.approval?.reason;

  return (
    <div className="rounded-2xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-2 text-primary">
        <Wrench className="size-3.5" />
        <span className="font-semibold capitalize text-primary">{title}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {part.state}
        </span>
      </div>
      {input ? <pre className="mt-2 overflow-x-auto rounded-xl bg-background/80 p-3 text-[11px] text-foreground">{input}</pre> : null}
      {output ? <pre className="mt-2 overflow-x-auto rounded-xl bg-background/80 p-3 text-[11px] text-foreground">{output}</pre> : null}
      {part.errorText ? <p className="mt-2 text-destructive">{part.errorText}</p> : null}
      {approvalReason ? <p className="mt-2 text-muted-foreground">Reason: {approvalReason}</p> : null}
    </div>
  );
}

function renderMessagePart(messageId: string, part: MessagePart, role: UIMessage["role"], index: number) {
  if (part.type === "text") {
    if (role === "assistant") {
      return (
        <div key={`${messageId}-text-${index}`} className="text-sm leading-7 text-foreground">
          <ReactMarkdown components={markdownComponents}>{part.text}</ReactMarkdown>
        </div>
      );
    }

    return (
      <p key={`${messageId}-text-${index}`} className="whitespace-pre-wrap text-sm leading-7 text-foreground">
        {part.text}
      </p>
    );
  }

  if (part.type === "step-start") {
    return (
      <p
        key={`${messageId}-step-${index}`}
        className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
      >
        Working through the next step...
      </p>
    );
  }

  if (part.type === "reasoning") {
    return (
      <div
        key={`${messageId}-reasoning-${index}`}
        className="rounded-2xl border border-border bg-muted/40 px-3 py-2 text-xs leading-6 text-muted-foreground"
      >
        {part.text}
      </div>
    );
  }

  if (isToolLikePart(part)) {
    return <ToolCallCard key={`${messageId}-tool-${index}`} part={part} />;
  }

  if (part.type === "source-url") {
    return (
      <a
        key={`${messageId}-source-${index}`}
        href={part.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm font-medium text-primary underline underline-offset-4"
      >
        {part.title || part.url}
      </a>
    );
  }

  return null;
}

export function ChatAssistant({
  liveAssistantEnabled,
  serverContext,
}: {
  liveAssistantEnabled: boolean;
  serverContext: ChatServerContext;
}) {
  const [storedProfile] = useState<FamilyProfile | null>(() => getProfile());
  const [exampleProfile] = useState<FamilyProfile>(() => createDemoProfile());
  const [mode, setMode] = useState<ChatMode>(() => {
    if (serverContext.profile) {
      return "server";
    }

    return storedProfile ? "profile" : "generic";
  });
  const [input, setInput] = useState("");

  const activeProfile =
    mode === "server"
      ? serverContext.profile
      : mode === "profile"
        ? storedProfile
        : mode === "example"
          ? exampleProfile
          : null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          profile: mode === "server" ? null : activeProfile,
          history: mode === "profile" ? getHistory() : [],
        }),
      }),
    [activeProfile, mode],
  );

  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
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
  const showServerWarning = serverContext.authMode === "authenticated" && serverContext.warnings.length > 0;

  async function submit(text: string) {
    const value = text.trim();
    if (!value) {
      return;
    }

    setInput("");
    await sendMessage({ text: value });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(input);
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)]">
        <Card className="card-soft overflow-hidden border-border/60">
          <div className="border-b border-border/60 px-5 py-5 sm:px-6">
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">{introBadge}</Badge>
            <div className="mt-3 space-y-2">
              <h1 className="text-3xl text-balance text-foreground">PlayDays chat</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{introBody}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4 sm:p-6">
            <div className="rounded-[1.75rem] border border-border/60 bg-muted/30 p-3 sm:p-4">
              <div className="grid max-h-[38rem] gap-3 overflow-y-auto pr-1">
                {!hasMessages ? (
                  <div className="rounded-[1.5rem] border border-dashed border-border bg-card/90 p-5">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Sparkles className="size-4" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">{introTitle}</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {getWelcomeCopy(mode, serverContext.authMode)}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                            {getModeLabel(mode)}
                          </span>
                          {activeProfile ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                              {formatContext(activeProfile)}
                            </span>
                          ) : null}
                          {!liveAssistantEnabled ? (
                            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                              Fallback answer mode
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[92%] rounded-[1.5rem] border px-4 py-3 shadow-sm",
                      message.role === "user"
                        ? "ml-auto border-primary/40 bg-primary/10"
                        : "border-border bg-card/90",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {message.role === "assistant" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                      <span>{message.role}</span>
                    </div>
                    <div className="space-y-3">
                      {message.parts.map((part, index) => renderMessagePart(message.id, part, message.role, index))}
                    </div>
                  </div>
                ))}

                {busy ? (
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-sm text-muted-foreground shadow-sm">
                    <LoaderCircle className="size-4 animate-spin text-primary" />
                    Thinking through the best next move...
                  </div>
                ) : null}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-4 shadow-sm">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={4}
                  placeholder="We have 45 minutes, low energy, and need one good next move."
                  className="min-h-28 rounded-[1.3rem] border-border/60 bg-background/80"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  {error ? (
                    <p className="text-sm text-destructive">{error.message}</p>
                  ) : (
                    <span className="text-sm text-muted-foreground">{helperText}</span>
                  )}
                  <Button type="submit" className="touch-safe rounded-2xl px-5" disabled={busy || input.trim().length === 0}>
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                    Send
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <Badge className="w-fit rounded-full bg-primary/10 text-primary">{getModeLabel(mode)}</Badge>
              <CardTitle className="text-4xl text-balance text-foreground">{introTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
              <p>{introBody}</p>

              {showServerWarning ? (
                <div className="rounded-[1.4rem] border border-amber-300/70 bg-amber-50/80 p-4 text-amber-950">
                  <p className="flex items-center gap-2 font-medium text-amber-950">
                    <AlertCircle className="size-4" />
                    Signed in, but PlayDays could not load the full synced context cleanly.
                  </p>
                  <p className="mt-2 text-sm leading-6 text-amber-900">{serverContext.warnings[0]}</p>
                </div>
              ) : null}

              {mode === "server" && activeProfile ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-card/90 p-4">
                  <p className="font-medium text-foreground">Using your synced family setup</p>
                  <p className="mt-2">{formatContext(activeProfile)}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {serverContext.historyCount} recent actions, {serverContext.savedEventCount} saved events, {" "}
                    {serverContext.customSourceCount} custom sources, {serverContext.upcomingEventCount} upcoming area
                    events
                    {serverContext.legacySavedItemCount
                      ? `, and ${serverContext.legacySavedItemCount} legacy saved items`
                      : ""}.
                  </p>
                </div>
              ) : null}

              {mode === "profile" && activeProfile ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-card/90 p-4">
                  <p className="font-medium text-foreground">Using this browser-saved family setup</p>
                  <p className="mt-2">{formatContext(activeProfile)}</p>
                </div>
              ) : null}

              {mode === "example" && activeProfile ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-card/90 p-4">
                  <p className="font-medium text-foreground">Using the example family</p>
                  <p className="mt-2">{formatContext(activeProfile)}</p>
                </div>
              ) : null}

              {mode === "generic" ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-card/90 p-4">
                  <p className="font-medium text-foreground">
                    {serverContext.authMode === "authenticated"
                      ? "No synced family profile yet"
                      : "No saved family context yet"}
                  </p>
                  <p className="mt-2">
                    {serverContext.authMode === "authenticated"
                      ? "You can still ask a general question now, or finish setup to sync your kids, location, schedule, and weather into chat."
                      : "You can still ask a general question now, or finish setup for answers that use your kids, location, schedule, and weather."}
                  </p>
                </div>
              ) : null}

              {!hasMessages ? (
                <div className="space-y-3 rounded-[1.4rem] border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Choose your chat context</p>
                  <div className="flex flex-col gap-3">
                    {mode !== "server" && serverContext.profile ? (
                      <Button type="button" variant="outline" className="touch-safe justify-start rounded-2xl" onClick={() => setMode("server")}>
                        Use synced setup
                      </Button>
                    ) : null}
                    {mode !== "profile" && storedProfile ? (
                      <Button type="button" variant="outline" className="touch-safe justify-start rounded-2xl" onClick={() => setMode("profile")}>
                        Use browser-saved setup
                      </Button>
                    ) : null}
                    {mode !== "example" ? (
                      <Button type="button" variant="outline" className="touch-safe justify-start rounded-2xl" onClick={() => setMode("example")}>
                        <Sparkles className="size-4" />
                        Use example family
                      </Button>
                    ) : null}
                    {mode !== "generic" ? (
                      <Button type="button" variant="outline" className="touch-safe justify-start rounded-2xl" onClick={() => setMode("generic")}>
                        Back to general chat
                      </Button>
                    ) : null}
                    {mode === "generic" ? (
                      <Button asChild className="touch-safe rounded-2xl px-5">
                        <Link href="/start-setup">
                          {serverContext.authMode === "authenticated" ? "Save synced setup" : "Finish setup"}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {serverContext.userEmail && mode === "server" ? (
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Signed in as {serverContext.userEmail}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">Quick starts</CardTitle>
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
