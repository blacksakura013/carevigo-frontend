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
      if (reduced.current) active.current?.cancel();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") active.current?.cancel();
    };
    if (typeof media?.addEventListener === "function") media.addEventListener("change", changed);
    else media?.addListener?.(changed);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      if (typeof media?.addEventListener === "function") media.removeEventListener?.("change", changed);
      else media?.removeListener?.(changed);
      document.removeEventListener("visibilitychange", visibilityChanged);
      active.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    if (Object.is(previous.current, trigger)) return undefined;
    previous.current = trigger;
    if (reduced.current || document.visibilityState === "hidden" || typeof ref.current?.animate !== "function") return undefined;
    let animation;
    try {
      animation = ref.current.animate(
        [{ opacity: 0.75 }, { opacity: 1 }],
        { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" },
      );
    } catch {
      // An optional visual effect must not interrupt the page or its form.
      return undefined;
    }
    let settled = false;
    const release = (cancel = false) => {
      if (settled) return;
      settled = true;
      animation.removeEventListener?.("finish", finished);
      if (active.current === controller) active.current = null;
      if (cancel) animation.cancel();
    };
    const finished = () => release();
    const controller = { cancel: () => release(true) };
    active.current = controller;
    animation.addEventListener?.("finish", finished, { once: true });
    return controller.cancel;
  }, [trigger]);

  return ref;
}
