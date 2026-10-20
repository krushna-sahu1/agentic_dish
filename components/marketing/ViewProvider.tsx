"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Audience } from "@/lib/landing/config";

/**
 * The "Diners / Owners" switch.
 *
 * It lives in a context so the nav toggle, the hero copy and the feature
 * cards all read the same value. The choice is remembered in localStorage,
 * but the first render always uses the default so the server and the client
 * markup match (no hydration warning).
 */

const STORAGE_KEY = "agentic-eats:view";

type ViewContextValue = {
  view: Audience;
  setView: (view: Audience) => void;
};

const ViewContext = createContext<ViewContextValue>({
  view: "owners",
  setView: () => {},
});

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<Audience>("owners");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "diners" || saved === "owners") setViewState(saved);
    } catch {
      /* storage unavailable (private mode) — keep the default */
    }
  }, []);

  const setView = useCallback((next: Audience) => {
    setViewState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ view, setView }), [view, setView]);

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  return useContext(ViewContext);
}
