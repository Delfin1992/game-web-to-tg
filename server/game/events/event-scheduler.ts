import { generateEvent, refreshGlobalEventsCache } from "./event-engine";

let timer: NodeJS.Timeout | null = null;

export function startGlobalEventScheduler() {
  if (timer) return;

  const tick = async () => {
    try {
      await refreshGlobalEventsCache(true);
      if (Math.random() <= 0.35) {
        await generateEvent(Date.now());
      }
    } catch (error) {
      console.error("Global event scheduler tick failed:", error);
    } finally {
      timer = setTimeout(tick, 6 * 60 * 60 * 1000);
    }
  };

  // fast first tick for cold start
  timer = setTimeout(tick, 15_000);
}

export function stopGlobalEventScheduler() {
  if (!timer) return;
  clearTimeout(timer);
  timer = null;
}
