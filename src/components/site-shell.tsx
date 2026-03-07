"use client";

import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { appNav, marketingNav } from "@/lib/site";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function NavButton({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Button asChild variant={active ? "default" : "ghost"} className="touch-safe rounded-full px-4 text-sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-24 sm:pb-10">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="page-shell flex items-center justify-between gap-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">PlayDays</p>
              <p className="font-semibold text-foreground">A calmer plan for today</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {marketingNav.map((item) => (
              <NavButton key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
            ))}
            <Button asChild className="touch-safe rounded-full px-5">
              <Link href="/today">Open today</Link>
            </Button>
          </nav>

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" className="touch-safe rounded-full">
                <Menu className="size-4" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="max-w-xs border-l border-border/80 bg-background/95">
              <SheetHeader>
                <SheetTitle>PlayDays</SheetTitle>
                <SheetDescription>Jump to the screen you need with one thumb.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-2 px-4 pb-6">
                {[...marketingNav, ...appNav.filter((item) => !marketingNav.some((link) => link.href === item.href))].map((item) => (
                  <NavButton key={item.href} href={item.href} label={item.label} active={pathname === item.href} />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>{children}</main>

      <footer className="page-shell border-t border-border/60 py-8 text-sm text-muted-foreground">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">PlayDays</p>
            <p>Weather-smart activity ideas, local discovery, and gentle planning support for parents.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {appNav.map((item) => (
              <Button key={item.href} asChild variant="ghost" className="rounded-full px-4 text-sm text-muted-foreground">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-2">
          {appNav.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={pathname === item.href ? "default" : "ghost"}
              className={cn("touch-safe rounded-2xl px-1 text-xs", pathname === item.href ? "shadow-lg shadow-primary/15" : "")}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
}
