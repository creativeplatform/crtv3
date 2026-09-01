"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean | undefined {
  const [matches, setMatches] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const listener = (e: MediaQueryListEvent | MediaQueryList) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
