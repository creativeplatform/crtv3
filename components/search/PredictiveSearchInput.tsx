"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { cn } from "@/lib/utils/utils";

export type SearchScope = "videos" | "market" | "predictions";

type SuggestResult = {
  id?: string;
  questionId?: string;
  address?: string;
  title: string;
  subtitle?: string;
  href: string;
};

const SCOPE_ENDPOINT: Record<SearchScope, string> = {
  videos: "/api/search/videos",
  market: "/api/search/market",
  predictions: "/api/search/predictions",
};

interface PredictiveSearchInputProps {
  scope: SearchScope;
  placeholder?: string;
  /** External reset key — increment to clear the input from parent (e.g. "Clear filters"). */
  resetKey?: number;
  onQueryChange: (query: string) => void;
  onSelect?: (result: SuggestResult) => void;
  /** Client-side suggestions (e.g. from already-loaded list data). */
  localSuggest?: (query: string) => SuggestResult[];
  className?: string;
  inputClassName?: string;
  showClear?: boolean;
}

export function PredictiveSearchInput({
  scope,
  placeholder = "Search…",
  resetKey = 0,
  onQueryChange,
  onSelect,
  localSuggest,
  className,
  inputClassName,
  showClear = true,
}: PredictiveSearchInputProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [results, setResults] = useState<SuggestResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef("");
  const isFirstResetRender = useRef(true);
  const debounced = useDebounce(input, 300);
  const onQueryChangeRef = useRef(onQueryChange);

  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  }, [onQueryChange]);

  useEffect(() => {
    if (isFirstResetRender.current) {
      isFirstResetRender.current = false;
      return;
    }
    setInput("");
    setResults([]);
    setOpen(false);
    setFetchError(null);
    lastEmittedRef.current = "";
    onQueryChangeRef.current("");
  }, [resetKey]);

  useEffect(() => {
    if (debounced === lastEmittedRef.current) return;
    lastEmittedRef.current = debounced;
    onQueryChangeRef.current(debounced);
  }, [debounced]);

  const localSuggestRef = useRef(localSuggest);
  useEffect(() => {
    localSuggestRef.current = localSuggest;
  }, [localSuggest]);

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([]);
      setFetchError(null);
      setOpen(false);
      return;
    }

    const localResults = localSuggestRef.current?.(debounced.trim()) ?? [];

    if (localResults.length > 0) {
      setResults(localResults);
      setFetchError(null);
      setOpen(true);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      setOpen(true);
      try {
        const res = await fetch(
          `${SCOPE_ENDPOINT[scope]}?q=${encodeURIComponent(debounced.trim())}&limit=8`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setResults([]);
          setFetchError(
            typeof data.error === "string" ? data.error : "Search unavailable"
          );
          setOpen(true);
          setActiveIndex(-1);
          return;
        }
        const mapped: SuggestResult[] = (data.results ?? []).map(
          (r: Record<string, string>) => ({
            id: r.id,
            questionId: r.questionId,
            address: r.address,
            title: r.title ?? r.name ?? "Result",
            subtitle: r.symbol ?? r.category,
            href: r.href,
          })
        );
        setResults(mapped);
        setFetchError(null);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (!cancelled) {
          setResults([]);
          setFetchError("Search unavailable");
          setOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debounced, scope]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectResult = useCallback(
    (result: SuggestResult) => {
      setInput(result.title);
      lastEmittedRef.current = result.title;
      onQueryChangeRef.current(result.title);
      setOpen(false);
      onSelect?.(result);
      router.push(result.href);
    },
    [onSelect, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown =
    open &&
    debounced.trim().length >= 2 &&
    (loading || fetchError !== null || results.length > 0);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        type="search"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={() => debounced.trim().length >= 2 && setOpen(true)}
        onKeyDown={handleKeyDown}
        className={cn("pl-10 pr-20", inputClassName)}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {showClear && input && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => {
              setInput("");
              lastEmittedRef.current = "";
              setResults([]);
              setFetchError(null);
              setOpen(false);
              onQueryChangeRef.current("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {showDropdown && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-auto"
          role="listbox"
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          )}
          {!loading && fetchError && (
            <li className="px-3 py-2 text-sm text-destructive">{fetchError}</li>
          )}
          {!loading && !fetchError && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
          )}
          {results.map((result, idx) => (
            <li key={result.href + idx}>
              <button
                type="button"
                role="option"
                aria-selected={idx === activeIndex}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent",
                  idx === activeIndex && "bg-accent"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectResult(result);
                }}
              >
                <div className="font-medium truncate">{result.title}</div>
                {result.subtitle && (
                  <div className="text-xs text-muted-foreground truncate">
                    {result.subtitle}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
