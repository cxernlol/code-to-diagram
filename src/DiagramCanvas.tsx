import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import type { DiagramDocument, Position, StudioSettings } from "./types";
import {
  detectDiagramType,
  getMermaidErrorLine,
  parseMermaidSvg,
  renderMermaid,
  type DiagramType,
} from "./lib/mermaid";

export interface DiagramCanvasHandle {
  zoomBy: (factor: number) => void;
  fit: () => void;
  reset: () => void;
}

interface DiagramCanvasProps {
  document: DiagramDocument;
  settings: StudioSettings;
  onLayoutChange: (layout: Record<string, Position>) => void;
  onNodeMoved: (id: string) => void;
  onRenderError: (error?: { message: string; line?: number }) => void;
  onTypeChange: (type: DiagramType) => void;
}

function readTranslation(transform: string | null): Position {
  const match = transform?.match(/translate\(\s*(-?[\d.]+)(?:[,\s]+(-?[\d.]+))?/);
  return { x: Number(match?.[1] ?? 0), y: Number(match?.[2] ?? 0) };
}

function cssTransform(transform: ZoomTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
}

function stableNodeId(id: string): string {
  return id.match(/^[^-]+-(.+)-\d+$/)?.[1] ?? id;
}

function pointInRoot(svg: SVGSVGElement, element: SVGGraphicsElement, x: number, y: number) {
  const matrix = element.getCTM();
  if (!matrix) return { x, y };
  const point = svg.createSVGPoint();
  point.x = x;
  point.y = y;
  const rootPoint = point.matrixTransform(matrix);
  return { x: rootPoint.x, y: rootPoint.y };
}

function boundsInRoot(svg: SVGSVGElement, element: SVGGElement) {
  const box = element.getBBox();
  const corners = [
    pointInRoot(svg, element, box.x, box.y),
    pointInRoot(svg, element, box.x + box.width, box.y),
    pointInRoot(svg, element, box.x, box.y + box.height),
    pointInRoot(svg, element, box.x + box.width, box.y + box.height),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    x: left,
    y: top,
    width: Math.max(...xs) - left,
    height: Math.max(...ys) - top,
  };
}

function distanceToBounds(point: Position, bounds: ReturnType<typeof boundsInRoot>) {
  const dx = Math.max(bounds.x - point.x, 0, point.x - bounds.x - bounds.width);
  const dy = Math.max(bounds.y - point.y, 0, point.y - bounds.y - bounds.height);
  return Math.hypot(dx, dy);
}

function clipToBounds(bounds: ReturnType<typeof boundsInRoot>, target: Position): Position {
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const scale = Math.min(
    bounds.width / 2 / Math.max(Math.abs(dx), 0.001),
    bounds.height / 2 / Math.max(Math.abs(dy), 0.001),
  );
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function toLocalPoint(
  svg: SVGSVGElement,
  element: SVGGraphicsElement,
  point: Position,
): Position {
  const matrix = element.getCTM();
  if (!matrix) return point;
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const local = svgPoint.matrixTransform(matrix.inverse());
  return { x: local.x, y: local.y };
}

function routeEdge(
  svg: SVGSVGElement,
  path: SVGPathElement,
  source: SVGGElement,
  target: SVGGElement,
  allNodes: { wrapper: SVGGElement; id: string }[],
) {
  const sourceBounds = boundsInRoot(svg, source);
  const targetBounds = boundsInRoot(svg, target);
  const sourceCenter = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  };
  const targetCenter = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2,
  };
  const start = clipToBounds(sourceBounds, targetCenter);
  const end = clipToBounds(targetBounds, sourceCenter);
  const obstacles = allNodes
    .filter((node) => node.id !== source.dataset.sgsNode && node.id !== target.dataset.sgsNode)
    .map((node) => boundsInRoot(svg, node.wrapper));
  const xCandidates = new Set([
    (start.x + end.x) / 2,
    ...obstacles.flatMap((box) => [box.x - 18, box.x + box.width + 18]),
  ]);
  const yCandidates = new Set([
    (start.y + end.y) / 2,
    ...obstacles.flatMap((box) => [box.y - 18, box.y + box.height + 18]),
  ]);
  const candidates = [
    ...Array.from(xCandidates, (x) => [start, { x, y: start.y }, { x, y: end.y }, end]),
    ...Array.from(yCandidates, (y) => [start, { x: start.x, y }, { x: end.x, y }, end]),
  ].map((points) => points.filter((point, index) => {
    const previous = points[index - 1];
    return !previous || previous.x !== point.x || previous.y !== point.y;
  }));
  const blocked = (a: Position, b: Position, box: ReturnType<typeof boundsInRoot>) => {
    if (a.y === b.y) {
      return (
        a.y > box.y - 8 &&
        a.y < box.y + box.height + 8 &&
        Math.max(Math.min(a.x, b.x), box.x - 8) <
          Math.min(Math.max(a.x, b.x), box.x + box.width + 8)
      );
    }
    return (
      a.x > box.x - 8 &&
      a.x < box.x + box.width + 8 &&
      Math.max(Math.min(a.y, b.y), box.y - 8) <
        Math.min(Math.max(a.y, b.y), box.y + box.height + 8)
    );
  };
  const score = (points: Position[]) => {
    let length = 0;
    let collisions = 0;
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1];
      const b = points[index];
      if (!a || !b) continue;
      length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      collisions += obstacles.filter((box) => blocked(a, b, box)).length;
    }
    return length + (points.length - 2) * 14 + collisions * 100000;
  };
  const best = candidates.sort((a, b) => score(a) - score(b))[0] ?? [start, end];
  const localPoints = best.map((point) => toLocalPoint(svg, path, point));
  path.setAttribute(
    "d",
    localPoints
      .map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`)
      .join(" "),
  );
}

export const DiagramCanvas = forwardRef<DiagramCanvasHandle, DiagramCanvasProps>(function DiagramCanvas(
  { document, settings, onLayoutChange, onNodeMoved, onRenderError, onTypeChange },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const graphicRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const transformRef = useRef<ZoomTransform>(zoomIdentity);
  const zoomFrameRef = useRef<number | undefined>(undefined);
  const settingsRef = useRef(settings);
  const spaceDown = useRef(false);
  const [svgMarkup, setSvgMarkup] = useState("");
  const [rendering, setRendering] = useState(true);
  const [viewTransform, setViewTransform] = useState(zoomIdentity);

  settingsRef.current = settings;
  const applyTransform = useCallback((transform: ZoomTransform) => {
    transformRef.current = transform;
    setViewTransform(transform);
    if (viewportRef.current) {
      const gridSize = Math.max(12, Math.min(32, 20 * transform.k));
      viewportRef.current.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      viewportRef.current.style.backgroundPosition = `${transform.x % gridSize}px ${transform.y % gridSize}px`;
    }
  }, []);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const graphic = graphicRef.current;
    const svg = graphic?.querySelector("svg");
    if (!viewport || !svg) return;
    const box = svg.getBBox();
    if (!box.width || !box.height) return;
    const padding = 48;
    const scale = Math.min(
      (viewport.clientWidth - padding * 2) / box.width,
      (viewport.clientHeight - padding * 2) / box.height,
      2.5,
    );
    const x = (viewport.clientWidth - box.width * scale) / 2 - box.x * scale;
    const y = (viewport.clientHeight - box.height * scale) / 2 - box.y * scale;
    const transform = zoomIdentity.translate(x, y).scale(scale);
    if (zoomRef.current) select(viewport).call(zoomRef.current.transform, transform);
    else applyTransform(transform);
  }, [applyTransform]);

  const reset = useCallback(() => {
    if (!viewportRef.current || !zoomRef.current) return;
    select(viewportRef.current).call(zoomRef.current.transform, zoomIdentity);
  }, []);

  const animateTransform = useCallback((target: ZoomTransform) => {
    const viewport = viewportRef.current;
    const behavior = zoomRef.current;
    if (!viewport || !behavior) return;
    if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
    if (!settingsRef.current.smoothZoom) {
      select(viewport).call(behavior.transform, target);
      return;
    }
    const start = transformRef.current;
    const startedAt = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 160);
      const eased = 1 - (1 - progress) ** 3;
      const current = zoomIdentity
        .translate(start.x + (target.x - start.x) * eased, start.y + (target.y - start.y) * eased)
        .scale(start.k + (target.k - start.k) * eased);
      select(viewport).call(behavior.transform, current);
      if (progress < 1) zoomFrameRef.current = requestAnimationFrame(step);
    };
    zoomFrameRef.current = requestAnimationFrame(step);
  }, []);

  const zoomBy = useCallback((factor: number, center?: [number, number]) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const current = transformRef.current;
    const point = center ?? [viewport.clientWidth / 2, viewport.clientHeight / 2];
    const scale = Math.min(5, Math.max(0.1, current.k * factor));
    const ratio = scale / current.k;
    animateTransform(
      zoomIdentity
        .translate(point[0] - (point[0] - current.x) * ratio, point[1] - (point[1] - current.y) * ratio)
        .scale(scale),
    );
  }, [animateTransform]);

  useImperativeHandle(ref, () => ({ zoomBy, fit, reset }), [fit, reset, zoomBy]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.1, 5])
      .filter((event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (event.type === "wheel") return false;
        if (event.type === "mousedown") {
          return (event as MouseEvent).button === 1 || spaceDown.current;
        }
        if (event.type === "touchstart") {
          return (event as TouchEvent).touches.length > 1 || !target?.closest("[data-sgs-node]");
        }
        return false;
      })
      .on("zoom", (event) => applyTransform(event.transform));
    zoomRef.current = behavior;
    select(viewport).call(behavior).on("dblclick.zoom", null);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const currentSettings = settingsRef.current;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? viewport.clientHeight
          : 1;
      const deltaX = event.deltaX * unit * currentSettings.panSpeed;
      const deltaY = event.deltaY * unit * currentSettings.panSpeed;
      const direction = currentSettings.invertScroll ? -1 : 1;
      if (event.ctrlKey || currentSettings.scrollMode === "zoom") {
        const scaleDelta = Math.exp(-deltaY * 0.002 * currentSettings.zoomSpeed * direction);
        const bounds = viewport.getBoundingClientRect();
        zoomBy(scaleDelta, [event.clientX - bounds.left, event.clientY - bounds.top]);
      } else {
        const scale = Math.max(transformRef.current.k, 0.1);
        select(viewport).call(behavior.translateBy, (-deltaX * direction) / scale, (-deltaY * direction) / scale);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
        spaceDown.current = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceDown.current = false;
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      viewport.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);
      select(viewport).on(".zoom", null);
      zoomRef.current = null;
    };
  }, [applyTransform, zoomBy]);

  useEffect(() => {
    let active = true;
    setRendering(true);
    const timeout = window.setTimeout(() => {
      void renderMermaid(document.code, settings)
        .then((result) => {
          if (!active) return;
          setSvgMarkup(result.svg);
          onTypeChange(result.type);
          onRenderError(undefined);
          setRendering(false);
        })
        .catch((error: unknown) => {
          if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
          onRenderError({
            message: error instanceof Error ? error.message : String(error),
            line: getMermaidErrorLine(error),
          });
          setRendering(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [
    document.code,
    settings.theme,
    settings.look,
    settings.primaryColor,
    settings.textColor,
    settings.lineColor,
    settings.canvasColor,
    settings.font,
    onRenderError,
    onTypeChange,
  ]);

  useEffect(() => {
    const graphic = graphicRef.current;
    if (!graphic || !svgMarkup) return;
    try {
      graphic.replaceChildren(parseMermaidSvg(svgMarkup));
    } catch (error) {
      onRenderError({
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [svgMarkup, onRenderError]);

  useEffect(() => {
    const graphic = graphicRef.current;
    const svg = graphic?.querySelector("svg");
    const viewport = viewportRef.current;
    if (!graphic || !svg || !viewport) return;
    const previousDocumentId = graphic.dataset.documentId;
    graphic.dataset.documentId = document.id;
    if (!["flowchart", "class", "state", "er"].includes(detectDiagramType(document.code))) {
      if (previousDocumentId !== document.id) requestAnimationFrame(() => fit());
      return;
    }
    const candidates = Array.from(
      svg.querySelectorAll<SVGGElement>(
        "g.node, g.statediagram-state, g.entityBox, g.classGroup",
      ),
    ).filter((element) => {
      const hasNodeAncestor = element.parentElement?.closest(
        "g.node, g.statediagram-state, g.entityBox, g.classGroup",
      );
      return !hasNodeAncestor && Boolean(element.id || element.dataset.id);
    });
    const nodes = candidates.map((element) => {
      const id = element.dataset.id || stableNodeId(element.id);
      const base = readTranslation(element.getAttribute("transform"));
      const position = document.layout[id] ?? base;
      const wrapper = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
      wrapper.dataset.sgsNode = id;
      wrapper.setAttribute("tabindex", "0");
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", `Diagram node ${id}. Use arrow keys to move.`);
      wrapper.setAttribute("aria-describedby", "node-movement-help");
      element.parentNode?.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      wrapper.setAttribute(
        "transform",
        `translate(${position.x - base.x},${position.y - base.y})`,
      );
      const currentBounds = () => boundsInRoot(svg, wrapper);
      return { id, base, position, wrapper, element, bounds: currentBounds };
    });
    const edgePaths = Array.from(
      svg.querySelectorAll<SVGPathElement>(
        "g.edgePath path.path, g.edgePath path, g.relation path, g.edge path, path.flowchart-link",
      ),
    ).filter((path) => path.getTotalLength() > 0);
    const labels = Array.from(svg.querySelectorAll<SVGGElement>("g.edgeLabel"));
    const edges = edgePaths.flatMap((path) => {
      const length = path.getTotalLength();
      const start = pointInRoot(svg, path, path.getPointAtLength(0).x, path.getPointAtLength(0).y);
      const end = pointInRoot(svg, path, path.getPointAtLength(length).x, path.getPointAtLength(length).y);
      const nearest = (point: Position) =>
        nodes.reduce<(typeof nodes)[number] | undefined>((best, node) => {
          if (!best || distanceToBounds(point, node.bounds()) < distanceToBounds(point, best.bounds())) {
            return node;
          }
          return best;
        }, undefined);
      const source = nearest(start);
      const target = nearest(end);
      return source && target && source.id !== target.id
        ? [{ path, source, target }]
        : [];
    });
    const labelWrappers = labels.slice(0, edges.length).map((label) => {
      const box = boundsInRoot(svg, label);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const wrapper = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "g");
      label.parentNode?.insertBefore(wrapper, label);
      wrapper.appendChild(label);
      return { wrapper, center };
    });
    const routeEdges = () => {
      edges.forEach(({ path, source, target }, index) => {
        routeEdge(svg, path, source.wrapper, target.wrapper, nodes);
        const label = labelWrappers[index];
        if (!label) return;
        const point = pointInRoot(svg, path, path.getPointAtLength(path.getTotalLength() / 2).x,
          path.getPointAtLength(path.getTotalLength() / 2).y);
        const local = toLocalPoint(svg, label.wrapper, point);
        const labelLocal = toLocalPoint(svg, label.wrapper, label.center);
        label.wrapper.setAttribute(
          "transform",
          `translate(${local.x - labelLocal.x},${local.y - labelLocal.y})`,
        );
      });
    };
    routeEdges();

    const initialLayout = { ...document.layout };
    const nodeIds = new Set(nodes.map((node) => node.id));
    const trimmedLayout = Object.fromEntries(
      Object.entries(document.layout).filter(([id]) => nodeIds.has(id)),
    );
    if (Object.keys(trimmedLayout).length !== Object.keys(document.layout).length) {
      onLayoutChange(trimmedLayout);
    }
    let moved = false;
    const setPosition = (node: (typeof nodes)[number], position: Position) => {
      node.position = position;
      node.wrapper.setAttribute(
        "transform",
        `translate(${position.x - node.base.x},${position.y - node.base.y})`,
      );
      moved = true;
      routeEdges();
    };
    const finishDrag = (id: string) => {
      if (!moved) return;
      const next = { ...initialLayout };
      nodes.forEach(({ id, position, base }) => {
        if (Math.abs(position.x - base.x) > 0.01 || Math.abs(position.y - base.y) > 0.01) {
          next[id] = position;
        } else {
          delete next[id];
        }
      });
      onLayoutChange(next);
      onNodeMoved(id);
      moved = false;
    };
    nodes.forEach((node) => {
      let pointerStart: { id: number; x: number; y: number; position: Position } | undefined;
      const onPointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        pointerStart = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          position: { ...node.position },
        };
        node.wrapper.setPointerCapture(event.pointerId);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        const zoomScale = Math.max(transformRef.current.k, 0.1);
        const precision = event.shiftKey ? 0.25 : 1;
        const speed = settingsRef.current.dragSpeed * precision;
        let x = pointerStart.position.x + ((event.clientX - pointerStart.x) / zoomScale) * speed;
        let y = pointerStart.position.y + ((event.clientY - pointerStart.y) / zoomScale) * speed;
        if (settingsRef.current.snapEnabled && !event.altKey) {
          const size = Math.max(4, settingsRef.current.snapSize);
          x = Math.round(x / size) * size;
          y = Math.round(y / size) * size;
        }
        if (
          Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4 &&
          (Math.abs(x - pointerStart.position.x) + Math.abs(y - pointerStart.position.y) > 0.5)
        ) {
          setPosition(node, { x, y });
        }
      };
      const onPointerUp = (event: PointerEvent) => {
        if (!pointerStart || event.pointerId !== pointerStart.id) return;
        pointerStart = undefined;
        if (node.wrapper.hasPointerCapture(event.pointerId)) {
          node.wrapper.releasePointerCapture(event.pointerId);
        }
        finishDrag(node.id);
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const step = event.shiftKey ? 20 : 4;
        const next = { ...node.position };
        if (event.key === "ArrowUp") next.y -= step;
        if (event.key === "ArrowDown") next.y += step;
        if (event.key === "ArrowLeft") next.x -= step;
        if (event.key === "ArrowRight") next.x += step;
        setPosition(node, next);
        finishDrag(node.id);
      };
      node.wrapper.addEventListener("pointerdown", onPointerDown);
      node.wrapper.addEventListener("pointermove", onPointerMove);
      node.wrapper.addEventListener("pointerup", onPointerUp);
      node.wrapper.addEventListener("pointercancel", onPointerUp);
      node.wrapper.addEventListener("keydown", onKeyDown);
      node.wrapper.dataset.sgsListeners = "true";
    });

    if (previousDocumentId !== document.id) {
      requestAnimationFrame(() => fit());
    }

    return () => {
      nodes.forEach(({ wrapper }) => {
        wrapper.replaceWith(...Array.from(wrapper.childNodes));
      });
      labelWrappers.forEach(({ wrapper }) => {
        wrapper.replaceWith(...Array.from(wrapper.childNodes));
      });
    };
  }, [svgMarkup, document.id, document.layout, onLayoutChange, onNodeMoved, fit]);

  return (
    <div
      className="diagram-viewport"
      ref={viewportRef}
      style={{ backgroundColor: settings.canvasColor }}
      role="group"
      aria-label={`Diagram preview. ${settings.scrollMode === "zoom" ? "Scroll to zoom" : "Scroll to pan; Ctrl+scroll to zoom"}, drag empty space to pan, and drag a node to move it.`}
    >
      <div
        className="diagram-graphic"
        ref={graphicRef}
        style={{ fontFamily: settings.font, transform: cssTransform(viewTransform) }}
      />
      {rendering && <div className="render-indicator" aria-live="polite">Rendering…</div>}
      {!svgMarkup && !rendering && (
        <div className="render-empty" role="status">Enter valid Mermaid syntax to preview.</div>
      )}
    </div>
  );
});
