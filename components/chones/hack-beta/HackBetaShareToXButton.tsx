"use client";

import { Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildHackBetaTweetIntentUrl } from "@/lib/chones/social";
import { cn } from "@/lib/utils";

type HackBetaShareToXButtonProps = {
  title?: string | null;
  pageUrl?: string;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
};

export function HackBetaShareToXButton({
  title,
  pageUrl,
  className,
  variant = "outline",
  size = "sm",
  label = "Share on X",
}: HackBetaShareToXButtonProps) {
  const handleShare = () => {
    const url =
      pageUrl ??
      (typeof window !== "undefined" ? window.location.href : "https://tv.creativeplatform.xyz/chones/hack-beta");
    window.open(
      buildHackBetaTweetIntentUrl({ title, pageUrl: url }),
      "_blank",
      "width=550,height=420",
    );
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleShare}
      className={cn("gap-2", className)}
    >
      <Twitter className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  );
}
