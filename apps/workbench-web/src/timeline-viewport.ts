import { createWebTimelineViewportPort, resolveWebTimelinePlatform } from "@opencraft/timeline-host-web";
import { resolveTimelineViewportPolicy, type TimelineViewportPolicy } from "@opencraft/timeline-virtualizer";
import { useLayoutEffect, useMemo } from "react";

import { createViewportDiagnostics } from "./runtime/viewport-diagnostics";

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
    });
    const report = createViewportDiagnostics();
    let finalReport: number | undefined;
    const observe = () => {
      report();
      window.clearTimeout(finalReport);
      // A compositor/readback update can arrive after the last raw metric.
      // This observation never writes layout or changes the viewport port.
      finalReport = window.setTimeout(report, 120);
    };
    const unsubscribe = policy.tracksVisualViewport ? port.subscribe(observe) : () => {};
    return () => { window.clearTimeout(finalReport); unsubscribe(); port.dispose(); };
  }, [windowChrome.kind, windowChrome.platform, policy.tracksVisualViewport]);

  return policy;
}
