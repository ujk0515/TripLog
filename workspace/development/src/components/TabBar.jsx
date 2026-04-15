import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from '../contexts/RouterContext';
export default function TabBar({ currentTrip }) {
  const { navigate, path } = useRouter();

  // 탭바는 /trip/ 경로에서만 노출
  if (!path.includes('/trip/')) return null;
  // schedule 페이지에서는 미노출
  if (path.includes('/schedule')) return null;

  // URL의 tripId가 우선 (currentTrip 잔존 상태 무시 — /trip/new 진입 시 이전 trip 탭바 노출 방지)
  const tripIdMatch = path.match(/\/trip\/([^/]+)/);
  const urlTripId = tripIdMatch && tripIdMatch[1];
  if (!urlTripId || urlTripId === 'new') return null;
  // 신규/편집 폼 경로에서는 미노출
  if (path.endsWith('/edit') || path.endsWith('/new')) return null;
  const tripId = urlTripId;

  const isTripDetail = path.includes('/trip/') && !path.includes('/expense');
  const isExpense = path.includes('/expense');

  return React.createElement('nav', { className: 'tabbar' },
    React.createElement('button', {
      className: `tabbar-item ${isTripDetail ? 'active' : ''}`,
      onClick: () => navigate(`/trip/${tripId}`)
    },
      React.createElement('span', { className: 'tabbar-icon' }, '\u2708\uFE0F'),
      React.createElement('span', null, '\uC5EC\uD589\uC0C1\uC138')
    ),
    React.createElement('button', {
      className: `tabbar-item ${isExpense ? 'active' : ''}`,
      onClick: () => navigate(`/trip/${tripId}/expense`)
    },
      React.createElement('span', { className: 'tabbar-icon' }, '\uD83D\uDCB0'),
      React.createElement('span', null, '\uACBD\uBE44')
    )
  );
}

// ============================================================
