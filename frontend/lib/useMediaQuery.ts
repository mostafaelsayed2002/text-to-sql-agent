"use client";

import { useEffect, useState } from "react";

/**
 * Tracks a CSS media query from JS.
 *
 * Starts false so server and first client render agree; the real value lands
 * on mount. Callers should treat false as "assume narrow", which degrades to
 * the mobile layout rather than a broken desktop one.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);

    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
