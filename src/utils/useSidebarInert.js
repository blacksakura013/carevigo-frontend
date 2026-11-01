import { useLayoutEffect } from "react";

// Closing transitions may remain visible briefly, but must stop accepting input.
export function useSidebarInert(ref, open, mediaQuery) {
  useLayoutEffect(() => {
    const sidebar = ref.current;
    if (!sidebar) return undefined;
    const previousInert = sidebar.inert;
    let media = null;
    try {
      if (typeof window.matchMedia === "function") media = window.matchMedia(mediaQuery);
    } catch {
      // Keep desktop navigation usable if media queries are unavailable.
    }
    const update = () => {
      sidebar.inert = Boolean(media?.matches && !open);
    };
    update();
    if (typeof media?.addEventListener === "function") media.addEventListener("change", update);
    else media?.addListener?.(update);
    return () => {
      if (typeof media?.addEventListener === "function") media.removeEventListener?.("change", update);
      else media?.removeListener?.(update);
      sidebar.inert = previousInert;
    };
  }, [ref, open, mediaQuery]);
}
