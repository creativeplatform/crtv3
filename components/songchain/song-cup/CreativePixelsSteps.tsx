"use client";

import Link from "next/link";
import { FolderPlus, Sparkles, Scissors, Share2, Coins, ArrowRight } from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Create a New Project",
    subtitle: "Upload any audio or video from your device",
    description:
      "Start a fresh project and upload your media. Creative Pixels supports your files—whether it's an audio track, voiceover, or existing video footage—to lay the foundation on your timeline.",
    icon: FolderPlus,
    isPremium: false,
  },
  {
    id: 2,
    title: "Enhance with AI Tools (Optional)",
    subtitle: "Premium features powered by USDC",
    description:
      "Take your project further using two premium AI features. You can easily buy USDC via the in-app on-ramp to fund them:",
    bullets: [
      "Flow AI: Purchase credit packs to generate custom assets.",
      "Real-Time AI Generator: Prompt anything live for $3 per hour (pay-per-second).",
    ],
    icon: Sparkles,
    isPremium: true,
  },
  {
    id: 3,
    title: "Edit Your Content",
    subtitle: "Fine-tune your project on the timeline",
    description:
      "Bring your uploaded files and new AI-generated media together. Use the workstation's timeline tools to edit, arrange, and perfect your video's pacing for free.",
    icon: Scissors,
    isPremium: false,
  },
  {
    id: 4,
    title: "Export and Share",
    subtitle: "Save your file and drop it for your audience",
    description:
      "Once your edit is complete, hit the export button to download the video file directly to your device, ready to share with the world.",
    icon: Share2,
    isPremium: false,
  },
];

export function CreativePixelsSteps() {
  return (
    <div className="min-h-[420px] rounded-2xl border border-slate-800 bg-slate-950 py-8 text-slate-200 sm:px-4 lg:px-6 font-sans">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-extrabold tracking-tight text-white md:text-4xl">
            How Creative Pixels Works
          </h2>
          <p className="mx-auto max-w-2xl text-base text-slate-400">
            From raw media to a polished masterpiece. See how easy it is to bring your vision to life
            using our real-time video workstation.
          </p>
        </div>

        {/* Timeline Container */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute bottom-0 left-6 top-0 w-0.5 rounded-full bg-slate-800 md:left-10"></div>

          {/* Steps */}
          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.id} className="group relative flex items-start">
                {/* Icon / Number Indicator */}
                <div className="absolute left-6 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-4 border-slate-950 bg-slate-950 transition-transform duration-300 group-hover:scale-110 md:left-10 z-10">
                  <div
                    className={`flex h-full w-full items-center justify-center rounded-full ${
                      step.isPremium
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.5)]"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    <step.icon size={18} />
                  </div>
                </div>

                {/* Content Card */}
                <div className="ml-14 w-full md:ml-20">
                  <div
                    className={`rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 md:p-6 ${
                      step.isPremium
                        ? "border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 to-slate-900/40 shadow-lg shadow-indigo-500/5"
                        : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80"
                    }`}
                  >
                    {/* Premium Badge */}
                    {step.isPremium && (
                      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                        <Coins size={14} />
                        Powered by USDC
                      </div>
                    )}

                    {/* Step Number */}
                    <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                      Step {step.id}
                    </div>

                    {/* Title & Subtitle */}
                    <h3 className="mb-1 text-lg font-bold text-white md:text-xl">{step.title}</h3>
                    <h4
                      className={`mb-3 text-sm font-medium md:text-base ${
                        step.isPremium ? "text-indigo-300" : "text-slate-400"
                      }`}
                    >
                      {step.subtitle}
                    </h4>

                    {/* Description */}
                    <p className="text-sm leading-relaxed text-slate-300 md:text-base">
                      {step.description}
                    </p>

                    {/* Bullets (specifically for the AI step) */}
                    {step.bullets && (
                      <ul className="mt-3 space-y-2">
                        {step.bullets.map((bullet, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-sm text-slate-300 md:text-base"
                          >
                            <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500"></div>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Call to Action */}
        <div className="mt-12 text-center">
          <Link
            href="https://create.creativeplatform.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-bold text-slate-950 transition-colors duration-200 hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-500/50"
          >
            Start Your First Project
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
