import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { matchRoute, useRouter } from '../contexts/RouterContext';
import { useToast } from '../contexts/ToastContext';
import { CATEGORIES, COUNTRIES, CURRENCIES } from '../utils/constants';
import { searchNominatim } from '../utils/search';
import { formatCurrency, formatDate, formatDualAmount, formatDualCurrency, formatRateTime, getCountryByCode, getDayAccommodations, getDaysBetween, isTripPast, normalizeDate, parsePlaceName } from '../utils/helpers';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SkeletonCards from '../components/SkeletonCards';
import MapView from '../components/MapView';
import DateRangeCalendar from '../components/DateRangeCalendar';
import CurrencyDropdown from '../components/CurrencyDropdown';
import PasswordToggleIcon from '../components/PasswordToggleIcon';
import AccomCard from '../components/AccomCard';
export default function HomePage({ onSelectTrip }) {
  const { logout, apiCall } = useAuth();
  const { navigate } = useRouter();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const ptrContainerRef = useRef(null);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', '/trips');
      setTrips(data);
    } catch(e) {} finally { setLoading(false); }
  };

  const handlePullRefresh = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/trips');
      setTrips(data);
    } catch(e) {}
  }, [apiCall]);

  const handleTrashClick = (e, trip) => {
    e.stopPropagation();
    setDeleteTarget(trip);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiCall('DELETE', `/trips/${deleteTarget.id}`);
      setTrips(prev => prev.filter(t => t.id !== deleteTarget.id));
    } catch(e) {} finally {
      setDeleteTarget(null);
    }
  };

  const { indicatorEl: ptrIndicator } = usePullToRefresh(ptrContainerRef, handlePullRefresh);

  // 카드 정렬: 현재/미래(start_date 오름차순) → 과거(end_date 내림차순)
  const getSortedTrips = () => {
    const active = trips.filter(t => !isTripPast(t));
    const past = trips.filter(t => isTripPast(t));
    active.sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
    past.sort((a, b) => (b.end_date || '').localeCompare(a.end_date || ''));
    return [...active, ...past];
  };

  const sortedTrips = getSortedTrips();

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('span', { className: 'topbar-title' }, '\uB0B4 \uC5EC\uD589')
      ),
      React.createElement('div', { className: 'topbar-right' },
        trips.length > 0 && React.createElement('button', {
          className: 'topbar-btn', onClick: () => navigate('/trip/new'), title: '\uC5EC\uD589 \uCD94\uAC00',
          style: { fontSize: '20px', fontWeight: '300' }
        }, '+'),
        React.createElement('button', {
          className: 'topbar-btn', onClick: logout, title: '\uB85C\uADF8\uC544\uC6C3',
          dangerouslySetInnerHTML: { __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' }
        })
      )
    ),
    React.createElement('div', { className: 'home-page', ref: ptrContainerRef },
      ptrIndicator,
      loading ? React.createElement(SkeletonCards) :
      trips.length === 0 ?
        React.createElement('div', { className: 'empty-state' },
          React.createElement('div', { className: 'empty-state-icon' }, '\u2708\uFE0F'),
          React.createElement('div', { className: 'empty-state-title' }, '\uC544\uC9C1 \uAE30\uB85D\uB41C \uC5EC\uD589\uC774 \uC5C6\uC5B4\uC694'),
          React.createElement('div', { className: 'empty-state-desc' }, '\uCCAB \uC5EC\uD589\uC744 \uCD94\uAC00\uD574\uBCF4\uC138\uC694'),
          React.createElement('button', {
            className: 'empty-state-btn', onClick: () => navigate('/trip/new')
          }, '+ \uC5EC\uD589 \uCD94\uAC00')
        ) :
        React.createElement('div', { className: 'trip-list' },
          sortedTrips.map(trip => {
            const country = getCountryByCode(trip.country_code);
            const days = getDaysBetween(trip.start_date, trip.end_date);
            const isPast = isTripPast(trip);
            const isDraft = trip.status === 'draft';
            return React.createElement('div', {
              key: trip.id, className: 'trip-card' + (isPast ? ' trip-card--past' : ''),
              onClick: () => {
                onSelectTrip(trip);
                navigate(isDraft ? `/trip/${trip.id}/schedule` : `/trip/${trip.id}`);
              }
            },
              React.createElement('button', {
                className: 'trip-card-trash',
                onClick: (e) => handleTrashClick(e, trip),
                title: '\uC0AD\uC81C'
              , dangerouslySetInnerHTML: { __html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' } }),
              React.createElement('div', { className: 'trip-card-country' },
                React.createElement('span', { className: 'trip-card-flag' }, country.flag),
                React.createElement('span', null, country.name)
              ),
              React.createElement('div', { className: 'trip-card-title-row' },
                React.createElement('div', { className: 'trip-card-title' }, trip.title),
                isDraft
                  ? React.createElement('span', { className: 'trip-card-badge--draft' }, '\uAE30\uB85D\uC911')
                  : isPast
                    ? React.createElement('span', { className: 'trip-card-badge--past' }, '\uC5EC\uD589 \uC644\uB8CC')
                    : React.createElement('span', { className: 'trip-card-badge--active' }, '\uC21C\uD56D\uC911')
              ),
              React.createElement('div', { className: 'trip-card-dates' },
                `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)} (${days.length}\uC77C)`
              ),
              React.createElement('div', { className: 'trip-card-meta' },
                `\uC7A5\uC18C ${trip.place_count || trip.placeCount || 0}\uAC1C | ${formatDualCurrency(Math.round(Number(trip.total_expense_krw || trip.totalExpense || 0)), trip.total_expense_local || 0, trip.local_currency)}`
              )
            );
          })
        )
    ),
    React.createElement(Modal, {
      open: !!deleteTarget,
      title: '\uC5EC\uD589 \uC0AD\uC81C',
      body: deleteTarget ? (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
        const isPast = deleteTarget.end_date && normalizeDate(deleteTarget.end_date) < todayStr;
        return isPast
          ? `'${deleteTarget.title}'\uC740(\uB294) \uC9C0\uB09C \uCD94\uC5B5\uC758 \uC5EC\uD589\uC785\uB2C8\uB2E4.\n\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`
          : `'${deleteTarget.title}' \uC5EC\uD589\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uC0AD\uC81C\uD558\uBA74 \uBAA8\uB4E0 \uAE30\uB85D\uC774 \uC0AC\uB77C\uC9D1\uB2C8\uB2E4.`;
      })() : '',
      onConfirm: handleConfirmDelete,
      onCancel: () => setDeleteTarget(null),
      confirmLabel: '\uC0AD\uC81C',
      confirmDanger: true
    })
  );
}

// ============================================================
// TRIP CREATE PAGE
// ============================================================
// ============================================================
// DateRangeCalendar Component
