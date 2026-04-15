import React, { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(containerRef, onRefresh) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const stateRef = useRef({ startY: 0, pulling: false, refreshing: false, currentDist: 0 });

  const THRESHOLD = 50;
  const MAX_PULL = 100;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getScrollTop = () => {
      // Check if the element itself is scrolled, or its parent scroll container
      if (el.scrollTop > 0) return el.scrollTop;
      // Walk up to find a scrollable parent
      let parent = el.parentElement;
      while (parent) {
        if (parent.scrollTop > 0) return parent.scrollTop;
        parent = parent.parentElement;
      }
      return 0;
    };

    const onTouchStart = (e) => {
      if (stateRef.current.refreshing) return;
      if (getScrollTop() > 0) return;
      stateRef.current.startY = e.touches[0].clientY;
      stateRef.current.pulling = false;
    };

    const onTouchMove = (e) => {
      if (stateRef.current.refreshing) return;
      if (getScrollTop() > 0) {
        if (stateRef.current.pulling) {
          stateRef.current.pulling = false;
          setPulling(false);
          setPullDistance(0);
        }
        return;
      }
      const deltaY = e.touches[0].clientY - stateRef.current.startY;
      if (deltaY > 10) {
        stateRef.current.pulling = true;
        const dist = Math.min(deltaY * 0.5, MAX_PULL);
        stateRef.current.currentDist = dist;
        setPulling(true);
        setPullDistance(dist);
        if (deltaY > 20) e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (!stateRef.current.pulling || stateRef.current.refreshing) {
        setPulling(false);
        setPullDistance(0);
        return;
      }
      stateRef.current.pulling = false;
      const dist = stateRef.current.currentDist;
      if (dist >= THRESHOLD && onRefresh) {
        stateRef.current.refreshing = true;
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        try { await onRefresh(); } catch(e) {}
        stateRef.current.refreshing = false;
        setRefreshing(false);
      }
      setPulling(false);
      setPullDistance(0);
    };

    // Mouse events for desktop
    let mouseStartY = 0;
    let mouseDown = false;

    const onMouseDown = (e) => {
      if (stateRef.current.refreshing) return;
      if (getScrollTop() > 0) return;
      mouseStartY = e.clientY;
      mouseDown = true;
      stateRef.current.pulling = false;
    };

    const onMouseMove = (e) => {
      if (!mouseDown || stateRef.current.refreshing) return;
      if (getScrollTop() > 0) {
        if (stateRef.current.pulling) {
          stateRef.current.pulling = false;
          setPulling(false);
          setPullDistance(0);
        }
        return;
      }
      const deltaY = e.clientY - mouseStartY;
      if (deltaY > 10) {
        stateRef.current.pulling = true;
        const dist = Math.min(deltaY * 0.5, MAX_PULL);
        setPulling(true);
        setPullDistance(dist);
      }
    };

    const onMouseUp = async () => {
      if (!mouseDown) return;
      mouseDown = false;
      if (!stateRef.current.pulling || stateRef.current.refreshing) {
        setPulling(false);
        setPullDistance(0);
        return;
      }
      stateRef.current.pulling = false;
      // Read current pullDistance from DOM via a trick: use stateRef
      const currentEl = el.querySelector('.ptr-indicator');
      const currentDist = currentEl ? parseFloat(currentEl.style.height) || 0 : 0;
      if (currentDist >= THRESHOLD && onRefresh) {
        stateRef.current.refreshing = true;
        setRefreshing(true);
        setPullDistance(THRESHOLD);
        try { await onRefresh(); } catch(e) {}
        stateRef.current.refreshing = false;
        setRefreshing(false);
      }
      setPulling(false);
      setPullDistance(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [containerRef, onRefresh, pullDistance]);

  const indicatorEl = React.createElement('div', {
    className: `ptr-indicator ${refreshing ? 'ptr-refreshing' : ''} ${pulling || refreshing ? 'ptr-active' : ''}`,
    style: { height: (pulling || refreshing) ? pullDistance : 0 }
  },
    React.createElement('div', { className: 'ptr-spinner-wrap' },
      refreshing ?
        React.createElement('span', { className: 'ptr-spinner' }) :
        React.createElement('span', {
          className: 'ptr-arrow',
          style: {
            transform: pullDistance >= THRESHOLD ? 'rotate(180deg)' : 'rotate(0deg)',
            opacity: Math.min(pullDistance / THRESHOLD, 1)
          }
        }, '\u2193')
    )
  );

  return { indicatorEl, pulling, refreshing };
}

// ============================================================
// APP LOADING / SERVER ERROR SCREENS
