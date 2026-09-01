"use client";

import { cn } from "@/lib/utils";
import { useAddressHasMembership } from "@/lib/hooks/unlock/useAddressHasMembership";

type MembershipVerifiedBadgeProps = {
  address?: string | null;
  /**
   * Force show/hide when membership is already known by the parent.
   * When omitted, membership is looked up for `address`.
   */
  show?: boolean;
  /** Force brand (gold) vs standard (blue) when parent already knows the tier. */
  brand?: boolean;
  className?: string;
  size?: "sm" | "md";
};

const sizeClass = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
} as const;

/**
 * Twitter/Instagram-style verified badge for Unlock Creative Pass holders.
 * Brand Pass members get a gold badge; other members get blue.
 */
export function MembershipVerifiedBadge({
  address,
  show,
  brand,
  className,
  size = "sm",
}: MembershipVerifiedBadgeProps) {
  const { hasMembership, hasBrandMembership, isLoading } =
    useAddressHasMembership(show === undefined ? address : null);

  const visible = show ?? (!isLoading && hasMembership);
  if (!visible) return null;

  const isBrand = brand ?? hasBrandMembership;
  const title = isBrand ? "Creative Brand Pass" : "Creative member";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        isBrand ? "text-[#EAB308]" : "text-[#1D9BF0]",
        sizeClass[size],
        className,
      )}
      title={title}
      aria-label={title}
    >
      <svg
        viewBox="0 0 22 22"
        className="h-full w-full"
        aria-hidden
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M11 0L13.59 2.06 16.79 1.44 17.76 4.56 20.88 5.53 20.26 8.73 22.32 11.32 20.26 13.91 20.88 17.11 17.76 18.08 16.79 21.2 13.59 20.58 11 22.64 8.41 20.58 5.21 21.2 4.24 18.08 1.12 17.11 1.74 13.91 0 11.32 1.74 8.73 1.12 5.53 4.24 4.56 5.21 1.44 8.41 2.06 11 0z"
        />
        <path
          fill="#fff"
          d="M9.55 14.9l-3.1-3.1 1.25-1.25 1.85 1.85 4.75-4.75 1.25 1.25-6 6z"
        />
      </svg>
    </span>
  );
}
