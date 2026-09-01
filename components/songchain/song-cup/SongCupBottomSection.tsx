"use client";

import React, { useRef, useState } from "react";
import { SongCupInfoPanel } from "./SongCupInfoPanel";
import { SongCupPixelsPanel } from "./SongCupPixelsPanel";
import { SongCupSubmitPanel } from "./SongCupSubmitPanel";
import { SongCupVotePanel } from "./SongCupVotePanel";
import { SongCupSchedulePanel } from "./SongCupSchedulePanel";
import { SongCupPredictPanel } from "./SongCupPredictPanel";
import { SongCupPreviewPanel } from "./SongCupPreviewPanel";
import { SongCupSidebarIcons } from "./SongCupSidebarIcons";
import { SONG_CUP_BUTTON_ICONS, type SongCupPanel } from "./song-cup-icons";
import { SongCupFeedPanel } from "./SongCupFeedPanel";
import { SongCupAgentSearch } from "./SongCupAgentSearch";
import type { SongchainConfig } from "@/lib/songchain/config";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils/utils";
import {
  songCupSidebarIconBtn,
  songCupSidebarMobileLabel,
  songCupSidebarMobileLabelActive,
  songCupSidebarIconRingActive,
  songCupSidebarIconRingHover,
} from "@/lib/songchain/song-cup/panel-styles";

type SongCupBottomSectionProps = {
  config: SongchainConfig;
  feedId: string | null;
  groupId: string | null;
  graphId: string | null;
  publicFeedTitle?: string;
  publicFeedDescription?: string;
  clubGateTitle?: string;
  clubGateDescription?: string;
  orbClubUrl?: string;
};

export type { SongCupPanel };

function getPreviewCopy(panel: SongCupPanel) {
  switch (panel) {
    case "songcup":
      return {
        title: "Song Cup",
        description:
          "Official Song Cup preview window. Add rules, prizes, timeline, and a featured video.",
      };
    case "pixels":
      return {
        title: "Create with Pixels",
        description: "Pixel-art creator tools and galleries for the Song Cup community.",
      };
    case "submit":
      return {
        title: "Submit",
        description: "Upload your track, artwork, or entry for the current round.",
      };
    case "vote":
      return { title: "Vote", description: "Cast your votes for this round’s entries." };
    case "predict":
      return { title: "Predict", description: "Predict outcomes and compete on the leaderboard." };
    case "schedule":
      return { title: "Schedule", description: "Event schedule, matches, and head-to-head vote results." };
    default:
      return { title: panel, description: `Preview content for ${panel}.` };
  }
}

function FeedPanel(props: SongCupBottomSectionProps) {
  return (
    <SongCupFeedPanel
      feedId={props.feedId}
      groupId={props.groupId}
      graphId={props.graphId}
      feedTitle={props.publicFeedTitle ?? "Song Cup club feed"}
      feedDescription={
        props.publicFeedDescription ??
        "Read the member feed. Join the club on Orb to post and react."
      }
      orbClubUrl={props.orbClubUrl}
      clubLogoUrl="/songchain/song-cup/logo.svg"
      clubLabel="Song Cup"
    />
  );
}

function PreviewPanel({ panel }: { panel: SongCupPanel }) {
  const copy = getPreviewCopy(panel);
  return <SongCupPreviewPanel title={copy.title} description={copy.description} showVideo />;
}

function ActivePanel({
  panel,
  props,
  onGoToSubmit,
}: {
  panel: SongCupPanel | null;
  props: SongCupBottomSectionProps;
  onGoToSubmit?: () => void;
}) {
  if (panel === "feed") return <FeedPanel {...props} />;
  if (panel === "songcup") return <SongCupInfoPanel onGoToSubmit={onGoToSubmit} />;
  if (panel === "pixels") return <SongCupPixelsPanel />;
  if (panel === "submit") return <SongCupSubmitPanel />;
  if (panel === "vote") return <SongCupVotePanel title="VOTE NOW" orbClubUrl={props.orbClubUrl} />;
  if (panel === "schedule") return <SongCupSchedulePanel orbClubUrl={props.orbClubUrl} />;
  if (panel === "predict") return <SongCupPredictPanel />;
  if (!panel) return null;
  return <PreviewPanel panel={panel} />;
}

function ActivePanelBanner({ panel }: { panel: SongCupPanel | null }) {
  const icon = SONG_CUP_BUTTON_ICONS.find(({ id }) => id === panel);
  if (
    !icon ||
    panel === "feed" ||
    panel === "songcup" ||
    panel === "submit" ||
    panel === "pixels" ||
    panel === "vote" ||
    panel === "predict" ||
    panel === "schedule"
  ) {
    return null;
  }
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-1.5">
      <img src={icon.src} alt="" className="h-5 w-5 object-contain" aria-hidden />
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
        {icon.alt}
      </span>
    </div>
  );
}

function MobileDivider() {
  return <hr className="w-full border-0 border-t border-fuchsia-500/40" aria-hidden />;
}

export function SongCupBottomSection(props: SongCupBottomSectionProps) {
  const { config } = props;
  const [activePanel, setActivePanel] = useState<SongCupPanel | null>("feed");
  const panelAnchorRef = useRef<HTMLElement>(null);
  const isDesktopQuery = useMediaQuery("(min-width: 1024px)");
  const isDesktop = isDesktopQuery ?? true;

  const handleSelectPanel = (panel: SongCupPanel | null) => {
    setActivePanel(panel);
    if (isDesktop && panel && panelAnchorRef.current) {
      panelAnchorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!config.enabled) {
    return (
      <div id="song-cup-feed" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="text-center text-sm text-muted-foreground">
          Configure{" "}
          <code className="text-xs">NEXT_PUBLIC_SONG_CUP_APP_ID</code> (Lens app),{" "}
          <code className="text-xs">NEXT_PUBLIC_SONG_CUP_FEED_ID</code> /{" "}
          <code className="text-xs">NEXT_PUBLIC_SONG_CUP_GROUP_ID</code>, and{" "}
          <code className="text-xs">NEXT_PUBLIC_SONG_CUP_GRAPH_ID</code> with your Lens
          primitives. See <code className="text-xs">env.example</code>.
        </p>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div id="song-cup-feed" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <main
            ref={panelAnchorRef}
            className={cn(
              "order-2 min-h-[480px] scroll-mt-4 p-4 sm:p-6 lg:order-1",
              activePanel === "feed" ||
              activePanel === "songcup" ||
              activePanel === "submit" ||
              activePanel === "pixels" ||
              activePanel === "vote" ||
              activePanel === "predict" ||
              activePanel === "schedule"
                ? "border-0 bg-transparent p-0"
                : "rounded-2xl border border-fuchsia-500/20",
            )}
          >
            <ActivePanelBanner panel={activePanel} />
            <ActivePanel
              panel={activePanel}
              props={props}
              onGoToSubmit={() => handleSelectPanel("submit")}
            />
          </main>
          <aside className="order-1 space-y-6 lg:order-2">
            <SongCupAgentSearch className="w-full max-w-[367px] lg:ml-auto" />
            <SongCupSidebarIcons
              active={activePanel}
              onSelect={handleSelectPanel}
              className="flex flex-col items-center gap-2"
            />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div id="song-cup-feed" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="flex justify-end">
        <SongCupAgentSearch className="w-full max-w-[367px]" />
      </div>
      <div className="flex flex-col gap-4">
        {SONG_CUP_BUTTON_ICONS.map(({ id, src, alt, externalHref, dividerAfter, iconBgClass, lucideIcon }) => {
          const isActive = activePanel === id;
          const isPanel = id !== "beatme" && id !== "worldcup";
          const iconWrapClass = cn(
            "flex h-24 w-24 shrink-0 items-center justify-center rounded-xl",
            !externalHref && isActive && songCupSidebarIconRingActive,
          );
          const iconInnerClass = cn(
            "flex h-full w-full items-center justify-center overflow-hidden rounded-xl",
            iconBgClass,
          );
          return (
            <div key={id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                {externalHref ? (
                  <a
                    href={externalHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-black/20",
                      songCupSidebarIconBtn,
                    )}
                  >
                    <div
                      className={cn(
                        iconWrapClass,
                        !isActive && songCupSidebarIconRingHover,
                      )}
                    >
                      <div className={iconInnerClass}>
                        {lucideIcon ? (
                          <div className="flex h-12 w-12 items-center justify-center p-2.5">
                            {React.createElement(lucideIcon, {
                              className: "h-full w-full text-white",
                            })}
                          </div>
                        ) : (
                          <img src={src} alt={alt} className="h-full w-full object-contain" />
                        )}
                      </div>
                    </div>
                    <span className={songCupSidebarMobileLabel}>{alt}</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isPanel) {
                        setActivePanel((current) => (current === id ? null : id) as SongCupPanel);
                      }
                    }}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all",
                      songCupSidebarIconBtn,
                      isActive ? "bg-black/20" : "hover:bg-black/20",
                    )}
                    aria-pressed={isPanel ? isActive : undefined}
                  >
                    <div
                      className={cn(
                        iconWrapClass,
                        !isActive && songCupSidebarIconRingHover,
                      )}
                    >
                      <div className={iconInnerClass}>
                        {lucideIcon ? (
                          <div className="flex h-12 w-12 items-center justify-center p-2.5">
                            {React.createElement(lucideIcon, {
                              className: "h-full w-full text-white",
                            })}
                          </div>
                        ) : (
                          <img src={src} alt={alt} className="h-full w-full object-contain" />
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        songCupSidebarMobileLabel,
                        isActive && songCupSidebarMobileLabelActive,
                      )}
                    >
                      {alt}
                    </span>
                  </button>
                )}
              </div>
              {isActive && isPanel && (
                <div
                  className={cn(
                    "min-h-[320px] p-4 sm:p-5",
                    id === "feed" ||
                    id === "songcup" ||
                    id === "submit" ||
                    id === "pixels" ||
                    id === "vote" ||
                    id === "predict" ||
                    id === "schedule"
                      ? "border-0 bg-transparent p-0"
                      : "rounded-2xl border border-fuchsia-500/20 bg-muted/30 dark:bg-black/40",
                  )}
                >
                  <ActivePanel
                    panel={id as SongCupPanel}
                    props={props}
                    onGoToSubmit={() => setActivePanel("submit")}
                  />
                </div>
              )}
              {dividerAfter && <MobileDivider />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
