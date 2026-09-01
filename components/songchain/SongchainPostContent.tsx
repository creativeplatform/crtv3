"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { linkifyPostText } from "@/lib/utils/linkify-post-text";
import { CreativeTVLinkPreview } from "@/components/songchain/CreativeTVLinkPreview";
import { ExternalLinkPreview } from "@/components/songchain/ExternalLinkPreview";
import { shouldSkipLinkPreview } from "@/lib/songchain/post-utils";
import { cn } from "@/lib/utils/utils";

const LINE_CLAMP_CLASS: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

type SongchainPostContentProps = {
  text: string;
  compact?: boolean;
  /** Max visible lines before truncation; expand only offered when content overflows. */
  maxLines?: number;
  className?: string;
  embeddedCreativeTVUrls?: Set<string>;
  skipAllInternalPreviews?: boolean;
};

export function SongchainPostContent({
  text,
  compact = false,
  maxLines = 3,
  className,
  embeddedCreativeTVUrls,
  skipAllInternalPreviews = false,
}: SongchainPostContentProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const clampClass = LINE_CLAMP_CLASS[maxLines] ?? LINE_CLAMP_CLASS[3];
  const segments = useMemo(() => linkifyPostText(text), [text]);

  const uniqueInternalUrls = useMemo(() => {
    const urls = segments
      .filter((segment) => segment.type === "internal")
      .map((segment) => segment.value);
    return Array.from(new Set(urls));
  }, [segments]);

  const internalUrlsForPreview = useMemo(() => {
    if (compact) return [];
    const embedded = embeddedCreativeTVUrls ?? new Set<string>();
    return uniqueInternalUrls.filter(
      (url) => !shouldSkipLinkPreview(url, embedded, skipAllInternalPreviews),
    );
  }, [
    compact,
    uniqueInternalUrls,
    embeddedCreativeTVUrls,
    skipAllInternalPreviews,
  ]);

  const uniqueExternalUrls = useMemo(() => {
    const urls = segments
      .filter((segment) => segment.type === "external")
      .map((segment) => segment.value);
    return Array.from(new Set(urls));
  }, [segments]);

  useLayoutEffect(() => {
    setIsExpanded(false);
  }, [text]);

  useLayoutEffect(() => {
    if (isExpanded) return;

    const element = contentRef.current;
    if (!element) return;

    const measureOverflow = () => {
      setHasOverflow(element.scrollHeight > element.clientHeight + 1);
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, isExpanded, maxLines, compact]);

  if (!text) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div
        ref={contentRef}
        className={cn("relative", !isExpanded && clampClass)}
      >
        <p
          className={cn(
            "text-sm leading-relaxed whitespace-pre-wrap",
            compact && "text-xs",
          )}
        >
          {segments.map((segment, index) => {
            if (segment.type === "text") {
              return <span key={`text-${index}`}>{segment.value}</span>;
            }

            if (segment.type === "internal") {
              return (
                <Link
                  key={`internal-${index}`}
                  href={segment.href}
                  className="break-all text-violet-400 hover:text-violet-300 hover:underline"
                >
                  {segment.value}
                </Link>
              );
            }

            return (
              <a
                key={`external-${index}`}
                href={segment.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-violet-400 hover:text-violet-300 hover:underline"
              >
                {segment.value}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            );
          })}
        </p>

        {isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs font-medium text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
            aria-label="Collapse post text"
          >
            Show less
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {!isExpanded && hasOverflow && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="inline-flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs font-medium text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
          aria-label="Expand post text"
        >
          Show more
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}

      {internalUrlsForPreview.map((url) => (
        <CreativeTVLinkPreview key={`preview-internal-${url}`} url={url} />
      ))}

      {!compact &&
        uniqueExternalUrls.map((url) => (
          <ExternalLinkPreview
            key={`preview-external-${url}`}
            url={url}
            previewOnly
          />
        ))}
    </div>
  );
}
