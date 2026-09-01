"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/utils";

type LinkPreviewData = {
  title?: string;
  description?: string;
  image?: string;
  domain: string;
};

type ExternalLinkPreviewProps = {
  url: string;
  compact?: boolean;
  previewOnly?: boolean;
  className?: string;
};

export function ExternalLinkPreview({
  url,
  compact = false,
  previewOnly = false,
  className,
}: ExternalLinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPreview() {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { signal: controller.signal },
        );
        if (response.ok) {
          const data = (await response.json()) as LinkPreviewData;
          setPreview(data);
        } else {
          setPreview(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          setPreview(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadPreview();
    return () => controller.abort();
  }, [url]);

  const domain = useMemo(() => {
    if (preview?.domain) return preview.domain;
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }, [preview?.domain, url]);

  return (
    <span className={cn("block", className)}>
      {!previewOnly ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 break-all text-violet-400 hover:text-violet-300 hover:underline"
        >
          {url}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      ) : null}

      {!compact && !loading && preview && (preview.title || preview.image) ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block overflow-hidden rounded-lg border border-border/50 bg-muted/20 transition-colors hover:bg-muted/40"
        >
          {preview.image ? (
            <div className="relative aspect-video w-full bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.image}
                alt={preview.title ?? domain}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="space-y-1 p-3">
            {preview.title ? (
              <p className="line-clamp-2 text-sm font-medium text-foreground">
                {preview.title}
              </p>
            ) : null}
            {preview.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {preview.description}
              </p>
            ) : null}
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {domain}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </p>
          </div>
        </a>
      ) : null}
    </span>
  );
}
