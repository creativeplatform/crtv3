import Image from "next/image";
import { cn } from "@/lib/utils";

type SongCupBrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function SongCupBrandLogo({ className, priority = false }: SongCupBrandLogoProps) {
  return (
    <Image
      src="/songchain/song-cup/logo.svg"
      alt="Song Cup"
      width={1024}
      height={173}
      className={cn(
        "h-auto w-[min(78vw,720px)] max-w-full object-contain lg:w-[min(82vw,720px)]",
        className,
      )}
      priority={priority}
    />
  );
}
