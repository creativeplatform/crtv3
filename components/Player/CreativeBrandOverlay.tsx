import { SITE_LOGO } from "@/context/context";
import { cn } from "@/lib/utils/utils";

type CreativeBrandOverlayProps = {
  className?: string;
};

/**
 * Small Creative logo watermark for the bottom-right of video / live players.
 * Pointer-events none so it never blocks controls.
 */
export function CreativeBrandOverlay({ className }: CreativeBrandOverlayProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-2 right-2 z-[15]",
        className
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SITE_LOGO}
        alt=""
        className="h-5 w-auto opacity-80 drop-shadow-sm sm:h-6"
      />
    </div>
  );
}
