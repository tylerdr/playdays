"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Mail } from "lucide-react";
import { createClientSupabaseClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getRedirectUrl(next: string | null) {
  const redirectUrl = new URL("/auth/callback", window.location.origin);
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirectUrl.searchParams.set("next", next);
  }
  return redirectUrl.toString();
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const supabase = createClientSupabaseClient();
    if (!supabase) {
      setError("Supabase auth is not configured in this environment.");
      return;
    }

    setBusy(true);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: getRedirectUrl(next),
      },
    });

    setBusy(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage(`Magic link sent to ${email.trim()}.`);
    const verifyParams = new URLSearchParams();
    verifyParams.set("email", email.trim());
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      verifyParams.set("next", next);
    }
    router.push(`/auth/verify?${verifyParams.toString()}`);
  }

  return (
    <>
      {hasSupabaseEnv() ? (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="touch-safe rounded-2xl"
            />
          </div>
          <Button
            type="submit"
            className="touch-safe w-full rounded-2xl"
            disabled={busy || email.trim().length === 0}
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send magic link
          </Button>
        </form>
      ) : (
        <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-5 text-sm leading-7 text-muted-foreground">
          Supabase auth is not configured here, so sign-in is unavailable. The local setup and demo flow still work.
        </div>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline" className="touch-safe rounded-2xl">
          <Link href="/start-setup">Use local setup instead</Link>
        </Button>
        <Button asChild variant="ghost" className="touch-safe rounded-2xl">
          <Link href="/today">See demo day</Link>
        </Button>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <SiteShell variant="setup">
      <div className="page-shell py-10 sm:py-14">
        <Card className="card-soft mx-auto max-w-2xl border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">
              Magic-link sign in
            </Badge>
            <CardTitle className="text-4xl text-balance">Use your email to open PlayDays.</CardTitle>
            <CardDescription className="text-base leading-7">
              We send one sign-in link. No password to remember, and new families land in setup right after verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-muted/40" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </SiteShell>
  );
}
