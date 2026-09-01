"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MembershipVerifiedBadge } from "@/components/User/MembershipVerifiedBadge";
import { useMeTokenByOwner } from "@/lib/hooks/metokens/useMeTokenByOwner";
import { useCreatorProfile } from "@/lib/hooks/metokens/useCreatorProfile";
import { formatAddress } from "@/lib/helpers";
import { shortenAddress } from "@/lib/utils/utils";
import { convertFailingGateway } from "@/lib/utils/image-gateway";
import makeBlockie from "ethereum-blockies-base64";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface UserDisplayProps {
  address: string;
  /**
   * Size of the avatar
   */
  avatarSize?: "sm" | "md" | "lg";
  /**
   * Whether to show the address as a fallback
   */
  showAddress?: boolean;
  /**
   * Whether to make the display clickable (links to profile)
   */
  clickable?: boolean;
  /**
   * Custom className
   */
  className?: string;
  /**
   * Variant: "inline" shows avatar and name inline, "vertical" shows them stacked
   */
  variant?: "inline" | "vertical";
}

const avatarSizes = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const textSizes = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export function UserDisplay({
  address,
  avatarSize = "md",
  showAddress = true,
  clickable = true,
  className,
  variant = "inline",
}: UserDisplayProps) {
  const { meToken } = useMeTokenByOwner(address);
  const { profile } = useCreatorProfile(address);

  // Determine what to display
  const displayName = profile?.username || meToken?.name || null;
  const displaySymbol = meToken?.symbol || null;
  const avatarUrl = profile?.avatar_url
    ? convertFailingGateway(profile.avatar_url)
    : makeBlockie(address);

  const avatarFallback = displayName
    ? displayName.charAt(0).toUpperCase()
    : displaySymbol
      ? displaySymbol.slice(0, 2).toUpperCase()
      : formatAddress(address).slice(0, 2).toUpperCase();

  const content = (
    <div
      className={cn(
        "flex items-center gap-2",
        variant === "vertical" && "flex-col items-start",
        className
      )}
    >
      <Avatar className={cn(avatarSizes[avatarSize])}>
        <AvatarImage src={avatarUrl} alt={displayName || address} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex flex-col", variant === "vertical" && "items-start")}>
        {displayName && (
          <span className={cn("inline-flex items-center gap-1 font-medium", textSizes[avatarSize])}>
            {displayName}
            <MembershipVerifiedBadge
              address={address}
              size={avatarSize === "lg" ? "md" : "sm"}
            />
          </span>
        )}
        {displaySymbol && (
          <span
            className={cn(
              "text-muted-foreground",
              textSizes[avatarSize === "sm" ? "sm" : "xs"],
            )}
          >
            {displaySymbol}
          </span>
        )}
        {showAddress && (!displayName || !displaySymbol) && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-muted-foreground",
              textSizes[avatarSize === "sm" ? "sm" : "xs"],
            )}
          >
            {shortenAddress(address)}
            {!displayName && <MembershipVerifiedBadge address={address} />}
          </span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return (
      <Link href={`/profile/${address}`} className="transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Compact version that shows just avatar and name/symbol in a single line
 */
export function UserDisplayCompact({
  address,
  avatarSize = "sm",
  showAddress = false,
  className,
}: Omit<UserDisplayProps, "variant" | "clickable">) {
  const { meToken } = useMeTokenByOwner(address);
  const { profile } = useCreatorProfile(address);

  const displayName = profile?.username || meToken?.name || null;
  const displaySymbol = meToken?.symbol || null;
  const avatarUrl = profile?.avatar_url
    ? convertFailingGateway(profile.avatar_url)
    : makeBlockie(address);

  const avatarFallback = displayName
    ? displayName.charAt(0).toUpperCase()
    : displaySymbol
      ? displaySymbol.slice(0, 2).toUpperCase()
      : formatAddress(address).slice(0, 2).toUpperCase();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Avatar className={cn(avatarSizes[avatarSize])}>
        <AvatarImage src={avatarUrl} alt={displayName || address} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium text-[10px]">
          {avatarFallback}
        </AvatarFallback>
      </Avatar>
      <span className={cn("inline-flex items-center gap-1 font-medium", textSizes[avatarSize])}>
        {displayName ||
          displaySymbol ||
          (showAddress ? shortenAddress(address) : formatAddress(address))}
        <MembershipVerifiedBadge address={address} />
      </span>
      {displaySymbol && displayName && (
        <span
          className={cn(
            "text-muted-foreground",
            textSizes[avatarSize === "sm" ? "sm" : "xs"],
          )}
        >
          ({displaySymbol})
        </span>
      )}
    </div>
  );
}

/**
 * Just the name/symbol text without avatar (useful when avatar is shown separately)
 */
export function UserNameDisplay({
  address,
  size = "sm",
  showAddress = true,
  className,
}: {
  address: string;
  size?: "sm" | "md" | "lg";
  showAddress?: boolean;
  className?: string;
}) {
  const { meToken } = useMeTokenByOwner(address);
  const { profile } = useCreatorProfile(address);

  const displayName = profile?.username || meToken?.name || null;
  const displaySymbol = meToken?.symbol || null;

  return (
    <span className={cn("inline-flex items-center gap-1 font-medium", textSizes[size], className)}>
      {displayName ||
        displaySymbol ||
        (showAddress ? shortenAddress(address) : formatAddress(address))}
      <MembershipVerifiedBadge address={address} size={size === "lg" ? "md" : "sm"} />
      {displaySymbol && displayName && (
        <span
          className={cn(
            "ml-0.5 text-muted-foreground",
            textSizes[size === "sm" ? "sm" : "xs"],
          )}
        >
          ({displaySymbol})
        </span>
      )}
    </span>
  );
}
