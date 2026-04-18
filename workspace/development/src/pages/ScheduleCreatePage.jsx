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
export default function ScheduleCreatePage({ onSelectTrip }) {
  const { path, navigate, goBack } = useRouter();
  const { apiCall } = useAuth();
  const toast = useToast();
  const params = matchRoute('/trip/:id/schedule', path);
  const tripId = params?.id;

  const [trip, setTrip] = useState(null);
  const [days, setDays] = useState([]);
  const [places, setPlaces] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(true);

  // 경로 정보 (거리/시간)
  const [routeInfoMap, setRouteInfoMap] = useState({});
  const handleRouteInfo = useCallback(({ placeId, variant, distance, duration }) => {
    setRouteInfoMap(prev => {
      const key = `${placeId}_${variant}`;
      if (prev[key]?.distance === distance) return prev;
      return { ...prev, [key]: { distance, duration } };
    });
  }, []);

  // 장소 검색
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (tripId) loadData();
  }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tripData = await apiCall('GET', `/trips/${tripId}`);
      const daysData = await apiCall('GET', `/trips/${tripId}/days`);
      const placesData = await apiCall('GET', `/trips/${tripId}/places`);
      let accomData = [];
      try { accomData = await apiCall('GET', `/trips/${tripId}/accommodations`); } catch(e) {}
      setTrip(tripData);
      onSelectTrip(tripData);
      setDays(daysData.map(d => ({ ...d, date: normalizeDate(d.date) })));
      setPlaces(placesData.map(p => ({ ...p, date: normalizeDate(p.date) })));
      setAccommodations(Array.isArray(accomData) ? accomData : []);
      if (!selectedDay && daysData.length > 0) {
        setSelectedDay(normalizeDate(daysData[0].date));
      }
    } catch(e) {} finally { setLoading(false); }
  };

  const dayPlaces = places.filter(p => p.date === selectedDay).sort((a,b) => a.order_index - b.order_index);
  const dayAccoms = getDayAccommodations(selectedDay, accommodations);

  // 장소 검색
  const handleSearchChange = (val) => {
    setSearchName(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val.trim()) { setSearchResults([]); setShowDropdown(false); return; }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const accom = dayAccoms.in || dayAccoms.out || dayAccoms.normal;
        const data = await searchNominatim(val, accom?.lat ? Number(accom.lat) : null, accom?.lng ? Number(accom.lng) : null);
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch { setSearchResults([]); setShowDropdown(false); }
    }, 500);
  };

  const handleSelectPlace = async (item) => {
    setShowDropdown(false);
    setSearchResults([]);
    setSearchName('');
    try {
      await apiCall('POST', `/trips/${tripId}/places`, {
        name: item.display_name,
        date: selectedDay,
        order_index: dayPlaces.length,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      });
      loadData();
    } catch(e) { toast('장소 추가 실패'); }
  };

  // 순서 변경
  const movePlace = async (placeId, direction) => {
    const sorted = [...dayPlaces];
    const idx = sorted.findIndex(p => p.id === placeId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    try {
      await apiCall('PUT', `/trips/${tripId}/places/${sorted[idx].id}`, { order_index: sorted[swapIdx].order_index });
      await apiCall('PUT', `/trips/${tripId}/places/${sorted[swapIdx].id}`, { order_index: sorted[idx].order_index });
      loadData();
    } catch(e) {}
  };

  // 장소 삭제
  const [deletePlaceTarget, setDeletePlaceTarget] = useState(null);
  const handleConfirmDeletePlace = async () => {
    if (!deletePlaceTarget) return;
    setDeletePlaceTarget(null);
    try {
      await apiCall('DELETE', `/trips/${tripId}/places/${deletePlaceTarget.id}`);
      setPlaces(prev => prev.filter(p => p.id !== deletePlaceTarget.id));
      toast('장소가 삭제되었습니다');
    } catch(e) { toast('삭제 실패'); }
  };

  // 여행 만들기 (완료)
  const handleComplete = async () => {
    try {
      await apiCall('PUT', `/trips/${tripId}`, { status: 'complete' });
      navigate(`/trip/${tripId}`);
      toast('나의 여행이 생성되었습니다');
    } catch(e) { toast('오류가 발생했습니다'); }
  };

  if (loading) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}/edit`) }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '\uC77C\uC790\uBCC4 \uC77C\uC815 \uC0DD\uC131')
        )
      ),
      React.createElement('div', { className: 'trip-detail-page' }, React.createElement(SkeletonCards, { count: 3 }))
    );
  }

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}/edit`) }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, '\uC77C\uC790\uBCC4 \uC77C\uC815 \uC0DD\uC131')
      )
    ),
    React.createElement('div', { className: 'trip-detail-page schedule-create-with-floating' },
      // Day 탭
      React.createElement('div', { className: 'day-tabs' },
        days.map((day, i) => React.createElement('button', {
          key: day.date,
          className: `day-tab ${selectedDay === day.date ? 'active' : ''}`,
          onClick: () => { setSelectedDay(day.date); setRouteInfoMap({}); }
        }, `Day ${i + 1}`))
      ),

      // 숙소 카드
      (() => {
        const { out, in: inn, normal } = dayAccoms;
        if (out && inn) {
          return React.createElement('div', { className: 'accom-split' },
            React.createElement(AccomCard, { accom: out, variant: 'out', onClick: () => navigate(`/trip/${tripId}/accommodation/${out.id}`) }),
            React.createElement('div', { className: 'accom-arrow' }, '\u2192'),
            React.createElement(AccomCard, { accom: inn, variant: 'in', onClick: () => navigate(`/trip/${tripId}/accommodation/${inn.id}`) })
          );
        }
        if (out) return React.createElement(AccomCard, { accom: out, variant: 'out', onClick: () => navigate(`/trip/${tripId}/accommodation/${out.id}`) });
        if (inn) return React.createElement(AccomCard, { accom: inn, variant: 'in', onClick: () => navigate(`/trip/${tripId}/accommodation/${inn.id}`) });
        if (normal) return React.createElement(AccomCard, { accom: normal, variant: 'normal', onClick: () => navigate(`/trip/${tripId}/accommodation/${normal.id}`) });
        return null;
      })(),

      // 장소 목록
      React.createElement('div', { className: 'schedule-places' },
        React.createElement('div', { className: 'place-section-title' }, '\uC7A5\uC18C \uCD94\uAC00'),
        dayPlaces.map((place, idx) => {
          const { short: sn, addr: sa } = parsePlaceName(place.name);
          const fmtRoute = (ri) => {
            const d = ri.distance >= 1000 ? (ri.distance / 1000).toFixed(1) + 'km' : Math.round(ri.distance) + 'm';
            const t = ri.duration >= 3600 ? Math.floor(ri.duration / 3600) + '시간 ' + Math.round((ri.duration % 3600) / 60) + '분' : Math.round(ri.duration / 60) + '분';
            return `(거리: 약 ${d} / 시간: 약 ${t})`;
          };
          const riOut = routeInfoMap[`${place.id}_out`];
          const riIn = routeInfoMap[`${place.id}_in`];
          const riNormal = routeInfoMap[`${place.id}_normal`];
          return React.createElement('div', { key: place.id, className: 'place-card' },
            React.createElement('div', { className: 'place-number' }, idx + 1),
            React.createElement('div', { className: 'place-info' },
              React.createElement('div', { className: 'place-name' }, sn),
              riOut && React.createElement('div', { className: 'place-route-info', style: { color: '#EF4444' } }, fmtRoute(riOut)),
              riIn && React.createElement('div', { className: 'place-route-info', style: { color: '#2563EB' } }, fmtRoute(riIn)),
              riNormal && !riOut && !riIn && React.createElement('div', { className: 'place-route-info' }, fmtRoute(riNormal)),
              sa && React.createElement('div', { className: 'place-addr' }, sa)
            ),
            React.createElement('div', { className: 'place-actions' },
              React.createElement('button', {
                className: 'place-order-btn', disabled: idx === 0,
                onClick: () => movePlace(place.id, 'up')
              }, '\u25B2'),
              React.createElement('button', {
                className: 'place-order-btn', disabled: idx === dayPlaces.length - 1,
                onClick: () => movePlace(place.id, 'down')
              }, '\u25BC'),
              React.createElement('button', {
                className: 'place-delete-btn-icon',
                onClick: () => setDeletePlaceTarget(place),
                dangerouslySetInnerHTML: { __html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' }
              })
            )
          );
        }),

        // 검색 input (항시 마지막에 노출)
        React.createElement('div', { className: 'search-input-wrap', style: { marginTop: 12 } },
          React.createElement('input', {
            className: 'form-input',
            placeholder: '\uC7A5\uC18C \uAC80\uC0C9 (\uC608: \uC5D0\uD3A0\uD0D1)',
            value: searchName,
            onChange: e => handleSearchChange(e.target.value),
            onBlur: () => { setTimeout(() => setShowDropdown(false), 200); }
          }),
          showDropdown && searchResults.length > 0 && React.createElement('div', { className: 'nominatim-dropdown' },
            searchResults.map((item, idx) =>
              React.createElement('div', {
                key: idx, className: 'nominatim-item',
                onMouseDown: e => { e.preventDefault(); handleSelectPlace(item); },
                onTouchStart: () => handleSelectPlace(item)
              }, item.display_name)
            )
          )
        )
      ),

      // 지도 (항시 펼침)
      React.createElement(MapView, { places: dayPlaces, dayAccommodations: dayAccoms, onRouteInfo: handleRouteInfo }),

      // 지도 아래 여백 (플로팅 버튼 가림 방지)
      React.createElement('div', { style: { height: 80 } })
    ),

    // 여행 만들기 플로팅 버튼
    React.createElement('div', { className: 'trip-create-floating-submit' },
      React.createElement('button', {
        className: 'form-submit',
        onClick: handleComplete
      }, '\uC5EC\uD589 \uB9CC\uB4E4\uAE30')
    ),

    // 장소 삭제 확인 팝업
    React.createElement(Modal, {
      open: !!deletePlaceTarget,
      title: '\uC7A5\uC18C \uC0AD\uC81C',
      body: deletePlaceTarget ? `'${parsePlaceName(deletePlaceTarget.name).short}'\uC744(\uB97C) \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?` : '',
      confirmLabel: '\uC0AD\uC81C',
      confirmDanger: true,
      onConfirm: handleConfirmDeletePlace,
      onCancel: () => setDeletePlaceTarget(null)
    })
  );
}
