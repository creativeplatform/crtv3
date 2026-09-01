import { cn } from "@/lib/utils/utils";

/** Shared Song Cup panel surfaces — light/dark compatible. */
export const songCupPanel = cn(
  "rounded-[20px] border border-fuchsia-500/35 bg-card text-foreground",
  "dark:border-[#dc2bb3] dark:bg-black dark:text-white",
);

export const songCupPanelInset = cn(
  "rounded-[20px] border border-fuchsia-500/30 bg-muted/40",
  "dark:border-[#dc2bb3]/40 dark:bg-black/40",
);

export const songCupBorder = "border-fuchsia-500/40 dark:border-[#dc2bb3]";
export const songCupBorderAccent = "border-fuchsia-500/50 dark:border-[#fe01dc]";

export const songCupMuted = "text-muted-foreground dark:text-white/70";
export const songCupBody = "text-foreground/90 dark:text-white/90";
export const songCupLabel = "text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-white/80";

export const songCupAccent = "text-fuchsia-600 dark:text-[#fe01dc]";
export const songCupAccentYellow = "text-amber-600 dark:text-[#feed01]";

export const songCupPostCard = cn(
  "min-h-[180px] rounded-[20px] border bg-card text-foreground shadow-sm",
  "border-fuchsia-500/35 dark:border-[#fe01dc] dark:bg-card dark:text-white",
);

export const songCupActionBtn = cn(
  "h-7 shrink-0 px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
  "dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white",
);

export const songCupActionBtnActive = "text-fuchsia-600 dark:text-[#fe01dc]";

/** Form card (Submit panel inner shell). */
export const songCupFormCard = cn(
  "rounded-[28px] border border-border/60 bg-muted/40 p-5 shadow-sm",
  "dark:border-black/30 dark:bg-[#091522]/70 dark:shadow-[0px_-4px_16px_0px_black]",
);

/** Text inputs and textareas in Song Cup forms. */
export const songCupField = cn(
  "rounded-[28px] border px-4 text-sm shadow-sm",
  "border-fuchsia-500/40 bg-background text-foreground placeholder:text-muted-foreground",
  "focus-visible:ring-fuchsia-500/50",
  "dark:border-[#fe01dc] dark:bg-black/25 dark:text-white dark:placeholder:text-white/50",
  "dark:shadow-[0px_-4px_16px_0px_black] dark:focus-visible:ring-[#fe01dc]",
);

export const songCupCheckboxClass = cn(
  "h-6 w-6 shrink-0 appearance-none rounded border checked:bg-center checked:bg-no-repeat",
  "border-fuchsia-500/60 bg-background checked:border-fuchsia-600 checked:bg-fuchsia-600",
  "dark:border-[#fe01dc] dark:bg-black/40 dark:checked:border-[#fe01dc] dark:checked:bg-[#fe01dc]",
);

export const songCupCheckboxMark =
  "checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%223%22%3E%3Cpath%20d%3D%22M5%2013l4%204L19%207%22%2F%3E%3C%2Fsvg%3E')]";

export const songCupDashedUpload = cn(
  "border-2 border-dashed transition-colors",
  "border-fuchsia-500/35 text-muted-foreground hover:border-fuchsia-500/60 hover:bg-muted/40",
  "dark:border-[#fe01dc]/40 dark:text-white/80 dark:hover:border-[#fe01dc] dark:hover:bg-white/5",
);

/** Pixels step cards. */
export const songCupStepCard = cn(
  "rounded-[20px] border p-4 sm:p-5",
  songCupBorder,
  "bg-muted/30 dark:bg-transparent",
);

/** Admin / nested sections inside panels. */
export const songCupAdminSection = cn(
  "rounded-[20px] border p-4 sm:p-5",
  "border-fuchsia-500/35 bg-muted/30",
  "dark:border-[#dc2bb3]/60 dark:bg-black/80",
);

export const songCupGradientCta = cn(
  "rounded-full bg-gradient-to-br from-[#DC2BB3] to-[#FDBE01] font-medium text-black hover:opacity-90",
);

/** Sidebar nav icon buttons (desktop + mobile). */
export const songCupSidebarIconBtn = cn(
  "group relative rounded-xl transition-all duration-200",
  "outline-none focus:outline-none focus-visible:outline-none",
);

export const songCupSidebarIconRingHover = cn(
  "ring-0 hover:ring-2 hover:ring-[#FDBE01]",
  "group-hover:ring-2 group-hover:ring-[#FDBE01]",
  "focus:ring-2 focus:ring-[#FDBE01]",
  "group-focus-visible:ring-2 group-focus-visible:ring-[#FDBE01]",
  "focus-visible:ring-2 focus-visible:ring-[#FDBE01]",
);

/** Active/selected — burnt orange from Song Cup gradient (avoids default blue focus ring). */
export const songCupSidebarIconRingActive = cn(
  "ring-2 ring-[#FDBE01]",
  "focus:ring-2 focus:ring-[#FDBE01]",
  "focus-visible:ring-2 focus-visible:ring-[#FDBE01]",
);

export const songCupSidebarMobileLabel = cn(
  "font-medium uppercase transition-colors duration-200",
  "text-foreground dark:text-white group-hover:text-[#feed01] group-focus-visible:text-[#feed01]",
);

export const songCupSidebarMobileLabelActive = "text-[#feed01]";
