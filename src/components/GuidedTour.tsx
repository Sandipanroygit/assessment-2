"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { playUiClickTone } from "@/lib/uiTone";

export type GuidedTourPlacement = "top" | "bottom" | "left" | "right";

export type GuidedTourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  placement?: GuidedTourPlacement;
  padding?: number;
  scrollBlock?: "start" | "center";
  forcePageTop?: boolean;
  lockTooltipPositionToPrev?: boolean;
  adjacentOnly?: boolean;
};

type GuidedTourProps = {
  run: boolean;
  stepIndex: number;
  steps: GuidedTourStep[];
  onStepIndexChange: (nextIndex: number) => void;
  onClose: (completed: boolean) => void;
  displayStepOffset?: number;
  displayStepTotal?: number;
  enableCardShifting?: boolean;
  palette?: {
    accent: string;
    accentStrong: string;
  };
};

type GuidedTourCustomPosition = {
  top: number;
  left: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const TOOLTIP_GAP = 8;
const CUSTOM_POSITION_STORAGE_KEY = "guided_tour_custom_positions_v1";
const getScrollBehavior = (): ScrollBehavior =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
const getViewportSize = () => {
  if (typeof window === "undefined") return { width: 0, height: 0 };
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
  };
};

const getIntersectionAreaWithViewport = (rect: DOMRect, viewportWidth: number, viewportHeight: number) => {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return width * height;
};

const hasRenderableBox = (node: HTMLElement) => {
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isVisiblyRenderable = (node: HTMLElement) => {
  const style = window.getComputedStyle(node);
  if (style.display === "none") return false;
  if (style.visibility === "hidden" || style.visibility === "collapse") return false;
  const opacity = Number.parseFloat(style.opacity || "1");
  if (Number.isFinite(opacity) && opacity <= 0.01) return false;
  return hasRenderableBox(node);
};

const resolveTargetNode = (selector: string): HTMLElement | null => {
  const allMatches = Array.from(document.querySelectorAll(selector)).filter(
    (node): node is HTMLElement => node instanceof HTMLElement && node.isConnected,
  );
  if (allMatches.length === 0) return null;

  const measurable = allMatches.filter((node) => hasRenderableBox(node));
  if (measurable.length === 0) return null;

  const visible = measurable.filter((node) => isVisiblyRenderable(node));
  const candidates = visible.length > 0 ? visible : measurable;
  const viewport = getViewportSize();
  const viewportCenterX = viewport.width / 2;
  const viewportCenterY = viewport.height / 2;

  const scored = candidates.map((node, index) => {
    const rect = node.getBoundingClientRect();
    const area = Math.max(1, rect.width * rect.height);
    const intersection = getIntersectionAreaWithViewport(rect, viewport.width, viewport.height);
    const visibleRatio = intersection / area;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.hypot(centerX - viewportCenterX, centerY - viewportCenterY);
    const score = visibleRatio * 1200 - distance * 0.12 - index * 0.01;
    return { node, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.node ?? null;
};

const scrollTargetIntoView = (
  node: HTMLElement,
  placement: GuidedTourPlacement,
  panelHeight: number,
  targetPadding: number,
  scrollBlock: "start" | "center",
  forcePageTop: boolean,
  scrollBehavior: ScrollBehavior = getScrollBehavior(),
) => {
  if (forcePageTop) {
    if (window.scrollY > 1) {
      window.scrollTo({ top: 0, behavior: scrollBehavior });
    }
    return;
  }

  const margin = 20;
  const panelGap = TOOLTIP_GAP;
  const viewport = getViewportSize();
  const aspectAwarePanelBudget = Math.max(180, Math.min(420, viewport.height * 0.62));
  const resolvedPanelHeight = Math.max(180, Math.min(panelHeight, aspectAwarePanelBudget));
  const rect = node.getBoundingClientRect();
  const paddedTop = rect.top - targetPadding;
  const paddedBottom = rect.bottom + targetPadding;
  const viewportTop = margin;
  const viewportBottom = viewport.height - margin;
  const maxScrollY = Math.max(0, document.documentElement.scrollHeight - viewport.height);

  let deltaY = 0;
  if (scrollBlock === "start") {
    // Hard align target to the top edge with no reserved gap.
    deltaY += rect.top;
  } else if (paddedTop < viewportTop) {
    deltaY += paddedTop - viewportTop;
  } else if (paddedBottom > viewportBottom) {
    deltaY += paddedBottom - viewportBottom;
  }

  const adjustedTop = paddedTop - deltaY;
  const adjustedBottom = paddedBottom - deltaY;
  if (placement === "bottom") {
    const tooltipBottom = adjustedBottom + panelGap + resolvedPanelHeight;
    const allowedBottom = viewport.height - margin;
    if (tooltipBottom > allowedBottom) {
      deltaY += tooltipBottom - allowedBottom;
    }
  } else if (placement === "top") {
    const tooltipTop = adjustedTop - panelGap - resolvedPanelHeight;
    const allowedTop = margin;
    if (tooltipTop < allowedTop) {
      deltaY += tooltipTop - allowedTop;
    }
  } else {
    const centerY = (adjustedTop + adjustedBottom) / 2;
    const tooltipTop = centerY - resolvedPanelHeight / 2;
    const tooltipBottom = centerY + resolvedPanelHeight / 2;
    if (tooltipTop < margin) {
      deltaY += tooltipTop - margin;
    }
    if (tooltipBottom > viewport.height - margin) {
      deltaY += tooltipBottom - (viewport.height - margin);
    }
  }

  const nextScrollY = window.scrollY + deltaY;
  const clampedNextScrollY = clamp(nextScrollY, 0, maxScrollY);
  if (Math.abs(clampedNextScrollY - window.scrollY) > 1) {
    window.scrollTo({ top: clampedNextScrollY, behavior: scrollBehavior });
  }
};

const computeTooltipPosition = ({
  rect,
  placement,
  viewportWidth,
  viewportHeight,
  tooltipWidth,
  tooltipHeight,
  previousPosition,
  adjacentOnly = false,
}: {
  rect: DOMRect;
  placement: GuidedTourPlacement;
  viewportWidth: number;
  viewportHeight: number;
  tooltipWidth: number;
  tooltipHeight: number;
  previousPosition?: { top: number; left: number } | null;
  adjacentOnly?: boolean;
}) => {
  const margin = 10;
  const resolvedTooltipHeight = Math.max(140, Math.min(tooltipHeight, Math.max(180, Math.min(420, viewportHeight - margin * 2))));
  const oppositePlacement: Record<GuidedTourPlacement, GuidedTourPlacement> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };
  const candidates = (
    adjacentOnly
      ? [placement, oppositePlacement[placement]]
      : [placement, oppositePlacement[placement], "bottom", "top", "right", "left"]
  ).filter((item, index, self): item is GuidedTourPlacement => self.indexOf(item) === index);
  const maxTop = Math.max(margin, viewportHeight - resolvedTooltipHeight - margin);
  const maxLeft = Math.max(margin, viewportWidth - tooltipWidth - margin);
  const overlapArea = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) => {
    const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return overlapX * overlapY;
  };
  const edgeDistance = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) => {
    const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
    const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
    return Math.hypot(dx, dy);
  };

  const scored = candidates.map((candidate, preferenceIndex) => {
    let top = rect.top + rect.height + TOOLTIP_GAP;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (candidate === "top") {
      top = rect.top - resolvedTooltipHeight - TOOLTIP_GAP;
    } else if (candidate === "left") {
      top = rect.top + rect.height / 2 - resolvedTooltipHeight / 2;
      left = rect.left - tooltipWidth - TOOLTIP_GAP;
    } else if (candidate === "right") {
      top = rect.top + rect.height / 2 - resolvedTooltipHeight / 2;
      left = rect.right + TOOLTIP_GAP;
    }

    const rawTop = top;
    const rawLeft = left;
    const clampedTop = clamp(top, margin, maxTop);
    const clampedLeft = clamp(left, margin, maxLeft);
    const tooltipRect = {
      left: clampedLeft,
      top: clampedTop,
      right: clampedLeft + tooltipWidth,
      bottom: clampedTop + resolvedTooltipHeight,
    };
    const targetRect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
    const overlap = overlapArea(tooltipRect, targetRect);
    const gapDistance = edgeDistance(tooltipRect, targetRect);
    const clampShift = Math.hypot(clampedLeft - rawLeft, clampedTop - rawTop);
    const tooltipCenterX = (tooltipRect.left + tooltipRect.right) / 2;
    const tooltipCenterY = (tooltipRect.top + tooltipRect.bottom) / 2;
    const targetCenterX = (targetRect.left + targetRect.right) / 2;
    const targetCenterY = (targetRect.top + targetRect.bottom) / 2;
    const centerDistance = Math.hypot(tooltipCenterX - targetCenterX, tooltipCenterY - targetCenterY);
    const movePenalty = previousPosition
      ? Math.hypot(clampedLeft - previousPosition.left, clampedTop - previousPosition.top)
      : 0;
    const score =
      overlap * 6000 +
      clampShift * 26 +
      gapDistance * 6 +
      centerDistance * 0.08 +
      movePenalty * 0.12 +
      preferenceIndex * 3;
    return { top: clampedTop, left: clampedLeft, score, overlap, clampShift, preferenceIndex };
  });

  if (adjacentOnly) {
    const nonOverlapping = scored
      .filter((entry) => entry.overlap <= 0.5)
      .sort((a, b) => {
        if (a.preferenceIndex !== b.preferenceIndex) return a.preferenceIndex - b.preferenceIndex;
        return a.clampShift - b.clampShift;
      });
    if (nonOverlapping.length > 0) {
      return { top: nonOverlapping[0].top, left: nonOverlapping[0].left };
    }
  }

  const best = scored.sort((a, b) => a.score - b.score)[0];
  return { top: best.top, left: best.left };
};

export function GuidedTour({
  run,
  stepIndex,
  steps,
  onStepIndexChange,
  onClose,
  displayStepOffset = 0,
  displayStepTotal,
  enableCardShifting = false,
  palette,
}: GuidedTourProps) {
  const [mounted, setMounted] = useState(false);
  const [targetNode, setTargetNode] = useState<HTMLElement | null>(null);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [tooltipHeight, setTooltipHeight] = useState(188);
  const highlightedNodesRef = useRef<Array<{
    node: HTMLElement;
    position: string;
    zIndex: string;
    outline: string;
    outlineOffset: string;
    boxShadow: string;
  }>>([]);
  const lastTooltipPosRef = useRef<{ top: number; left: number } | null>(null);
  const lastTooltipPosStepRef = useRef<number>(-1);
  const overlapFixStateRef = useRef<{ step: number; count: number }>({ step: -1, count: 0 });
  const tooltipRef = useRef<HTMLElement | null>(null);
  const tooltipPrevPosRef = useRef<{ top: number; left: number } | null>(null);
  const tooltipPrevStepRef = useRef<number>(-1);
  const [customPositions, setCustomPositions] = useState<Record<string, GuidedTourCustomPosition>>({});
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const [dragPosition, setDragPosition] = useState<GuidedTourCustomPosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragBoundsRef = useRef<{ maxTop: number; maxLeft: number }>({ maxTop: 14, maxLeft: 14 });
  const stepPositionKeyRef = useRef<string | null>(null);
  const accentColor = palette?.accent ?? "var(--accent)";
  const accentStrongColor = palette?.accentStrong ?? "var(--accent-strong)";
  const accentColorRef = useRef(accentColor);

  const step = steps[stepIndex] ?? null;
  const stepPositionKey = useMemo(() => {
    if (!mounted || !step || typeof window === "undefined") return null;
    return `${window.location.pathname}::${step.id}`;
  }, [mounted, step]);
  const storedStepPosition = stepPositionKey ? customPositions[stepPositionKey] ?? null : null;

  const clearTargetHighlight = useCallback(() => {
    highlightedNodesRef.current.forEach((entry) => {
      entry.node.style.position = entry.position;
      entry.node.style.zIndex = entry.zIndex;
      entry.node.style.outline = entry.outline;
      entry.node.style.outlineOffset = entry.outlineOffset;
      entry.node.style.boxShadow = entry.boxShadow;
    });
    highlightedNodesRef.current = [];
  }, []);

  useEffect(() => {
    setMounted(true);
    setViewport(getViewportSize());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_POSITION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;

      const next: Record<string, GuidedTourCustomPosition> = {};
      Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
        if (!value || typeof value !== "object") return;
        const top = (value as { top?: unknown }).top;
        const left = (value as { left?: unknown }).left;
        if (typeof top === "number" && Number.isFinite(top) && typeof left === "number" && Number.isFinite(left)) {
          next[key] = { top, left };
        }
      });
      setCustomPositions(next);
    } catch {
      // ignore malformed storage
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      window.localStorage.setItem(CUSTOM_POSITION_STORAGE_KEY, JSON.stringify(customPositions));
    } catch {
      // ignore storage write failures
    }
  }, [customPositions, mounted]);

  useEffect(() => {
    accentColorRef.current = accentColor;
  }, [accentColor]);

  useEffect(() => {
    dragStateRef.current = null;
    setDragPosition(null);
    setIsDragging(false);
  }, [run, stepIndex]);

  useEffect(() => {
    if (!run) return;
    if (!step) {
      onClose(true);
      return;
    }
    setTargetNode(null);
    setTargetRect(null);

    let attempts = 0;
    let timerId: number | null = null;
    let rafIdA: number | null = null;
    let rafIdB: number | null = null;

    const locateTarget = () => {
      const node = resolveTargetNode(step.target);
      if (!node) {
        attempts += 1;
        if (attempts >= 10) {
          const next = stepIndex + 1;
          if (next >= steps.length) {
            onClose(true);
          } else {
            onStepIndexChange(next);
          }
          return;
        }
        timerId = window.setTimeout(locateTarget, 220);
        return;
      }

      const forcePageTop = step.forcePageTop ?? true;
      if (forcePageTop && window.scrollY > 1) {
        window.scrollTo({ top: 0, behavior: "auto" });
      } else if (!forcePageTop) {
        // If the target is inside an overflow container, reveal it before measuring.
        try {
          node.scrollIntoView({
            behavior: "auto",
            block: step.scrollBlock === "start" ? "start" : "center",
            inline: "nearest",
          });
        } catch {
          node.scrollIntoView();
        }
      }

      setTargetNode(node);
      if (!forcePageTop) {
        // Keep movement minimal while making room for the tour panel in the viewport.
        scrollTargetIntoView(
          node,
          step.placement ?? "bottom",
          tooltipHeight,
          step.padding ?? 10,
          step.scrollBlock ?? "center",
          forcePageTop,
          "auto",
        );
      }
      rafIdA = window.requestAnimationFrame(() => {
        setTargetRect(node.getBoundingClientRect());
        rafIdB = window.requestAnimationFrame(() => {
          setTargetRect(node.getBoundingClientRect());
        });
      });
    };

    locateTarget();

    return () => {
      if (timerId) window.clearTimeout(timerId);
      if (rafIdA) window.cancelAnimationFrame(rafIdA);
      if (rafIdB) window.cancelAnimationFrame(rafIdB);
    };
  }, [onClose, onStepIndexChange, run, step, stepIndex, steps, tooltipHeight]);

  useEffect(() => {
    if (!run || !step || !targetNode) return;

    let activeNode = targetNode;
    const resolveActiveNode = () => {
      if (activeNode.isConnected && isVisiblyRenderable(activeNode)) {
        return activeNode;
      }
      const resolved = resolveTargetNode(step.target);
      if (resolved) {
        activeNode = resolved;
        setTargetNode(resolved);
      }
      return resolved;
    };

    const syncRect = () => {
      setViewport(getViewportSize());
      const node = resolveActiveNode();
      if (!node) return;
      const nextRect = node.getBoundingClientRect();
      if (nextRect.width === 0 || nextRect.height === 0) return;
      setTargetRect(nextRect);
    };

    syncRect();
    const pollId = window.setInterval(syncRect, 100);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncRect) : null;
    const vv = window.visualViewport;
    resizeObserver?.observe(activeNode);
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);
    vv?.addEventListener("resize", syncRect);
    vv?.addEventListener("scroll", syncRect);

    return () => {
      window.clearInterval(pollId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
      vv?.removeEventListener("resize", syncRect);
      vv?.removeEventListener("scroll", syncRect);
    };
  }, [run, step, stepIndex, targetNode]);

  useEffect(() => {
    if (!run || !targetNode) return;
    const currentAccentColor = accentColorRef.current;

    clearTargetHighlight();
    const captured: Array<{
      node: HTMLElement;
      position: string;
      zIndex: string;
      outline: string;
      outlineOffset: string;
      boxShadow: string;
    }> = [];

    captured.push({
      node: targetNode,
      position: targetNode.style.position,
      zIndex: targetNode.style.zIndex,
      outline: targetNode.style.outline,
      outlineOffset: targetNode.style.outlineOffset,
      boxShadow: targetNode.style.boxShadow,
    });
    const computedStyle = window.getComputedStyle(targetNode);
    if (computedStyle.position === "static") {
      targetNode.style.position = "relative";
    }
    targetNode.style.zIndex = "10001";

    highlightedNodesRef.current = captured;
    targetNode.style.outline = `4px solid ${currentAccentColor}`;
    targetNode.style.outlineOffset = "2px";
    targetNode.style.boxShadow = `0 0 0 1px color-mix(in srgb, ${currentAccentColor} 35%, transparent)`;

    return () => {
      clearTargetHighlight();
    };
  }, [clearTargetHighlight, run, stepIndex, targetNode]);

  useEffect(() => {
    if (run) return;
    clearTargetHighlight();
    lastTooltipPosRef.current = null;
    lastTooltipPosStepRef.current = -1;
    tooltipPrevPosRef.current = null;
    tooltipPrevStepRef.current = -1;
  }, [clearTargetHighlight, run]);

  useEffect(() => () => clearTargetHighlight(), [clearTargetHighlight]);

  useEffect(() => {
    if (!run) return;
    overlapFixStateRef.current = { step: stepIndex, count: 0 };
  }, [run, stepIndex]);

  useEffect(() => {
    if (!run) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void playUiClickTone();
        onClose(false);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void playUiClickTone();
        if (stepIndex >= steps.length - 1) {
          onClose(true);
        } else {
          onStepIndexChange(stepIndex + 1);
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (stepIndex > 0) {
          void playUiClickTone();
          onStepIndexChange(stepIndex - 1);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onStepIndexChange, run, stepIndex, steps.length]);

  const paddedRect = useMemo(() => {
    if (!targetRect || !step) return null;
    const padding = step.padding ?? 10;
    const top = clamp(targetRect.top - padding, 0, viewport.height);
    const left = clamp(targetRect.left - padding, 0, viewport.width);
    const right = clamp(targetRect.right + padding, 0, viewport.width);
    const bottom = clamp(targetRect.bottom + padding, 0, viewport.height);
    return {
      top,
      left,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [step, targetRect, viewport.height, viewport.width]);

  const tooltipMaxWidth = Math.max(280, viewport.width - 24);
  const tooltipWidth = clamp(360, 280, tooltipMaxWidth);
  const isTargetReady =
    !!step && !!targetNode && paddedRect !== null && paddedRect.width > 0 && paddedRect.height > 0;
  const lockedTooltipPos =
    step?.lockTooltipPositionToPrev && lastTooltipPosRef.current
      ? lastTooltipPosRef.current
      : null;
  const computedTooltipPos = isTargetReady
    ? (lockedTooltipPos ?? computeTooltipPosition({
        rect: {
          ...paddedRect,
          x: paddedRect.left,
          y: paddedRect.top,
          bottom: paddedRect.top + paddedRect.height,
          right: paddedRect.left + paddedRect.width,
          toJSON: () => ({}),
        } as DOMRect,
        placement: step.placement ?? "bottom",
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        tooltipWidth,
        tooltipHeight,
        previousPosition:
          lastTooltipPosStepRef.current === stepIndex
            ? lastTooltipPosRef.current
            : null,
        adjacentOnly: step.adjacentOnly ?? false,
      }))
    : null;

  if (computedTooltipPos) {
    lastTooltipPosRef.current = computedTooltipPos;
    lastTooltipPosStepRef.current = stepIndex;
  }

  const hasTooltipPosForCurrentStep =
    lastTooltipPosStepRef.current === stepIndex && !!lastTooltipPosRef.current;
  const manualTooltipPos = dragPosition ?? storedStepPosition;
  const hasManualTooltipPos = manualTooltipPos !== null;
  const tooltipPos = manualTooltipPos ?? computedTooltipPos ?? (hasTooltipPosForCurrentStep ? lastTooltipPosRef.current : null) ?? {
      top: Math.max(16, viewport.height / 2 - 80),
      left: Math.max(16, viewport.width / 2 - tooltipWidth / 2),
    };
  const canRenderTooltip = isTargetReady || hasTooltipPosForCurrentStep;
  const tooltipHeightForClamp = Math.max(140, Math.min(tooltipHeight, Math.max(140, viewport.height - 28)));
  const maxTooltipTop = Math.max(14, viewport.height - tooltipHeightForClamp - 14);
  const maxTooltipLeft = Math.max(14, viewport.width - tooltipWidth - 14);
  const maxManualTooltipTop = Math.max(14, viewport.height + 1200);
  const tooltipTop = Math.round(
    hasManualTooltipPos ? clamp(tooltipPos.top, 14, maxManualTooltipTop) : clamp(tooltipPos.top, 14, maxTooltipTop),
  );
  const tooltipLeft = Math.round(clamp(tooltipPos.left, 14, maxTooltipLeft));

  useEffect(() => {
    dragBoundsRef.current = { maxTop: maxManualTooltipTop, maxLeft: maxTooltipLeft };
    stepPositionKeyRef.current = stepPositionKey;
  }, [maxManualTooltipTop, maxTooltipLeft, stepPositionKey]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      const bounds = dragBoundsRef.current;
      const nextTop = dragState.startTop + (event.clientY - dragState.startY);
      const nextLeft = dragState.startLeft + (event.clientX - dragState.startX);
      setDragPosition({
        top: clamp(nextTop, 14, bounds.maxTop),
        left: clamp(nextLeft, 14, bounds.maxLeft),
      });
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      event.preventDefault();
      const bounds = dragBoundsRef.current;
      const finalPosition = {
        top: clamp(dragState.startTop + (event.clientY - dragState.startY), 14, bounds.maxTop),
        left: clamp(dragState.startLeft + (event.clientX - dragState.startX), 14, bounds.maxLeft),
      };
      dragStateRef.current = null;
      setIsDragging(false);
      setDragPosition(finalPosition);
      const key = stepPositionKeyRef.current;
      if (key) {
        setCustomPositions((prev) => ({ ...prev, [key]: finalPosition }));
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!run || !mounted) return;
    const node = tooltipRef.current;
    if (!node) return;
    const nextHeight = node.getBoundingClientRect().height;
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    if (Math.abs(nextHeight - tooltipHeight) > 1) {
      setTooltipHeight(nextHeight);
    }
  }, [mounted, run, stepIndex, tooltipHeight, viewport.height, viewport.width]);

  useEffect(() => {
    if (!run || !mounted) return;
    const node = tooltipRef.current;
    if (!node) return;

    const prev = tooltipPrevPosRef.current;
    const next = { top: tooltipTop, left: tooltipLeft };
    const isNewStep = tooltipPrevStepRef.current !== stepIndex;
    const rawDx = prev ? prev.left - next.left : 0;
    const rawDy = prev ? prev.top - next.top : 0;
    const dx = clamp(rawDx, -140, 140);
    const dy = clamp(rawDy, -140, 140);

    let animation: Animation | null = null;
    if (!prev) {
      animation = node.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(0.985)" },
          { opacity: 1, transform: "translateY(0) scale(1)" },
        ],
        { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    } else if (isNewStep) {
      animation = node.animate(
        [
          { opacity: 0.9, transform: `translate(${dx}px, ${dy}px) scale(0.985)` },
          { opacity: 1, transform: "translate(0, 0) scale(1)" },
        ],
        { duration: 340, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }

    tooltipPrevPosRef.current = next;
    tooltipPrevStepRef.current = stepIndex;
    return () => animation?.cancel();
  }, [mounted, run, stepIndex, tooltipLeft, tooltipTop]);

  useEffect(() => {
    if (!run || !mounted || !canRenderTooltip || hasManualTooltipPos) return;
    let timerIdA: number | null = null;
    let timerIdB: number | null = null;
    let rafId: number | null = null;
    const panelNode = tooltipRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && panelNode
        ? new ResizeObserver(() => {
            scheduleEnsurePanelVisible(false);
          })
        : null;

    const ensurePanelVisible = (recenterTarget: boolean) => {
      const forcePageTop = step?.forcePageTop ?? true;
      if (forcePageTop) {
        if (window.scrollY > 1) {
          window.scrollTo({ top: 0, behavior: "auto" });
        }
        return;
      }

      const activeTarget = targetNode && targetNode.isConnected ? targetNode : null;
      if (activeTarget && step && recenterTarget) {
        scrollTargetIntoView(
          activeTarget,
          step.placement ?? "bottom",
          tooltipHeight,
          step.padding ?? 10,
          step.scrollBlock ?? "center",
          forcePageTop,
          "auto",
        );
        setTargetRect(activeTarget.getBoundingClientRect());
      }
      if (activeTarget && activeTarget.isConnected && !recenterTarget) {
        setTargetRect(activeTarget.getBoundingClientRect());
      }
    };

    const scheduleEnsurePanelVisible = (recenterTarget: boolean) => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        ensurePanelVisible(recenterTarget);
      });
    };

    ensurePanelVisible(true);
    timerIdA = window.setTimeout(() => scheduleEnsurePanelVisible(true), 220);
    timerIdB = window.setTimeout(() => scheduleEnsurePanelVisible(true), 520);
    const onViewportChange = () => scheduleEnsurePanelVisible(false);
    window.addEventListener("resize", onViewportChange, { passive: true });
    document.addEventListener("transitionend", onViewportChange, true);
    if (resizeObserver && panelNode) {
      resizeObserver.observe(panelNode);
    }
    return () => {
      if (timerIdA) window.clearTimeout(timerIdA);
      if (timerIdB) window.clearTimeout(timerIdB);
      if (rafId) window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onViewportChange);
      document.removeEventListener("transitionend", onViewportChange, true);
    };
  }, [canRenderTooltip, hasManualTooltipPos, mounted, run, step, stepIndex, targetNode, tooltipHeight]);

  useEffect(() => {
    if (!run || !mounted || !canRenderTooltip || hasManualTooltipPos || !targetNode || !targetNode.isConnected) return;
    const forcePageTop = step?.forcePageTop ?? true;
    if (forcePageTop) return;
    const tooltipNode = tooltipRef.current;
    if (!tooltipNode) return;

    const target = targetNode.getBoundingClientRect();
    if (target.width <= 0 || target.height <= 0) return;

    const tip = tooltipNode.getBoundingClientRect();
    const overlapX = Math.max(0, Math.min(target.right, tip.right) - Math.max(target.left, tip.left));
    const overlapY = Math.max(0, Math.min(target.bottom, tip.bottom) - Math.max(target.top, tip.top));
    const overlapArea = overlapX * overlapY;

    const state = overlapFixStateRef.current;
    if (state.step !== stepIndex) {
      state.step = stepIndex;
      state.count = 0;
    }
    if (overlapArea <= 0) {
      state.count = 0;
      return;
    }
    if (state.count >= 3) return;

    const gap = TOOLTIP_GAP + 4;
    const placement = step?.placement ?? "bottom";
    let deltaY = 0;

    if (placement === "bottom") {
      deltaY = target.bottom + gap - tip.top;
    } else if (placement === "top") {
      deltaY = -(tip.bottom + gap - target.top);
    } else {
      const pushUp = target.bottom + gap - tip.top;
      const pushDown = tip.bottom + gap - target.top;
      deltaY = Math.abs(pushUp) <= Math.abs(pushDown) ? pushUp : -pushDown;
    }

    if (!Number.isFinite(deltaY) || Math.abs(deltaY) <= 1) return;
    const viewport = getViewportSize();
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - viewport.height);
    const nextScrollY = clamp(window.scrollY + deltaY, 0, maxScrollY);
    if (Math.abs(nextScrollY - window.scrollY) <= 1) return;

    state.count += 1;
    window.scrollTo({ top: nextScrollY, behavior: "auto" });
    window.requestAnimationFrame(() => {
      if (targetNode && targetNode.isConnected) {
        setTargetRect(targetNode.getBoundingClientRect());
      }
    });
  }, [canRenderTooltip, hasManualTooltipPos, mounted, run, step, stepIndex, targetNode, tooltipLeft, tooltipTop, tooltipWidth]);

  if (!mounted || !run || !step) return null;

  const shownStepNumber = displayStepOffset + stepIndex + 1;
  const shownStepTotal = displayStepTotal ?? steps.length;
  const isFinalShownStep = shownStepNumber >= shownStepTotal;

  const onNext = () => {
    void playUiClickTone();
    if (stepIndex >= steps.length - 1) {
      onClose(true);
      return;
    }
    onStepIndexChange(stepIndex + 1);
  };

  const onPrev = () => {
    if (stepIndex <= 0) return;
    void playUiClickTone();
    onStepIndexChange(stepIndex - 1);
  };

  return createPortal(
    <>
      <aside
        role="dialog"
        aria-modal="true"
        ref={tooltipRef}
        style={{
          position: "fixed",
          zIndex: 10002,
          top: tooltipTop,
          left: tooltipLeft,
          width: tooltipWidth,
          maxHeight: "min(420px, calc(100dvh - 28px))",
          overflowY: "auto",
          visibility: canRenderTooltip ? "visible" : "hidden",
          borderRadius: 14,
          border: `1px solid color-mix(in srgb, ${accentColor} 28%, transparent)`,
          background: "var(--surface)",
          color: "var(--foreground)",
          boxShadow:
            `0 18px 42px rgba(15, 23, 42, 0.18), 0 0 0 1px color-mix(in srgb, ${accentColor} 12%, transparent)`,
          padding: "14px 14px 12px",
          transition: isDragging ? "none" : "top 140ms ease-out, left 140ms ease-out",
          willChange: "transform, opacity, top, left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 999,
              border: `1px solid color-mix(in srgb, ${accentColor} 40%, transparent)`,
              background: `color-mix(in srgb, ${accentColor} 10%, #ffffff)`,
              padding: "2px 10px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: accentStrongColor,
            }}
          >
            Step {shownStepNumber} / {shownStepTotal}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {enableCardShifting && (
              <>
                <button
                  type="button"
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    dragStateRef.current = {
                      pointerId: event.pointerId,
                      startX: event.clientX,
                      startY: event.clientY,
                      startTop: tooltipTop,
                      startLeft: tooltipLeft,
                    };
                    setIsDragging(true);
                    setDragPosition({ top: tooltipTop, left: tooltipLeft });
                  }}
                  style={{
                    borderRadius: 8,
                    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                    background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                    color: accentStrongColor,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: isDragging ? "grabbing" : "grab",
                    userSelect: "none",
                    touchAction: "none",
                  }}
                  aria-label="Drag and fix card position for this step"
                  title="Drag to move this card"
                >
                  Drag
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseTop = manualTooltipPos?.top ?? tooltipTop;
                    const baseLeft = manualTooltipPos?.left ?? tooltipLeft;
                    const nextPosition = {
                      top: clamp(baseTop + 140, 14, maxManualTooltipTop),
                      left: clamp(baseLeft, 14, maxTooltipLeft),
                    };
                    setDragPosition(nextPosition);
                    if (stepPositionKey) {
                      setCustomPositions((prev) => ({ ...prev, [stepPositionKey]: nextPosition }));
                    }
                  }}
                  style={{
                    borderRadius: 8,
                    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                    background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                    color: accentStrongColor,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  aria-label="Move card down"
                  title="Move card down"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseTop = manualTooltipPos?.top ?? tooltipTop;
                    const baseLeft = manualTooltipPos?.left ?? tooltipLeft;
                    const nextPosition = {
                      top: clamp(baseTop - 140, 14, maxManualTooltipTop),
                      left: clamp(baseLeft, 14, maxTooltipLeft),
                    };
                    setDragPosition(nextPosition);
                    if (stepPositionKey) {
                      setCustomPositions((prev) => ({ ...prev, [stepPositionKey]: nextPosition }));
                    }
                  }}
                  style={{
                    borderRadius: 8,
                    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                    background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                    color: accentStrongColor,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  aria-label="Move card up"
                  title="Move card up"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!stepPositionKey) return;
                    setDragPosition(null);
                    setCustomPositions((prev) => {
                      if (!(stepPositionKey in prev)) return prev;
                      const next = { ...prev };
                      delete next[stepPositionKey];
                      return next;
                    });
                  }}
                  style={{
                    borderRadius: 8,
                    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                    background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                    color: accentStrongColor,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  aria-label="Reset card position for this step"
                  title="Reset this step position"
                >
                  Reset Pos
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onClose(false)}
              style={{
                border: "none",
                background: "transparent",
                color: accentStrongColor,
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
                padding: 0,
              }}
              aria-label="Close tour"
            >
              x
            </button>
          </div>
        </div>

        <h3 style={{ margin: "10px 0 8px", fontSize: 18, color: accentStrongColor }}>{step.title}</h3>
        <p style={{ margin: 0, color: "color-mix(in srgb, var(--foreground) 82%, #64748b)", fontSize: 14, lineHeight: 1.5 }}>
          {step.description}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => {
              void playUiClickTone();
              onClose(false);
            }}
            style={{
              borderRadius: 8,
              border: `1px solid color-mix(in srgb, ${accentColor} 32%, transparent)`,
              background: "color-mix(in srgb, var(--background-2) 70%, #ffffff)",
              color: accentStrongColor,
              padding: "8px 10px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip Tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onPrev}
              disabled={stepIndex === 0}
              style={{
                borderRadius: 8,
                border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                background: "color-mix(in srgb, var(--card) 75%, #ffffff)",
                color:
                  stepIndex === 0
                    ? "color-mix(in srgb, var(--foreground) 35%, #94a3b8)"
                    : accentStrongColor,
                padding: "8px 12px",
                fontWeight: 600,
                cursor: stepIndex === 0 ? "not-allowed" : "pointer",
              }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={onNext}
              style={{
                borderRadius: 8,
                border: `1px solid color-mix(in srgb, ${accentStrongColor} 42%, transparent)`,
                background: accentColor,
                color: "#ffffff",
                padding: "8px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {isFinalShownStep ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
