"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { trackPageView, trackClick, trackExit } from "@/lib/analytics";

export default function Analytics() {
  const pathname = usePathname();
  const enterRef = useRef<number>(Date.now());
  const lastPath = useRef<string>("");

  // Page view + time-on-page (logs an exit for the previous path on change)
  useEffect(() => {
    if (!pathname) return;
    if (lastPath.current && lastPath.current !== pathname) {
      trackExit(lastPath.current, Date.now() - enterRef.current);
    }
    enterRef.current = Date.now();
    lastPath.current = pathname;
    trackPageView(pathname);
  }, [pathname]);

  // Exit on tab close / backgrounding
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && lastPath.current) {
        trackExit(lastPath.current, Date.now() - enterRef.current);
        enterRef.current = Date.now(); // avoid double-counting if it comes back
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  // Delegated click tracking on links & buttons
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest("a, button, [role='button']") as HTMLElement | null;
      if (!el) return;
      const explicit = el.getAttribute("data-track");
      const label =
        explicit ||
        el.getAttribute("aria-label") ||
        el.textContent?.trim().slice(0, 80) ||
        el.getAttribute("title") ||
        "(unlabeled)";
      const href = (el as HTMLAnchorElement).getAttribute?.("href") || undefined;
      trackClick(label, href || undefined);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
  }, []);

  return null;
}
