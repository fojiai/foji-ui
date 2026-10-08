"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useOnboarding } from "./onboarding-provider";
import { TOURS, type TourId } from "@/lib/tours";

/** Is the element on screen? (The desktop sidebar exists on mobile too, hidden.) */
function isVisible(el: Element | null): el is HTMLElement {
  return !!el && el instanceof HTMLElement && el.getClientRects().length > 0;
}

/**
 * Runs one page's guided tour: automatically the first time this person sees
 * the page (once `ready` — i.e. the page's data has rendered), and on demand
 * via the returned `start`. Steps whose element isn't on screen right now are
 * skipped, so one definition works on desktop and mobile and with or without
 * data (no agents yet, no conversations, …).
 */
export function useTour(id: TourId, { ready = true, auto = true }: { ready?: boolean; auto?: boolean } = {}) {
  const t = useTranslations("tour");
  const { loaded, isDone, complete } = useOnboarding();
  const startedRef = useRef(false);
  const key = `tour:${id}`;

  const start = useCallback(() => {
    const steps: DriveStep[] = [];
    for (const step of TOURS[id]) {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      if (step.target && !isVisible(el)) continue;
      steps.push({
        element: step.target ? (el as HTMLElement) : undefined,
        popover: {
          title: t(`${id}.${step.key}.title`),
          description: t(`${id}.${step.key}.body`),
          side: step.side,
          align: "start",
        },
      });
    }
    if (steps.length === 0) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tour = driver({
      steps,
      showProgress: steps.length > 1,
      // driver.js fills {{current}}/{{total}}; next-intl would read single braces.
      progressText: t("progress", { current: "{{current}}", total: "{{total}}" }),
      nextBtnText: t("next"),
      prevBtnText: t("back"),
      doneBtnText: t("done"),
      popoverClass: "foji-tour",
      overlayColor: "rgb(20 14 12)",
      overlayOpacity: 0.55,
      stagePadding: 6,
      stageRadius: 12,
      animate: !reduceMotion,
      smoothScroll: !reduceMotion,
      allowClose: true,
      // Finishing or closing both count: someone who closed it has seen enough.
      onDestroyed: () => complete(key),
    });
    tour.drive();
  }, [id, key, t, complete]);

  useEffect(() => {
    if (!auto || !loaded || !ready || startedRef.current || isDone(key)) return;
    // Let the page finish laying out (fonts, cards animating in) first. Only
    // flag it as started once it fires: a re-render inside the delay cancels
    // this timer, and the next effect run must be able to schedule it again.
    const timer = window.setTimeout(() => {
      startedRef.current = true;
      start();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [auto, loaded, ready, isDone, key, start]);

  return { start };
}
