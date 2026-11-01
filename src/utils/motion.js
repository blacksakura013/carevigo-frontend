import { useLayoutEffect, useRef } from "react";

// Replay a heading's entrance without replacing its surrounding form or page.
export function useContentMotion(trigger) {
  const ref = useRef(null);
  const previous = useRef(trigger);
  const active = useRef(null);
  const reduced = useRef(false);

  useLayoutEffect(() => {
    const media = typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
    reduced.current = Boolean(media?.matches);
    const changed = (event) => {
      reduced.current = Boolean(event.matches);
      if (reduced.current && active.current) {
        active.current.cancel();
        active.current = null;
      }
    };
    if (typeof media?.addEventListener === "function") media.addEventListener("change", changed);
    else media?.addListener?.(changed);
    return () => {
      if (typeof media?.addEventListener === "function") media.removeEventListener?.("change", changed);
      else media?.removeListener?.(changed);
      active.current?.cancel();
      active.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (Object.is(previous.current, trigger)) return undefined;
    previous.current = trigger;
    if (reduced.current || typeof ref.current?.animate !== "function") return undefined;
    const animation = ref.current.animate(
      [{ opacity: 0.75 }, { opacity: 1 }],
      { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    active.current = animation;
    return () => {
      if (active.current === animation) {
        animation.cancel();
        active.current = null;
      }
    };
  }, [trigger]);

  return ref;
}
