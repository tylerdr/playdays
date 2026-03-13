import Link from "next/link";
import { MailCheck } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <SiteShell variant="setup">
      <div className="page-shell py-10 sm:py-14">
        <Card className="card-soft mx-auto max-w-2xl border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">
              Check your inbox
            </Badge>
            <CardTitle className="text-4xl text-balance">
              Open the magic link to finish signing in.
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-[1.5rem] border border-border/60 bg-white/80 p-5 text-sm leading-7 text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <MailCheck className="size-4 text-primary" />
                Email sent
              </p>
              <p className="mt-2">
                {params.email
                  ? `We sent a sign-in link to ${params.email}.`
                  : "We sent a sign-in link to your email address."}{" "}
                After you open it, PlayDays will send you to setup if this is a new account.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="touch-safe rounded-2xl">
                <Link
                  href={
                    params.next
                      ? `/auth/login?next=${encodeURIComponent(params.next)}`
                      : "/auth/login"
                  }
                >
                  Resend link
                </Link>
              </Button>
              <Button asChild variant="outline" className="touch-safe rounded-2xl">
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </SiteShell>
  );
}
