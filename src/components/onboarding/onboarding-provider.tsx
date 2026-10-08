"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { onboardingApi } from "@/lib/api";

interface OnboardingContextValue {
  /** False until the server answered — never auto-start a tour before that. */
  loaded: boolean;
  isDone: (key: string) => boolean;
  complete: (key: string) => void;
  /** Show every tour again ("Rever tours" in the profile menu). */
  reset: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/**
 * Which guided tours and getting-started steps this person has finished.
 * Stored server-side so a tour isn't replayed on every new device. Writes are
 * optimistic: a failed save just means the tour may show once more.
 */
export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    onboardingApi
      .get()
      .then((r) => !cancelled && setDone(new Set(r.completed)))
      // If this fails we'd rather skip tours than replay them every page load.
      .catch(() => !cancelled && setDone(new Set(["*"])))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const complete = useCallback((key: string) => {
    setDone((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    onboardingApi.complete(key).catch(() => {});
  }, []);

  const reset = useCallback(async () => {
    await onboardingApi.reset();
    setDone(new Set());
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({ loaded, isDone: (k) => done.has(k) || done.has("*"), complete, reset }),
    [loaded, done, complete, reset]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
