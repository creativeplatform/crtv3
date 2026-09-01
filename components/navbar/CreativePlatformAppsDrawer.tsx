"use client";

import Link from "next/link";
import {
  LayoutGrid,
  Newspaper,
  Tv,
  Bot,
  Landmark,
  Disc3,
  Gamepad2,
  Mic,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils/utils";
import { navIconButtonProps } from "@/components/navbar/navButtonStyles";

const CREATIVE_PLATFORM_APPS = [
  {
    name: "News",
    href: "https://news.creativeplatform.xyz",
    icon: Newspaper,
    description: "Stories and updates from the platform",
  },
  {
    name: "TV",
    href: "https://tv.creativeplatform.xyz",
    icon: Tv,
    description: "Watch and discover video content",
    isCurrent: true,
  },
  {
    name: "Pixels",
    href: "https://create.creativeplatform.xyz",
    icon: Bot,
    description: "Create with AI-powered tools",
  },
  {
    name: "Finance",
    href: "https://finance.creativeplatform.xyz",
    icon: Landmark,
    description: "Manage your creative finances",
  },
  {
    name: "Mixtape",
    href: "https://air.creativeplatform.xyz/app",
    icon: Disc3,
    description: "Curate and share music mixes",
  },
  {
    name: "Beat Me",
    href: "https://beatme.creativeplatform.xyz",
    icon: Gamepad2,
    description: "Compete in rhythm challenges",
  },
  {
    name: "Podcast",
    href: "https://open.spotify.com/show/4zAsBnJwZKquxvI7oPqRam?si=ZCEjVk6VQ4ClhyCsabtn8A",
    icon: Mic,
    description: "Listen on Spotify",
  },
] as const;

export function CreativePlatformAppsDrawer() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          {...navIconButtonProps}
          id="creative-platform-apps-btn"
        >
          <LayoutGrid className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Browse Creative Platform apps</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader className="text-left">
          <SheetTitle>Creative Platform</SheetTitle>
          <SheetDescription>
            Explore apps across the Creative Platform ecosystem.
          </SheetDescription>
        </SheetHeader>
        <nav className="mt-6 grid gap-2" aria-label="Creative Platform apps">
          {CREATIVE_PLATFORM_APPS.map((app) => {
            const Icon = app.icon;
            const isExternal = app.href.startsWith("http");
            const isCurrent = "isCurrent" in app && app.isCurrent;

            return (
              <Link
                key={app.name}
                href={app.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border border-transparent p-3",
                  "transition-colors hover:border-gray-200 hover:bg-gray-50",
                  "dark:hover:border-gray-700 dark:hover:bg-gray-800/50",
                  isCurrent &&
                    "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",
                    "group-hover:bg-white dark:group-hover:bg-gray-900"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{app.name}</span>
                    {isCurrent && (
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-500">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {app.description}
                  </span>
                </span>
                {isExternal && (
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
