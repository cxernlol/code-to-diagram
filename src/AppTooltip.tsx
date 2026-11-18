import { useEffect, useRef, useState } from "react";

interface TooltipState {
  text: string;
  x: number;
  y: number;
  placement: "bottom" | "top" | "left";
}

export function AppTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const activeTargetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
      activeTargetRef.current = null;
      setTooltip(null);
    };

    const readTooltipText = (el: HTMLElement): string => {
      const existing = el.getAttribute("data-tooltip");
      if (existing) return existing;
      const nativeTitle = el.getAttribute("title");
      if (nativeTitle) {
        el.setAttribute("data-tooltip", nativeTitle);
        el.removeAttribute("title");
        return nativeTitle;
      }
      return "";
    };

    const showFor = (el: HTMLElement, delayMs: number) => {
      const text = readTooltipText(el).trim();
      if (!text) return;
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
      activeTargetRef.current = el;

      const commit = () => {
        if (!el.isConnected || activeTargetRef.current !== el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        const margin = 10;
        if (el.closest(".canvas-vertical-dock, [aria-orientation='vertical']")) {
          setTooltip({
            text,
            x: Math.max(margin, rect.left - 8),
            y: Math.max(margin, Math.min(window.innerHeight - margin, rect.top + rect.height / 2)),
            placement: "left",
          });
          return;
        }
        const estimatedHalf = Math.min(140, Math.max(48, text.length * 3.6 + 14));
        const centerX = rect.left + rect.width / 2;
        const clampedX = Math.max(
          margin + estimatedHalf,
          Math.min(window.innerWidth - margin - estimatedHalf, centerX),
        );
        const placeTop = rect.bottom + 38 > window.innerHeight;
        setTooltip({
          text,
          x: clampedX,
          y: placeTop ? rect.top - 6 : rect.bottom + 6,
          placement: placeTop ? "top" : "bottom",
        });
      };

      if (delayMs <= 0) commit();
      else timerRef.current = window.setTimeout(commit, delayMs);
    };

    const findTarget = (node: EventTarget | null): HTMLElement | null => {
      if (!(node instanceof Element)) return null;
      return node.closest<HTMLElement>("[data-tooltip], [title]");
    };

    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = findTarget(event.target);
      if (!target) {
        clear();
        return;
      }
      if (activeTargetRef.current === target) return;
      showFor(target, 180);
    };

    const onPointerOut = (event: PointerEvent) => {
      if (!activeTargetRef.current) return;
      const next = event.relatedTarget instanceof Element
        ? event.relatedTarget.closest<HTMLElement>("[data-tooltip], [title]")
        : null;
      if (next !== activeTargetRef.current) clear();
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (!event.target.matches(":focus-visible")) return;
      const target = findTarget(event.target);
      if (target) showFor(target, 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clear();
    };

    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);
    document.addEventListener("pointerdown", clear);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", clear);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", clear, true);

    return () => {
      clear();
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", clear);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", clear);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", clear, true);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      className={`app-tooltip ${tooltip.placement}`}
      role="tooltip"
      style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
    >
      {tooltip.text}
    </div>
  );
}
