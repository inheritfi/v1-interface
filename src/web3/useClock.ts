import { useEffect, useState } from "react";
import { readBrowserClock, type ClockMode } from "../lib/time";

/**
 * Browser clock in seconds, updated every `intervalMs` (outside the render, so that it stays pure).
 * In "block" mode it is never read: it returns null and schedules nothing.
 */
export function useClock(mode: ClockMode, intervalMs = 5_000): bigint | null {
  const [now, setNow] = useState<bigint | null>(() => (mode === "block" ? null : readBrowserClock()));
  useEffect(() => {
    if (mode === "block") return;
    const id = setInterval(() => {
      setNow(readBrowserClock());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [mode, intervalMs]);
  return now;
}
