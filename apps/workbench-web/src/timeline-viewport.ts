import { createWebTimelineViewportPort, resolveWebTimelinePlatform } from "@opencraft/timeline-host-web";
import { resolveTimelineViewportPolicy, type TimelineViewportPolicy } from "@opencraft/timeline-virtualizer";
import { useLayoutEffect, useMemo } from "react";

import type { WindowChromeSnapshot } from "./window-chrome";

/**
 * Binds the renderer-neutral timeline viewport port to the current Web shell.
 * Expo Native owns a different adapter; Expo Web may reuse this package-level
 * Web adapter without importing the Vite shell.
 */
export function useTimelineViewportHost(windowChrome: WindowChromeSnapshot): TimelineViewportPolicy {
  const policy = useMemo(() => {
    const detectedPlatform = resolveWebTimelinePlatform({
      maxTouchPoints: navigator.maxTouchPoints,
      navigatorPlatform: navigator.platform,
      userAgent: navigator.userAgent,
    });
    return resolveTimelineViewportPolicy({
      kind: windowChrome.kind,
      platform: detectedPlatform === "ios" || detectedPlatform === "android"
        ? detectedPlatform
        : windowChrome.platform,
    });
  }, [windowChrome.kind, windowChrome.platform]);

  useLayoutEffect(() => {
    const port = createWebTimelineViewportPort(window, document, {
      kind: windowChrome.kind,
      platform: windowChrome.platform,
      measureFixedFrame: () => {
        const frame = document.querySelector<HTMLElement>(".app-shell-root");
        if (frame === null) return null;
        const rect = frame.getBoundingClientRect();
        const style = window.getComputedStyle(frame);
        return {
          topPx: rect.top,
          leftPx: rect.left,
          appliedTopPx: Number.parseFloat(style.top) || 0,
          appliedLeftPx: Number.parseFloat(style.left) || 0,
        };
      },
    });
    return () => port.dispose();
  }, [windowChrome.kind, windowChrome.platform]);

  return policy;
}
