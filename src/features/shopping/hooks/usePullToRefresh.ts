import { useCallback, useRef, useState } from "react";
import type React from "react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 80;

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const currentPullRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);

  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshingRef.current) return;
    if ((scrollRef.current?.scrollTop ?? 1) > 0) return;
    startYRef.current = e.touches[0].clientY;
    isPullingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || isRefreshingRef.current) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy <= 0) {
      currentPullRef.current = 0;
      isPullingRef.current = false;
      setPullY(0);
      return;
    }
    const clamped = Math.min(dy, MAX_PULL);
    currentPullRef.current = clamped;
    setPullY(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    const pulled = currentPullRef.current;
    currentPullRef.current = 0;
    setPullY(0);

    if (pulled >= PULL_THRESHOLD && !isRefreshingRef.current) {
      isRefreshingRef.current = true;
      setIsRefreshing(true);
      void Promise.resolve(onRefresh?.()).finally(() => {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      });
    }
  }, [onRefresh]);

  return {
    scrollRef,
    pullY,
    pullThreshold: PULL_THRESHOLD,
    isRefreshing,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
