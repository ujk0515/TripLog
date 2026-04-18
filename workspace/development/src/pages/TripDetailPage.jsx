import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { matchRoute, useRouter } from '../contexts/RouterContext';
import { useToast } from '../contexts/ToastContext';
import { API_BASE, CATEGORIES, COUNTRIES, CURRENCIES } from '../utils/constants';
import { searchNominatim } from '../utils/search';
import { copyToClipboard, formatCurrency, formatDate, formatDualAmount, formatDualCurrency, formatRateTime, getCountryByCode, getDayAccommodations, getDaysBetween, isTripPast, normalizeDate, parsePlaceName } from '../utils/helpers';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import SkeletonCards from '../components/SkeletonCards';
import MapView from '../components/MapView';
import DateRangeCalendar from '../components/DateRangeCalendar';
import CurrencyDropdown from '../components/CurrencyDropdown';
import PasswordToggleIcon from '../components/PasswordToggleIcon';
import AccomCard from '../components/AccomCard';
export default function TripDetailPage({ onSelectTrip }) {
  const { path, navigate, goBack } = useRouter();
  const toast = useToast();
  const { user, apiCall } = useAuth();
  const params = matchRoute('/trip/:id', path);
  const tripId = params?.id;

  const [trip, setTrip] = useState(null);
  const [days, setDays] = useState([]);
  const [places, setPlaces] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [dayMemo, setDayMemo] = useState('');
  const [memoEntries, setMemoEntries] = useState([]);
  const [memoInput, setMemoInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [accommodations, setAccommodations] = useState([]);
  const [routeReady, setRouteReady] = useState(0);

  const memoTimerRef = useRef(null);
  const ptrContainerRef = useRef(null);

  useEffect(() => {
    if (tripId) loadData();
  }, [tripId, path]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 순차 호출 — Promise.all로 동시 호출하면 401 refresh race condition 발생
      const tripData = await apiCall('GET', `/trips/${tripId}`);
      const daysData = await apiCall('GET', `/trips/${tripId}/days`);
      const placesData = await apiCall('GET', `/trips/${tripId}/places`);
      // Accommodation load (array)
      let accomData = [];
      try {
        accomData = await apiCall('GET', `/trips/${tripId}/accommodations`);
      } catch (accomErr) {
        // 404 or error — no accommodation
      }
      setAccommodations(Array.isArray(accomData) ? accomData : []);
      setTrip(tripData);
      onSelectTrip(tripData);
      const normalizedDays = daysData.map(d => ({ ...d, date: normalizeDate(d.date) }));
      const normalizedPlaces = placesData.map(p => ({ ...p, date: normalizeDate(p.date) }));
      setDays(normalizedDays);
      setPlaces(normalizedPlaces);
      // 날짜 탭 선택
      const queryDay = path.includes('?day=') ? normalizeDate(path.split('?day=')[1]) : null;
      let targetDay = null;
      if (queryDay && normalizedDays.find(d => d.date === queryDay)) {
        targetDay = queryDay;
      } else if (normalizedDays.length > 0) {
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const todayMatch = normalizedDays.find(d => d.date === todayStr);
        if (todayMatch) {
          targetDay = todayMatch.date;
        } else if (todayStr < normalizedDays[0].date) {
          targetDay = normalizedDays[0].date;
        } else {
          targetDay = normalizedDays[normalizedDays.length - 1].date;
        }
      }
      if (targetDay) {
        setSelectedDay(targetDay);
        const dayObj = normalizedDays.find(d => d.date === targetDay);
        setDayMemo(dayObj?.memo || '');
      }
      // 경로 정보 미리 계산 (OSRM)
      prefetchRoutes(normalizedPlaces, normalizedDays, Array.isArray(accomData) ? accomData : []);
    } catch(e) {} finally { setLoading(false); }
  };

  const prefetchRoutes = (allPlaces, allDays, allAccoms) => {
    const fetches = [];
    allDays.forEach(day => {
      const dp = allPlaces.filter(p => p.date === day.date);
      if (!dp.length) return;
      const da = getDayAccommodations(day.date, allAccoms);
      const origins = [];
      if (da.out?.lat && da.out?.lng) origins.push([Number(da.out.lat), Number(da.out.lng)]);
      if (da.in?.lat && da.in?.lng) origins.push([Number(da.in.lat), Number(da.in.lng)]);
      if (origins.length === 0 && da.normal?.lat && da.normal?.lng) origins.push([Number(da.normal.lat), Number(da.normal.lng)]);
      origins.forEach(coord => {
        dp.forEach(p => {
          if (!p.lat || !p.lng) return;
          const cacheKey = `route2_${coord[0]}_${coord[1]}_${Number(p.lat)}_${Number(p.lng)}`;
          if (localStorage.getItem(cacheKey)) return;
          fetches.push(
            fetch(`https://router.project-osrm.org/route/v1/driving/${coord[1]},${coord[0]};${Number(p.lng)},${Number(p.lat)}?overview=full&geometries=geojson`)
              .then(r => r.json())
              .then(data => {
                if (data.routes?.[0]) {
                  const route = data.routes[0];
                  const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                  localStorage.setItem(cacheKey, JSON.stringify({ coords, distance: route.distance, duration: route.duration }));
                }
              }).catch(() => {})
          );
        });
      });
    });
    if (fetches.length) Promise.all(fetches).then(() => setRouteReady(v => v + 1));
  };

  const handlePullRefresh = useCallback(async () => {
    try {
      const tripData = await apiCall('GET', `/trips/${tripId}`);
      const daysData = await apiCall('GET', `/trips/${tripId}/days`);
      const placesData = await apiCall('GET', `/trips/${tripId}/places`);
      // Accommodation refresh
      let accomData = [];
      try {
        accomData = await apiCall('GET', `/trips/${tripId}/accommodations`);
      } catch (accomErr) {}
      setAccommodations(Array.isArray(accomData) ? accomData : []);
      setTrip(tripData);
      onSelectTrip(tripData);
      const normalizedDays = daysData.map(d => ({ ...d, date: normalizeDate(d.date) }));
      const normalizedPlaces = placesData.map(p => ({ ...p, date: normalizeDate(p.date) }));
      setDays(normalizedDays);
      setPlaces(normalizedPlaces);
      // Pull-to-Refresh 시 오늘 날짜 기반 Day 탭 자동 선택
      if (normalizedDays.length > 0) {
        const now = new Date();
        const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        const todayMatch = normalizedDays.find(d => d.date === todayStr);
        let refreshDay = null;
        if (todayMatch) {
          refreshDay = todayMatch.date;
        } else if (todayStr < normalizedDays[0].date) {
          refreshDay = normalizedDays[0].date;
        } else {
          refreshDay = normalizedDays[normalizedDays.length - 1].date;
        }
        setSelectedDay(refreshDay);
        const dayObj = normalizedDays.find(d => d.date === refreshDay);
        setDayMemo(dayObj?.memo || '');
      }
    } catch(e) {}
  }, [apiCall, tripId, onSelectTrip]);

  const { indicatorEl: ptrIndicator } = usePullToRefresh(ptrContainerRef, handlePullRefresh);

  useEffect(() => {
    if (selectedDay && days.length > 0) {
      const day = days.find(d => d.date === selectedDay);
      setDayMemo(day?.memo || '');
      loadMemoEntries(selectedDay);
    }
  }, [selectedDay, days]);

  const loadMemoEntries = async (date) => {
    try {
      const data = await apiCall('GET', `/trips/${tripId}/days/${date}/memos`);
      setMemoEntries(Array.isArray(data) ? data : []);
    } catch { setMemoEntries([]); }
  };

  const handleSaveMemo = async () => {
    if (!memoInput.trim()) return;
    try {
      await apiCall('POST', `/trips/${tripId}/days/${selectedDay}/memos`, { memo: memoInput.trim() });
      setMemoInput('');
      loadMemoEntries(selectedDay);
    } catch(e) { toast('메모 저장 실패'); }
  };

  const handleDeleteMemoEntry = async (memoId) => {
    try {
      await apiCall('DELETE', `/trips/${tripId}/days/${selectedDay}/memos/${memoId}`);
      setMemoEntries(prev => prev.filter(m => m.id !== memoId));
    } catch { toast('삭제 실패'); }
  };

  const handleMemoChange = (val) => {
    setDayMemo(val);
    if (memoTimerRef.current) clearTimeout(memoTimerRef.current);
    memoTimerRef.current = setTimeout(() => {
      apiCall('PUT', `/trips/${tripId}/days/${selectedDay}/memo`, { memo: val }).catch(() => {});
    }, 800);
  };

  const handleDeleteTrip = async () => {
    try {
      await apiCall('DELETE', `/trips/${tripId}`);
      onSelectTrip(null);
      navigate('/');
      toast('\uC5EC\uD589\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch(e) { toast('\uC0AD\uC81C \uC2E4\uD328'); }
    setShowDeleteModal(false);
  };

  const [deletePlaceTarget, setDeletePlaceTarget] = useState(null);

  const handleDeletePlace = (place) => {
    setDeletePlaceTarget(place);
  };

  const handleConfirmDeletePlace = async () => {
    if (!deletePlaceTarget) return;
    const placeId = deletePlaceTarget.id;
    setDeletePlaceTarget(null);
    try {
      await apiCall('DELETE', `/trips/${tripId}/places/${placeId}`);
      setPlaces(prev => prev.filter(p => p.id !== placeId));
      toast('\uC7A5\uC18C\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch(e) { toast('\uC0AD\uC81C \uC2E4\uD328'); }
  };

  const handleShare = async () => {
    try {
      const res = await apiCall('POST', `/trips/${tripId}/share`);
      // OG 메타 태그를 위해 서버 URL 사용 (서버가 OG HTML 반환 후 프론트로 리다이렉트)
      const serverOrigin = API_BASE.replace(/\/api$/, '');
      const url = serverOrigin + '/share/' + res.shareToken;
      setShareUrl(url);
      setShowShareSheet(true);
    } catch (e) {
      toast('\uACF5\uC720\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
    }
  };

  const handleShareKakao = async () => {
    try {
      await copyToClipboard(shareUrl);
      toast('\uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uCE74\uCE74\uC624\uD1A1\uC5D0 \uBD99\uC5EC\uB123\uAE30 \uD558\uC138\uC694');
    } catch (e) {
      toast('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
    }
    setShowShareSheet(false);
  };

  const handleShareMessage = () => {
    window.location.href = `sms:?body=${encodeURIComponent(shareUrl)}`;
    setShowShareSheet(false);
  };

  const handleShareCopyLink = async () => {
    try {
      await copyToClipboard(shareUrl);
      toast('\uACF5\uC720 \uB9C1\uD06C\uAC00 \uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch (e) {
      toast('\uBCF5\uC0AC\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4');
    }
    setShowShareSheet(false);
  };

  const snsShareText = 'TripLog에서 여행 기록을 확인해보세요';

  const handleShareTelegram = () => {
    const tgUrl = `tg://msg_url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snsShareText)}`;
    const webUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snsShareText)}`;
    const w = window.open(tgUrl, '_blank');
    setTimeout(() => {
      try { if (!w || w.closed) window.open(webUrl, '_blank'); } catch (e) { window.open(webUrl, '_blank'); }
    }, 500);
    setShowShareSheet(false);
  };

  const handleShareLine = () => {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`, '_blank');
    setShowShareSheet(false);
  };

  const handleShareTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snsShareText)}`, '_blank');
    setShowShareSheet(false);
  };

  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
    setShowShareSheet(false);
  };

  const handleShareEmail = () => {
    const subject = data ? data.title : 'TripLog 여행 기록';
    const body = `${snsShareText}\n\n${shareUrl}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setShowShareSheet(false);
  };

  if (loading) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '...')
        )
      ),
      React.createElement('div', { className: 'trip-detail-page' }, React.createElement(SkeletonCards, { count: 2 }))
    );
  }

  if (!trip) return React.createElement('div', { className: 'trip-detail-page' }, '\uC5EC\uD589\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4');

  const country = getCountryByCode(trip.country_code);
  const dayPlaces = places.filter(p => p.date === selectedDay).sort((a,b) => a.order_index - b.order_index);
  const dayAccoms = getDayAccommodations(selectedDay, accommodations);

  const getRouteInfo = (placeId, lat, lng, variant, accomLat, accomLng) => {
    if (!lat || !lng || !accomLat || !accomLng) return null;
    const cacheKey = `route2_${accomLat}_${accomLng}_${Number(lat)}_${Number(lng)}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.distance != null) return parsed;
      }
    } catch {}
    return null;
  };


  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: () => navigate('/') }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, trip.title)
      ),
      React.createElement('div', { className: 'topbar-right' },
        React.createElement('button', { className: 'topbar-btn', onClick: handleShare, title: '\uACF5\uC720', dangerouslySetInnerHTML: { __html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' } }),
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('button', {
            className: 'topbar-btn topbar-btn-outline',
            onClick: () => setShowMoreMenu(!showMoreMenu), title: '\uB354\uBCF4\uAE30'
          }, '\u00B7\u00B7\u00B7'),
          showMoreMenu && React.createElement('div', { className: 'expense-dropdown', style: { top: 40, right: 0 } },
            React.createElement('button', { className: 'expense-dropdown-item', onClick: () => { setShowMoreMenu(false); navigate(`/trip/${tripId}/edit`); } }, '\uC218\uC815'),
            React.createElement('button', { className: 'expense-dropdown-item danger', onClick: () => { setShowMoreMenu(false); setShowDeleteModal(true); } }, '\uC0AD\uC81C')
          )
        )
      )
    ),
    React.createElement('div', { className: 'trip-detail-page', ref: ptrContainerRef },
      ptrIndicator,
      // Summary
      React.createElement('div', { className: 'trip-summary' },
        React.createElement('div', { className: 'trip-summary-country' },
          React.createElement('span', null, country.flag),
          React.createElement('span', null, country.name)
        ),
        React.createElement('div', { className: 'trip-summary-dates' },
          `${formatDate(trip.start_date)} - ${formatDate(trip.end_date)} (${getDaysBetween(trip.start_date, trip.end_date).length}\uC77C)`
        ),
        React.createElement('div', { className: 'trip-summary-meta' },
          `\uC7A5\uC18C ${trip.place_count || trip.placeCount || places.length}\uAC1C | `,
          React.createElement('span', {
            className: 'expense-link',
            onClick: () => navigate(`/trip/${tripId}/expense`)
          }, `\uD83E\uDE99 ${formatDualCurrency(Math.round(Number(trip.total_expense_krw || trip.totalExpense || 0)), trip.total_expense_local || 0, trip.local_currency)}`)
        )
      ),

      // Day Tabs
      React.createElement('div', { className: 'day-tabs' },
        days.map((day, i) => React.createElement('button', {
          key: day.date,
          className: `day-tab ${selectedDay === day.date ? 'active' : ''}`,
          onClick: () => setSelectedDay(day.date)
        }, `Day ${i + 1}`))
      ),
      // Accommodation Card(s) — In/Out/Normal/Split
      (() => {
        const { out, in: inn, normal } = dayAccoms;
        if (!out && !inn && !normal) return null;

        if (out && inn) {
          return React.createElement('div', { className: 'accom-split' },
            React.createElement(AccomCard, { accom: out, variant: 'out', onClick: () => navigate(`/trip/${tripId}/accommodation/${out.id}`) }),
            React.createElement('div', { className: 'accom-arrow' }, '→'),
            React.createElement(AccomCard, { accom: inn, variant: 'in', onClick: () => navigate(`/trip/${tripId}/accommodation/${inn.id}`) })
          );
        }
        if (out) return React.createElement(AccomCard, { accom: out, variant: 'out', onClick: () => navigate(`/trip/${tripId}/accommodation/${out.id}`) });
        if (inn) return React.createElement(AccomCard, { accom: inn, variant: 'in', onClick: () => navigate(`/trip/${tripId}/accommodation/${inn.id}`) });
        if (normal) return React.createElement(AccomCard, { accom: normal, variant: 'normal', onClick: () => navigate(`/trip/${tripId}/accommodation/${normal.id}`) });
        return null;
      })(),

      // Main Content Layout (Desktop: side by side)
      React.createElement('div', { className: 'trip-detail-layout' },
        // Left: Schedule
        React.createElement('div', null,
          // Map Toggle (Mobile)
          React.createElement('button', {
            className: 'map-toggle',
            onClick: () => setMapOpen(!mapOpen)
          }, mapOpen ? '\u25B2 \uC9C0\uB3C4 \uB2EB\uAE30' : '\u25BC \uC9C0\uB3C4 \uBCF4\uAE30'),

          mapOpen && React.createElement(MapView, { places: dayPlaces, dayAccommodations: dayAccoms, onPlaceClick: (p) => navigate(`/trip/${tripId}/day/${selectedDay}/place/${p.id}`) }),

          // Place list wrapper (header fixed + list scrollable)
          React.createElement('div', { className: 'place-list-wrapper' },
            React.createElement('div', { className: 'place-section-title', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement('span', null, '\uC7A5\uC18C \uBAA9\uB85D'),
              React.createElement('button', {
                className: 'topbar-btn', style: { width: 32, height: 32, fontSize: 14 },
                onClick: () => navigate(`/trip/${tripId}/day/${selectedDay}/place/new`)
              }, '+')
            ),

            dayPlaces.length === 0 ?
              React.createElement('div', { className: 'place-list-scroll' },
                React.createElement('div', { className: 'empty-state', style: { minHeight: 200 } },
                  React.createElement('div', { className: 'empty-state-icon', style: { width: 80, height: 80, fontSize: 32 } }, '\uD83D\uDCCD'),
                  React.createElement('div', { className: 'empty-state-title' }, '\uC774 \uB0A0\uC758 \uC77C\uC815\uC744 \uCD94\uAC00\uD574 \uBCF4\uC138\uC694'),
                  React.createElement('div', { className: 'empty-state-desc' }, '\uC7A5\uC18C\uB97C \uCD94\uAC00\uD558\uBA74 \uC9C0\uB3C4\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4'),
                  React.createElement('button', {
                    className: 'empty-state-btn',
                    onClick: () => navigate(`/trip/${tripId}/day/${selectedDay}/place/new`)
                  }, '+ \uC7A5\uC18C \uCD94\uAC00')
                )
              ) :
              React.createElement('div', { className: 'place-list-scroll' },
                React.createElement('div', { className: 'place-list' },
                  dayPlaces.map((place, idx) => {
                    const rawName = place.name || '';
                    const commaIdx = rawName.indexOf(',');
                    const shortName = commaIdx >= 0 ? rawName.slice(0, commaIdx).trim() : rawName;
                    const addrPart = commaIdx >= 0 ? rawName.slice(commaIdx + 1).trim() : '';
                    const riOut = dayAccoms.out ? getRouteInfo(place.id, place.lat, place.lng, 'out', Number(dayAccoms.out.lat), Number(dayAccoms.out.lng)) : null;
                    const riIn = dayAccoms.in ? getRouteInfo(place.id, place.lat, place.lng, 'in', Number(dayAccoms.in.lat), Number(dayAccoms.in.lng)) : null;
                    const riNormal = dayAccoms.normal && !dayAccoms.out && !dayAccoms.in ? getRouteInfo(place.id, place.lat, place.lng, 'normal', Number(dayAccoms.normal.lat), Number(dayAccoms.normal.lng)) : null;
                    const fmtRoute = (ri) => {
                      const d = ri.distance >= 1000 ? (ri.distance / 1000).toFixed(1) + 'km' : Math.round(ri.distance) + 'm';
                      const t = ri.duration >= 3600 ? Math.floor(ri.duration / 3600) + '시간 ' + Math.round((ri.duration % 3600) / 60) + '분' : Math.round(ri.duration / 60) + '분';
                      return `(거리: 약 ${d} / 시간: 약 ${t})`;
                    };
                    return React.createElement('div', {
                      key: place.id,
                      className: 'place-card',
                      style: { cursor: 'pointer' },
                      onClick: () => navigate(`/trip/${tripId}/day/${selectedDay}/place/${place.id}`)
                    },
                    React.createElement('div', { className: 'place-number' }, idx + 1),
                    React.createElement('div', { className: 'place-info' },
                      React.createElement('div', { className: 'place-name' }, shortName),
                      riOut && React.createElement('div', { className: 'place-route-info', style: { color: '#EF4444' } }, fmtRoute(riOut)),
                      riIn && React.createElement('div', { className: 'place-route-info', style: { color: '#2563EB' } }, fmtRoute(riIn)),
                      riNormal && !riOut && !riIn && React.createElement('div', { className: 'place-route-info' }, fmtRoute(riNormal)),
                      addrPart && React.createElement('div', { className: 'place-addr' }, addrPart),
                      place.visit_time && React.createElement('div', { className: 'place-time' }, place.visit_time),
                      place.memo && React.createElement('div', { className: 'place-memo' }, place.memo)
                    ),
                    React.createElement('div', { className: 'place-actions' },
                      React.createElement('button', {
                        className: 'place-delete-btn-icon',
                        onClick: (e) => { e.stopPropagation(); handleDeletePlace(place); }
                      }, '\uD83D\uDDD1\uFE0F')
                    )
                  );
                  })
                )
              )
          ),

          // Day Memo
          React.createElement('div', { className: 'day-memo' },
            React.createElement('div', { className: 'day-memo-title' }, '\uC624\uB298\uC758 \uBA54\uBAA8'),
            // 저장된 메모 목록
            memoEntries.length > 0 && React.createElement('div', { className: 'memo-entries' },
              memoEntries.map((entry, idx) =>
                React.createElement('div', { key: entry.id, className: 'memo-entry' },
                  React.createElement('span', { className: 'memo-entry-number' }, idx + 1 + '.'),
                  React.createElement('span', { className: 'memo-entry-text' }, entry.memo),
                  React.createElement('button', {
                    className: 'memo-entry-delete',
                    onClick: () => handleDeleteMemoEntry(entry.id)
                  }, '\u00D7')
                )
              )
            ),
            // 입력 영역
            React.createElement('textarea', {
              className: 'memo-input',
              placeholder: '\uBA54\uBAA8\uB97C \uC785\uB825\uD558\uC138\uC694... (50\uC790)',
              value: memoInput,
              maxLength: 50,
              rows: 1,
              onChange: e => setMemoInput(e.target.value),
              onInput: e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }
            }),
            memoInput.trim() && React.createElement('div', { className: 'memo-save-row' },
              React.createElement('button', {
                className: 'memo-save-btn',
                onClick: handleSaveMemo
              }, '\uC800\uC7A5')
            )
          )
        ),

        // Right: Map (Desktop only)
        React.createElement('div', { className: 'map-desktop-only' },
          React.createElement(MapView, { places: dayPlaces, dayAccommodations: dayAccoms })
        )
      )
    ),

    React.createElement(Modal, {
      open: showDeleteModal,
      title: '\uC5EC\uD589 \uC0AD\uC81C',
      body: (() => {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
        const isPast = trip?.end_date && normalizeDate(trip.end_date) < todayStr;
        const title = trip?.title || '';
        return isPast
          ? `'${title}'\uC740(\uB294) \uC9C0\uB09C \uCD94\uC5B5\uC758 \uC5EC\uD589\uC785\uB2C8\uB2E4.\n\uC815\uB9D0 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`
          : `\uC774 \uC5EC\uD589\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uBAA8\uB4E0 \uC77C\uC815\uACFC \uACBD\uBE44\uAC00 \uD568\uAED8 \uC0AD\uC81C\uB429\uB2C8\uB2E4.`;
      })(),
      confirmLabel: '\uC0AD\uC81C',
      confirmDanger: true,
      onConfirm: handleDeleteTrip,
      onCancel: () => setShowDeleteModal(false)
    }),

    React.createElement(Modal, {
      open: !!deletePlaceTarget,
      title: '\uC7A5\uC18C \uC0AD\uC81C',
      body: deletePlaceTarget
        ? `'${deletePlaceTarget.name || ''}'\uC744(\uB97C) \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`
        : '',
      confirmLabel: '\uC0AD\uC81C',
      confirmDanger: true,
      onConfirm: handleConfirmDeletePlace,
      onCancel: () => setDeletePlaceTarget(null)
    }),

    // Share Bottom Sheet
    showShareSheet && React.createElement(React.Fragment, null,
      React.createElement('div', {
        className: 'share-overlay',
        onClick: () => setShowShareSheet(false)
      }),
      React.createElement('div', { className: 'share-bottom-sheet' },
        React.createElement('div', { className: 'share-handle' }),
        React.createElement('div', { className: 'share-sheet-title' }, '\uACF5\uC720\uD558\uAE30'),
        React.createElement('div', { className: 'share-icons' },
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareCopyLink },
            React.createElement('div', { className: 'share-icon-circle share-icon-link' }, '\uD83D\uDD17'),
            React.createElement('span', { className: 'share-icon-label' }, '\uB9C1\uD06C \uBCF5\uC0AC')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareMessage },
            React.createElement('div', { className: 'share-icon-circle share-icon-message' }, '\u2709\uFE0F'),
            React.createElement('span', { className: 'share-icon-label' }, '\uBA54\uC2DC\uC9C0')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareKakao },
            React.createElement('div', { className: 'share-icon-circle share-icon-kakao' }, '\uD83D\uDCAC'),
            React.createElement('span', { className: 'share-icon-label' }, '\uCE74\uCE74\uC624\uD1A1')
          )
        ),
        React.createElement('div', { className: 'share-section-label' }, 'SNS\uB85C \uACF5\uC720'),
        React.createElement('div', { className: 'share-sns-scroll' },
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareTelegram },
            React.createElement('div', { className: 'share-icon-circle share-icon-telegram' }, '\u2708\uFE0F'),
            React.createElement('span', { className: 'share-icon-label' }, '\uD154\uB808\uADF8\uB7A8')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareLine },
            React.createElement('div', { className: 'share-icon-circle share-icon-line' }, '\uD83D\uDCAC'),
            React.createElement('span', { className: 'share-icon-label' }, '\uB77C\uC778')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareTwitter },
            React.createElement('div', { className: 'share-icon-circle share-icon-twitter' }, '\uD835\uDD4F'),
            React.createElement('span', { className: 'share-icon-label' }, '\uD2B8\uC704\uD130(X)')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareFacebook },
            React.createElement('div', { className: 'share-icon-circle share-icon-facebook' }, 'f'),
            React.createElement('span', { className: 'share-icon-label' }, '\uD398\uC774\uC2A4\uBD81')
          ),
          React.createElement('button', { className: 'share-icon-item', onClick: handleShareEmail },
            React.createElement('div', { className: 'share-icon-circle share-icon-email' }, '\uD83D\uDCE7'),
            React.createElement('span', { className: 'share-icon-label' }, '\uC774\uBA54\uC77C')
          )
        ),
        React.createElement('button', {
          className: 'share-cancel-btn',
          onClick: () => setShowShareSheet(false)
        }, '\uCDE8\uC18C')
      )
    )
  );
}
