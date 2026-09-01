"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/utils";
import {
  songCupBody,
  songCupGradientCta,
  songCupPanel,
  songCupStepCard,
} from "@/lib/songchain/song-cup/panel-styles";

type SongCupPixelsPanelProps = {
  className?: string;
};

type StepCard = {
  title: string;
  body: ReactNode;
  icon: string;
  iconAlt: string;
};

const STEPS: StepCard[] = [
  {
    title: "Create a New Project",
    icon: "/songchain/song-cup/pixels-icon-upload.png",
    iconAlt: "Upload",
    body: (
      <>
        <p className="mb-2 font-bold">Start a fresh project and upload your media.</p>
        <p>
          Creative Pixels supports audio track, voiceover, or existing video footage—to lay the
          foundation on your timeline.
        </p>
      </>
    ),
  },
  {
    title: "Premium features",
    icon: "/songchain/song-cup/pixels-icon-premium.png",
    iconAlt: "Premium AI features",
    body: (
      <>
        <p className="mb-2">
          Take your project further using two premium AI features. You can easily buy USDC via the
          in-app on-ramp to fund them:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Flow AI: Purchase credit packs to generate custom assets and visuals for your project.
          </li>
          <li>
            Real-Time AI Generator: Prompt anything in real time with you acting as the subject.
            This uses a pay-per-second method ($3 per hour) to transform your webcam input into
            live-generated video.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Edit Your Content",
    icon: "/songchain/song-cup/pixels-icon-edit.png",
    iconAlt: "Edit content",
    body: (
      <>
        <p className="mb-2">
          Bring your uploaded files and new AI-generated media together. Use the workstation&apos;s
          timeline tools to edit, arrange, and perfect your video&apos;s pacing for free.
        </p>
      </>
    ),
  },
  {
    title: "Export and Share",
    icon: "/songchain/song-cup/pixels-icon-upload.png",
    iconAlt: "Export and share",
    body: (
      <>
        <p className="mb-2">Save your file and drop it for your audience.</p>
        <p>
          Once your edit is complete, hit the export button to download the video file directly to
          your device, ready to share with the world.
        </p>
      </>
    ),
  },
];

function StepRow({ step }: { step: StepCard }) {
  return (
    <article className={songCupStepCard}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative mx-auto h-[96px] w-[96px] shrink-0 sm:mx-0">
          <img
            src="/songchain/song-cup/pixels-step-circle.png"
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="absolute inset-0 flex items-center justify-center p-5">
            <img src={step.icon} alt={step.iconAlt} className="h-full w-full object-contain" />
          </div>
        </div>
        <div className={cn("min-w-0 flex-1 space-y-2 text-base leading-5 tracking-[-0.2px]", songCupBody)}>
          <h3 className="text-xl font-bold text-foreground dark:text-white">{step.title}</h3>
          <div className="text-sm sm:text-base">{step.body}</div>
        </div>
      </div>
    </article>
  );
}

export function SongCupPixelsPanel({ className }: SongCupPixelsPanelProps) {
  return (
    <div className={cn("relative overflow-hidden p-4 sm:p-6", songCupPanel, className)}>
      <div className="relative flex flex-col gap-6">
        <img
          src="/songchain/button-icons/Pixels-icon.svg"
          alt="Create with Pixels"
          className="h-[120px] w-[120px] object-contain sm:h-[140px] sm:w-[140px]"
        />

        <div className="space-y-4">
          {STEPS.map((step) => (
            <StepRow key={step.title} step={step} />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <Link
            href="https://create.creativeplatform.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center justify-center px-6 text-sm",
              songCupGradientCta,
            )}
          >
            Start Your First Project
          </Link>
        </div>
      </div>
    </div>
  );
}
