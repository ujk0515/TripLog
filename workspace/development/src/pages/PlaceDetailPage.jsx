import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { matchRoute, useRouter } from '../contexts/RouterContext';
import { useToast } from '../contexts/ToastContext';
import { getDayAccommodations, normalizeDate, parsePlaceName } from '../utils/helpers';
import MapView from '../components/MapView';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

export default function PlaceDetailPage() {
  const { path, navigate } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();

  const params = matchRoute('/trip/:id/day/:date/place/:placeId', path);
  const tripId = params?.id;
  const date = params?.date;
  const placeId = params?.placeId;

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [place, setPlace] = useState(null);
  const [dayPlaces, setDayPlaces] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [memos, setMemos] = useState([]);
  const [memoInput, setMemoInput] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeletePlace = async () => {
    try {
      await apiCall('DELETE', `/trips/${tripId}/places/${placeId}`);
      toast('장소가 삭제되었습니다');
      navigate(`/trip/${tripId}`);
    } catch { toast('삭제 실패'); }
    setShowDeleteModal(false);
  };

  useEffect(() => {
    if (tripId && date && placeId) loadData();
  }, [tripId, date, placeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tripData = await apiCall('GET', `/trips/${tripId}`);
      const placesData = await apiCall('GET', `/trips/${tripId}/places?date=${date}`);
      let accomData = [];
      try {
        accomData = await apiCall('GET', `/trips/${tripId}/accommodations`);
      } catch (_) {}
      const memosData = await apiCall('GET', `/trips/${tripId}/places/${placeId}/memos`);

      setTrip(tripData);
      const normalized = (Array.isArray(placesData) ? placesData : [])
        .map(p => ({ ...p, date: normalizeDate(p.date) }))
        .sort((a, b) => a.order_index - b.order_index);
      setDayPlaces(normalized);
      setPlace(normalized.find(p => p.id === placeId) || null);
      setAccommodations(Array.isArray(accomData) ? accomData : []);
      setMemos(Array.isArray(memosData) ? memosData : (memosData?.memos || []));
    } catch (e) {
      // error silently
    } finally {
      setLoading(false);
    }
  };

  const loadMemos = async () => {
    try {
      const data = await apiCall('GET', `/trips/${tripId}/places/${placeId}/memos`);
      setMemos(Array.isArray(data) ? data : (data?.memos || []));
    } catch (_) {
      setMemos([]);
    }
  };

  const handleSaveMemo = async () => {
    if (!memoInput.trim()) return;
    try {
      await apiCall('POST', `/trips/${tripId}/places/${placeId}/memos`, { memo: memoInput.trim() });
      setMemoInput('');
      loadMemos();
    } catch (e) {
      toast('메모 저장 실패');
    }
  };

  const handleDeleteMemo = async (memoId) => {
    try {
      await apiCall('DELETE', `/trips/${tripId}/places/${placeId}/memos/${memoId}`);
      setMemos(prev => prev.filter(m => m.id !== memoId));
    } catch (_) {
      toast('삭제 실패');
    }
  };

  // --- Loading state ---
  if (loading) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}`) }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '\uC7A5\uC18C \uC0C1\uC138')
        )
      ),
      React.createElement('div', { className: 'place-detail-page' },
        React.createElement(Spinner)
      )
    );
  }

  if (!place || !trip) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}`) }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '\uC7A5\uC18C \uC0C1\uC138')
        )
      ),
      React.createElement('div', { className: 'place-detail-page' }, '\uC7A5\uC18C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4')
    );
  }

  // --- Computed values ---
  const placeIndex = dayPlaces.findIndex(p => p.id === placeId);
  const numbering = placeIndex >= 0 ? placeIndex + 1 : (place.order_index || 0) + 1;
  const { short: shortName, addr: fullAddress } = parsePlaceName(place.name);

  // Day N calculation
  const startDate = normalizeDate(trip.start_date);
  const dayN = Math.floor((new Date(date + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) / 86400000) + 1;

  // Route info from localStorage cache
  const dayAccoms = getDayAccommodations(date, accommodations);
  const getRouteInfoForPlace = () => {
    if (!place.lat || !place.lng) return null;
    const origins = [];
    if (dayAccoms.out?.lat && dayAccoms.out?.lng) origins.push([Number(dayAccoms.out.lat), Number(dayAccoms.out.lng)]);
    if (dayAccoms.in?.lat && dayAccoms.in?.lng) origins.push([Number(dayAccoms.in.lat), Number(dayAccoms.in.lng)]);
    if (origins.length === 0 && dayAccoms.normal?.lat && dayAccoms.normal?.lng) {
      origins.push([Number(dayAccoms.normal.lat), Number(dayAccoms.normal.lng)]);
    }
    for (const coord of origins) {
      const cacheKey = `route2_${coord[0]}_${coord[1]}_${Number(place.lat)}_${Number(place.lng)}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.distance != null) return parsed;
        }
      } catch (_) {}
    }
    return null;
  };

  const routeInfo = getRouteInfoForPlace();
  const fmtRoute = (ri) => {
    const d = ri.distance >= 1000 ? (ri.distance / 1000).toFixed(1) + 'km' : Math.round(ri.distance) + 'm';
    const t = ri.duration >= 3600 ? Math.floor(ri.duration / 3600) + '\uC2DC\uAC04 ' + Math.round((ri.duration % 3600) / 60) + '\uBD84' : Math.round(ri.duration / 60) + '\uBD84';
    return `\uAC70\uB9AC: \uC57D ${d} / \uC2DC\uAC04: \uC57D ${t}`;
  };

  // MapView: show only this place with flag marker
  const mapPlaces = [place];

  return React.createElement(React.Fragment, null,
    // --- Top Bar ---
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}`) }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, '\uC7A5\uC18C \uC0C1\uC138')
      ),
      React.createElement('div', { className: 'topbar-right' },
        React.createElement('button', {
          className: 'topbar-btn',
          onClick: () => navigate(`/trip/${tripId}/day/${date}/place/${placeId}/edit`),
          title: '\uC218\uC815',
          dangerouslySetInnerHTML: { __html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>' }
        }),
        React.createElement('button', {
          className: 'topbar-btn',
          onClick: () => setShowDeleteModal(true),
          title: '\uC0AD\uC81C',
          dangerouslySetInnerHTML: { __html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' }
        })
      )
    ),

    // --- Page Content ---
    React.createElement('div', { className: 'place-detail-page' },
      // Place name
      React.createElement('div', { className: 'pd-place-name' }, `${numbering}. ${shortName}`),

      // Address
      fullAddress && React.createElement('div', { className: 'pd-address' },
        React.createElement('span', { className: 'pd-address-icon' }, '\uD83D\uDCCD'),
        React.createElement('span', null, fullAddress)
      ),

      // Visit date
      React.createElement('div', { className: 'pd-visit-date' },
        React.createElement('span', { className: 'pd-date-icon' }, '\uD83D\uDCC5'),
        React.createElement('span', null, `Day ${dayN} \u00B7 ${date}`)
      ),

      // Distance/Time (no parentheses)
      routeInfo && React.createElement('div', { className: 'pd-dist-time' }, fmtRoute(routeInfo)),

      // Map (always visible)
      React.createElement('div', { className: 'pd-map-wrapper' },
        React.createElement(MapView, {
          places: mapPlaces,
          dayAccommodations: dayAccoms,
          markerVariant: 'flag'
        })
      ),

      // Divider
      React.createElement('div', { className: 'pd-divider' }),

      // Visit Time section
      React.createElement('div', { className: 'pd-section-label' }, '\uBC29\uBB38 \uC2DC\uAC04'),
      React.createElement('div', { className: 'pd-visit-time-value' }, place.visit_time || ''),

      // Divider
      React.createElement('div', { className: 'pd-divider' }),

      // Memo section
      React.createElement('div', { className: 'pd-section-label' }, '\uBA54\uBAA8'),

      // Memo entries
      memos.length > 0 && React.createElement('div', { className: 'pd-memo-entries' },
        memos.map((entry, idx) =>
          React.createElement('div', { key: entry.id, className: 'pd-memo-item' },
            React.createElement('span', { className: 'pd-memo-badge' }, idx + 1),
            React.createElement('span', { className: 'pd-memo-text' }, entry.memo),
            React.createElement('button', {
              className: 'pd-memo-delete',
              onClick: () => handleDeleteMemo(entry.id)
            }, '\uD83D\uDDD1\uFE0F')
          )
        )
      ),

      // Memo input + save
      React.createElement('div', { className: 'pd-memo-input-row' },
        React.createElement('textarea', {
          className: 'pd-memo-input',
          placeholder: '\uBA54\uBAA8\uB97C \uC785\uB825\uD558\uC138\uC694 (50\uC790)',
          value: memoInput,
          maxLength: 50,
          rows: 1,
          onChange: e => setMemoInput(e.target.value),
          onInput: e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }
        }),
        React.createElement('button', {
          className: 'pd-memo-save-btn',
          disabled: !memoInput.trim(),
          onClick: handleSaveMemo
        }, '\uC800\uC7A5')
      )
    ),

    // 삭제 확인 모달
    React.createElement(Modal, {
      open: showDeleteModal,
      title: '\uC7A5\uC18C \uC0AD\uC81C',
      body: `'${parsePlaceName(place?.name || '').short}'\uC744(\uB97C) \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`,
      confirmLabel: '\uC0AD\uC81C',
      confirmDanger: true,
      onConfirm: handleDeletePlace,
      onCancel: () => setShowDeleteModal(false)
    })
  );
}
