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
export default function TripCreatePage({ onSelectTrip, editTrip }) {
  const { navigate, goBack } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();
  const [title, setTitle] = useState(editTrip?.title || '');
  const [countryCode, setCountryCode] = useState(editTrip?.country_code || '');
  const [startDate, setStartDate] = useState(editTrip?.start_date || '');
  const [endDate, setEndDate] = useState(editTrip?.end_date || '');
  const [loading, setLoading] = useState(false);

  // Calendar state
  const calTriggerRef = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (editTrip?.start_date) {
      const d = new Date(editTrip.start_date);
      return { year: d.getFullYear(), month: d.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const handleDateSelect = useCallback((dateStr) => {
    if (!startDate || (startDate && endDate)) {
      // New selection or re-selection: reset and set start date
      setStartDate(dateStr);
      setEndDate('');
    } else {
      // Selecting end date
      if (dateStr < startDate) {
        // Reverse selection: reset, use clicked date as new start
        setStartDate(dateStr);
        setEndDate('');
      } else {
        // Valid end date (same day or later)
        setEndDate(dateStr);
        setShowCalendar(false);
      }
    }
  }, [startDate, endDate]);

  const handleCalendarClose = useCallback(() => {
    setShowCalendar(false);
  }, []);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}.${m}.${d}`;
  };

  // Accommodation mode: 'all' (전체) or 'perday' (일자별)
  const [accomMode, setAccomMode] = useState('all');

  // Single accommodation fields (for 'all' mode)
  const [accomName, setAccomName] = useState('');
  const [accomAddress, setAccomAddress] = useState('');
  const [accomLat, setAccomLat] = useState(null);
  const [accomLng, setAccomLng] = useState(null);
  const [accomGuestCount, setAccomGuestCount] = useState(1);
  const [accomPrice, setAccomPrice] = useState('');
  const [accomCurrency, setAccomCurrency] = useState('KRW');
  const [accomExchangeRate, setAccomExchangeRate] = useState('');
  const [accomSearchResults, setAccomSearchResults] = useState([]);
  const [accomShowDropdown, setAccomShowDropdown] = useState(false);
  const accomDebounceRef = useRef(null);

  // Multiple accommodation list (for 'perday' mode)
  const emptyAccom = () => ({
    name: '', address: '', lat: null, lng: null,
    guestCount: 1, price: '', currency: 'KRW', exchangeRate: '',
    checkIn: '', checkOut: '', searchResults: [], showDropdown: false,
    showCal: false, calMonth: null
  });
  const [accomList, setAccomList] = useState([emptyAccom()]);
  const [openAccomIdx, setOpenAccomIdx] = useState(0);

  const handleAccomDateSelect = (aIdx, dateStr) => {
    setAccomList(prev => {
      const item = prev[aIdx];
      let next = prev.slice();
      let checkOutFinal = item.checkOut;
      if (!item.checkIn || (item.checkIn && item.checkOut)) {
        next[aIdx] = { ...item, checkIn: dateStr, checkOut: '', showCal: true };
        checkOutFinal = '';
      } else {
        if (dateStr < item.checkIn) {
          next[aIdx] = { ...item, checkIn: dateStr, checkOut: '', showCal: true };
          checkOutFinal = '';
        } else {
          next[aIdx] = { ...item, checkOut: dateStr, showCal: false };
          checkOutFinal = dateStr;
        }
      }
      // 체크아웃 확정 시 다음 블록의 체크인을 자동 연동
      if (checkOutFinal && aIdx + 1 < next.length) {
        next[aIdx + 1] = { ...next[aIdx + 1], checkIn: checkOutFinal };
      }
      return next;
    });
  };
  const accomListDebounceRefs = useRef([]);

  // Load existing accommodations when editing
  useEffect(() => {
    if (editTrip) {
      apiCall('GET', `/trips/${editTrip.id}/accommodations`).then(list => {
        if (Array.isArray(list) && list.length > 0) {
          if (list.length === 1 && (!list[0].check_in_date || (list[0].check_in_date === editTrip.start_date && list[0].check_out_date === editTrip.end_date))) {
            setAccomMode('all');
            const a = list[0];
            setAccomName(a.name || '');
            setAccomAddress(a.address || '');
            setAccomLat(a.lat);
            setAccomLng(a.lng);
            setAccomGuestCount(a.guest_count || 1);
            setAccomPrice(a.price_per_person ? String(a.price_per_person) : '');
            setAccomCurrency(a.currency || 'KRW');
            setAccomExchangeRate(a.exchange_rate ? String(a.exchange_rate) : '');
          } else {
            setAccomMode('perday');
            setAccomList(list.map(a => ({
              name: a.name || '', address: a.address || '', lat: a.lat, lng: a.lng,
              guestCount: a.guest_count || 1,
              price: a.price_per_person ? String(a.price_per_person) : '',
              currency: a.currency || 'KRW',
              exchangeRate: a.exchange_rate ? String(a.exchange_rate) : '',
              checkIn: a.check_in_date || '', checkOut: a.check_out_date || '',
              searchResults: [], showDropdown: false, id: a.id
            })));
          }
        }
      }).catch(() => {});
    }
  }, [editTrip]);

  const handleAccomNameChange = (e) => {
    const val = e.target.value;
    setAccomName(val);
    setAccomLat(null);
    setAccomLng(null);
    setAccomAddress('');
    if (accomDebounceRef.current) clearTimeout(accomDebounceRef.current);
    if (!val.trim()) {
      setAccomSearchResults([]);
      setAccomShowDropdown(false);
      return;
    }
    accomDebounceRef.current = setTimeout(async () => {
      try {
        const data = await searchNominatim(val, null, null);
        setAccomSearchResults(data);
        setAccomShowDropdown(data.length > 0);
      } catch {
        setAccomSearchResults([]);
        setAccomShowDropdown(false);
      }
    }, 500);
  };

  const handleAccomSelectPlace = (item) => {
    setAccomName(item.display_name);
    setAccomAddress(item.display_name);
    setAccomLat(parseFloat(item.lat));
    setAccomLng(parseFloat(item.lon));
    setAccomShowDropdown(false);
    setAccomSearchResults([]);
  };

  // Per-day accommodation handlers
  const updateAccomListItem = (idx, updates) => {
    setAccomList(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const handleAccomListNameChange = (idx, val) => {
    updateAccomListItem(idx, { name: val, lat: null, lng: null, address: '' });
    if (!accomListDebounceRefs.current[idx]) accomListDebounceRefs.current[idx] = null;
    if (accomListDebounceRefs.current[idx]) clearTimeout(accomListDebounceRefs.current[idx]);
    if (!val.trim()) {
      updateAccomListItem(idx, { searchResults: [], showDropdown: false });
      return;
    }
    accomListDebounceRefs.current[idx] = setTimeout(async () => {
      try {
        const data = await searchNominatim(val, null, null);
        updateAccomListItem(idx, { searchResults: data, showDropdown: data.length > 0 });
      } catch {
        updateAccomListItem(idx, { searchResults: [], showDropdown: false });
      }
    }, 500);
  };

  const handleAccomListSelectPlace = (idx, item) => {
    updateAccomListItem(idx, {
      name: item.display_name,
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      searchResults: [],
      showDropdown: false
    });
  };

  const addAccomBlock = () => {
    const prev = accomList[accomList.length - 1];
    const newItem = emptyAccom();
    if (prev?.checkOut) newItem.checkIn = prev.checkOut;
    setAccomList(list => [...list, newItem]);
    setOpenAccomIdx(accomList.length);
  };

  const removeAccomBlock = (idx) => {
    if (accomList.length <= 1) return;
    setAccomList(list => list.filter((_, i) => i !== idx));
    if (openAccomIdx === idx) {
      setOpenAccomIdx(0);
    } else if (openAccomIdx > idx) {
      setOpenAccomIdx(prev => prev - 1);
    }
  };

  const isValid = title.trim() && countryCode && startDate && endDate && startDate <= endDate;

  // Accommodation gap popup state
  const [showAccomGapPopup, setShowAccomGapPopup] = useState(false);
  const [accomGapInfo, setAccomGapInfo] = useState({ tripDays: 0, accomDays: 0, gapDays: 0 });

  function calcAccomCoverage(sd, ed, list) {
    if (!sd || !ed) return { tripDays: 0, accomDays: 0, gapDays: 0 };
    const allDays = getDaysBetween(sd, ed);
    const tripDays = allDays.length;
    // 숙박 필요일 = 마지막 날(체크아웃 당일) 제외
    const nightDays = allDays.slice(0, -1);
    const totalNights = nightDays.length;
    const coveredNights = nightDays.filter(day => {
      return list.some(a => {
        if (!a.checkIn || !a.checkOut) return false;
        return day >= a.checkIn && day < a.checkOut;
      });
    });
    const accomDays = coveredNights.length;
    return { tripDays, accomDays, gapDays: totalNights - accomDays };
  }

  const handleSubmitConfirmed = async () => {
    setLoading(true);
    const country = getCountryByCode(countryCode);
    const body = { title: title.trim(), country: country.name, country_code: countryCode, start_date: startDate, end_date: endDate };
    try {
      let tripResult;
      if (editTrip) {
        tripResult = await apiCall('PUT', `/trips/${editTrip.id}`, body);
        onSelectTrip(tripResult);
      } else {
        tripResult = await apiCall('POST', '/trips', body);
        onSelectTrip(tripResult);
      }

      // Delete existing accommodations when editing before re-creating
      if (editTrip) {
        try {
          const existingAccoms = await apiCall('GET', `/trips/${tripResult.id}/accommodations`);
          if (Array.isArray(existingAccoms)) {
            for (const ea of existingAccoms) {
              try {
                await apiCall('DELETE', `/trips/${tripResult.id}/accommodations/${ea.id}`);
              } catch (delErr) { /* ignore individual delete errors */ }
            }
          }
        } catch (listErr) { /* no existing accommodations */ }
      }

      // Save accommodation(s)
      if (accomMode === 'all' && accomName.trim()) {
        const accomIsKRW = accomCurrency === 'KRW';
        const accomBody = {
          name: accomName.trim(),
          address: accomAddress || null,
          lat: accomLat,
          lng: accomLng,
          guest_count: accomGuestCount,
          price_per_person: accomPrice ? Number(accomPrice) : 0,
          currency: accomCurrency,
          exchange_rate: accomIsKRW ? 1 : (accomExchangeRate ? Number(accomExchangeRate) : 1),
          check_in_date: startDate || null,
          check_out_date: endDate || null,
        };
        try {
          await apiCall('POST', `/trips/${tripResult.id}/accommodations`, accomBody);
        } catch (accomErr) {
          if (accomErr?.status === 409 || accomErr?.message?.includes('겹')) {
            toast('숙소 날짜가 겹칩니다. 날짜를 확인해주세요');
          }
        }
      } else if (accomMode === 'perday') {
        for (const item of accomList) {
          if (!item.name.trim()) continue;
          const isKRW = item.currency === 'KRW';
          const body = {
            name: item.name.trim(),
            address: item.address || null,
            lat: item.lat,
            lng: item.lng,
            guest_count: item.guestCount,
            price_per_person: item.price ? Number(item.price) : 0,
            currency: item.currency,
            exchange_rate: isKRW ? 1 : (item.exchangeRate ? Number(item.exchangeRate) : 1),
            check_in_date: item.checkIn || null,
            check_out_date: item.checkOut || null,
          };
          try {
            await apiCall('POST', `/trips/${tripResult.id}/accommodations`, body);
          } catch (accomErr) {
            if (accomErr?.status === 409 || accomErr?.message?.includes('겹')) {
              toast('숙소 날짜가 겹칩니다. 날짜를 확인해주세요');
            }
          }
        }
      }

      if (editTrip) {
        navigate(`/trip/${tripResult.id}`);
        toast('\uC5EC\uD589\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      } else {
        navigate(`/trip/${tripResult.id}/schedule`);
      }
    } catch(e) { toast('\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    // Check accommodation gap (perday mode only)
    if (accomMode === 'perday') {
      const gap = calcAccomCoverage(startDate, endDate, accomList);
      if (gap.gapDays > 0) {
        setAccomGapInfo(gap);
        setShowAccomGapPopup(true);
        return;
      }
    }
    handleSubmitConfirmed();
  };

  const accomIsKRW = accomCurrency === 'KRW';

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: () => navigate('/') }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, editTrip ? '\uC5EC\uD589 \uC218\uC815' : '\uC0C8 \uC5EC\uD589')
      ),
      React.createElement('div', { className: 'topbar-right' })
    ),
    React.createElement('form', { id: 'trip-create-form', className: 'form-page trip-create-form-with-floating', onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uC5EC\uD589\uBA85'),
        React.createElement('input', {
          className: 'form-input', placeholder: '\uC608: \uB3C4\uCFC4 \uBD04 \uC5EC\uD589',
          value: title, onChange: e => setTitle(e.target.value)
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uAD6D\uAC00 \uC120\uD0DD'),
        React.createElement('select', {
          className: 'form-select', value: countryCode,
          onChange: e => setCountryCode(e.target.value)
        },
          React.createElement('option', { value: '' }, '\uAD6D\uAC00\uB97C \uC120\uD0DD\uD558\uC138\uC694'),
          COUNTRIES.map(c => React.createElement('option', { key: c.code, value: c.code }, `${c.flag} ${c.name}`))
        )
      ),
      React.createElement('div', { className: 'form-group', style: { position: 'relative', zIndex: 600 } },
        React.createElement('div', { className: 'form-row' },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('label', { className: 'form-label' }, '\uC2DC\uC791\uC77C'),
            React.createElement('div', {
              className: `cal-trigger-field ${startDate ? 'has-value' : ''}${showCalendar ? ' active' : ''}`,
              ref: calTriggerRef,
              onClick: () => setShowCalendar(prev => !prev)
            }, startDate ? formatDateDisplay(startDate) : '\uB0A0\uC9DC \uC120\uD0DD')
          ),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('label', { className: 'form-label' }, '\uC885\uB8CC\uC77C'),
            React.createElement('div', {
              className: `cal-trigger-field ${endDate ? 'has-value' : ''}${showCalendar ? ' active' : ''}`,
              onClick: () => setShowCalendar(prev => !prev)
            }, endDate ? formatDateDisplay(endDate) : '\uB0A0\uC9DC \uC120\uD0DD')
          )
        ),
        showCalendar && React.createElement(DateRangeCalendar, {
          startDate,
          endDate,
          onSelect: handleDateSelect,
          onClose: handleCalendarClose,
          calendarMonth,
          setCalendarMonth,
          triggerRef: calTriggerRef
        })
      ),

      // Accommodation section (optional)
      React.createElement(React.Fragment, null,
        React.createElement('div', { className: 'accom-section-title' }, '\uC219\uC18C \uC815\uBCF4 (\uC120\uD0DD)'),

        // Radio: 전체 / 일자별
        React.createElement('div', { className: 'accom-mode-radio' },
          React.createElement('label', { className: `accom-mode-option ${accomMode === 'all' ? 'active' : ''}` },
            React.createElement('input', {
              type: 'radio', name: 'accomMode', value: 'all',
              checked: accomMode === 'all',
              onChange: () => setAccomMode('all')
            }),
            '\uC804\uCCB4'
          ),
          React.createElement('label', { className: `accom-mode-option ${accomMode === 'perday' ? 'active' : ''}` },
            React.createElement('input', {
              type: 'radio', name: 'accomMode', value: 'perday',
              checked: accomMode === 'perday',
              onChange: () => setAccomMode('perday')
            }),
            '\uC77C\uC790\uBCC4'
          )
        ),
        React.createElement('div', { className: 'form-hint', style: { marginBottom: 12 } },
          accomMode === 'all' ? '\uD558\uB098\uC758 \uC219\uC18C\uAC00 \uC804\uCCB4 \uC5EC\uD589 \uAE30\uAC04\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4' : '\uC5EC\uD589 \uAE30\uAC04 \uB0B4 \uC219\uC18C\uB97C \uAD6C\uAC04\uBCC4\uB85C \uC124\uC815\uD569\uB2C8\uB2E4'
        ),

        // === ALL mode: single accommodation ===
        accomMode === 'all' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, '\uC219\uC18C \uAC80\uC0C9'),
            React.createElement('div', { className: 'search-input-wrap' },
              React.createElement('input', {
                className: `form-input${accomLat != null ? ' locked' : ''}`,
                placeholder: '\uC219\uC18C \uAC80\uC0C9 (\uC608: \uC2E0\uC8FC\uCFE0 \uD638\uD154)',
                value: accomName,
                readOnly: accomLat != null,
                onChange: handleAccomNameChange,
                onBlur: () => { setTimeout(() => setAccomShowDropdown(false), 200); }
              }),
              accomLat != null && React.createElement('button', {
                type: 'button',
                className: 'search-clear-btn',
                onClick: () => {
                  setAccomName(''); setAccomAddress(''); setAccomLat(null); setAccomLng(null);
                  setAccomSearchResults([]); setAccomShowDropdown(false);
                }
              }, '\u2715'),
              accomShowDropdown && accomSearchResults.length > 0 && React.createElement('div', { className: 'nominatim-dropdown' },
                accomSearchResults.map((item, idx) =>
                  React.createElement('div', {
                    key: idx,
                    className: 'nominatim-item',
                    onMouseDown: (e) => { e.preventDefault(); handleAccomSelectPlace(item); },
                    onTouchStart: () => handleAccomSelectPlace(item)
                  }, item.display_name)
                )
              )
            )
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, '\uC778\uC6D0'),
            React.createElement('div', { className: 'stepper' },
              React.createElement('button', {
                type: 'button', className: 'stepper-btn',
                onClick: () => setAccomGuestCount(prev => Math.max(1, prev - 1))
              }, '\u2212'),
              React.createElement('span', { className: 'stepper-val' }, accomGuestCount),
              React.createElement('button', {
                type: 'button', className: 'stepper-btn',
                onClick: () => setAccomGuestCount(prev => prev + 1)
              }, '+')
            )
          ),
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, '1\uC778\uB2F9 \uAE08\uC561'),
            React.createElement('div', { className: 'currency-row' },
              React.createElement('input', {
                className: 'form-input', type: 'number', placeholder: '0', min: '0', step: 'any',
                value: accomPrice, onChange: e => setAccomPrice(e.target.value)
              }),
              React.createElement(CurrencyDropdown, {
                value: accomCurrency,
                options: CURRENCIES,
                onChange: (v) => { setAccomCurrency(v); if (v === 'KRW') setAccomExchangeRate(''); }
              })
            )
          ),
          !accomIsKRW && React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, `\uD658\uC728 (1 ${accomCurrency} = ? KRW)`),
            React.createElement('input', {
              className: 'form-input', type: 'number', placeholder: '\uD658\uC728 \uC785\uB825', min: '0', step: 'any',
              value: accomExchangeRate, onChange: e => setAccomExchangeRate(e.target.value)
            }),
            accomExchangeRate && accomPrice && React.createElement('div', { className: 'form-hint' },
              `\u2248 \u20A9${Math.round(Number(accomPrice) * Number(accomExchangeRate) * accomGuestCount).toLocaleString()}`
            )
          )
        ),

        // === PERDAY mode: multiple accommodation blocks (accordion) ===
        accomMode === 'perday' && React.createElement(React.Fragment, null,
          accomList.map((aItem, aIdx) => {
            const aIsKRW = aItem.currency === 'KRW';
            const isOpen = openAccomIdx === aIdx;
            return React.createElement('div', { key: aIdx, className: `accom-accordion-item${isOpen ? ' open' : ''}` },
              // Accordion header
              React.createElement('div', {
                className: `accom-accordion-header${isOpen ? ' open' : ''}`,
                onClick: () => setOpenAccomIdx(isOpen ? -1 : aIdx)
              },
                React.createElement('span', { className: 'accom-accordion-arrow' }, isOpen ? '\u25BC' : '\u25B6'),
                React.createElement('div', { className: 'accom-accordion-summary' },
                  React.createElement('div', { className: 'accom-accordion-line1' },
                    React.createElement('span', { className: 'accom-accordion-title' }, `\uC219\uC18C ${aIdx + 1}`),
                    !isOpen && React.createElement('span', { className: 'accom-accordion-name' },
                      ' \u2014 ',
                      aItem.name
                        ? aItem.name
                        : React.createElement('span', { className: 'warn' }, '\uC219\uC18C \uBBF8\uC124\uC815')
                    )
                  ),
                  !isOpen && React.createElement('div', { className: 'accom-accordion-line2' },
                    (aItem.checkIn && aItem.checkOut)
                      ? React.createElement('span', null, `${formatDateDisplay(aItem.checkIn)} ~ ${formatDateDisplay(aItem.checkOut)}`)
                      : React.createElement('span', { className: 'warn' }, '\uB0A0\uC9DC \uBBF8\uC124\uC815'),
                    React.createElement('span', null, ` / \uC778\uC6D0 : ${aItem.guestCount || 1}\uBA85`)
                  )
                ),
                accomList.length > 1 && React.createElement('button', {
                  type: 'button', className: 'accom-block-remove',
                  onClick: (e) => { e.stopPropagation(); removeAccomBlock(aIdx); }
                }, '\uC0AD\uC81C')
              ),
              // Accordion body (only when open)
              isOpen && React.createElement('div', { className: 'accom-accordion-body' },
                // Date range (calendar picker)
                React.createElement('div', { className: 'form-group', style: { position: 'relative' } },
                  React.createElement('div', { className: 'form-row' },
                    React.createElement('div', { style: { flex: 1 } },
                      React.createElement('label', { className: 'form-label' }, '\uCCB4\uD06C\uC778'),
                      React.createElement('div', {
                        className: `cal-trigger-field ${aItem.checkIn ? 'has-value' : ''}`,
                        onClick: () => updateAccomListItem(aIdx, {
                          showCal: !aItem.showCal,
                          calMonth: aItem.calMonth || (() => {
                            const base = startDate ? new Date(startDate) : new Date();
                            return { year: base.getFullYear(), month: base.getMonth() };
                          })()
                        })
                      }, aItem.checkIn ? formatDateDisplay(aItem.checkIn) : '\uB0A0\uC9DC \uC120\uD0DD')
                    ),
                    React.createElement('div', { style: { flex: 1 } },
                      React.createElement('label', { className: 'form-label' }, '\uCCB4\uD06C\uC544\uC6C3'),
                      React.createElement('div', {
                        className: `cal-trigger-field ${aItem.checkOut ? 'has-value' : ''}`,
                        onClick: () => updateAccomListItem(aIdx, {
                          showCal: !aItem.showCal,
                          calMonth: aItem.calMonth || (() => {
                            const base = startDate ? new Date(startDate) : new Date();
                            return { year: base.getFullYear(), month: base.getMonth() };
                          })()
                        })
                      }, aItem.checkOut ? formatDateDisplay(aItem.checkOut) : '\uB0A0\uC9DC \uC120\uD0DD')
                    )
                  ),
                  aItem.showCal && React.createElement(DateRangeCalendar, {
                    startDate: aItem.checkIn,
                    endDate: aItem.checkOut,
                    minDate: startDate,
                    maxDate: endDate,
                    onSelect: (dateStr) => handleAccomDateSelect(aIdx, dateStr),
                    onClose: () => updateAccomListItem(aIdx, { showCal: false }),
                    calendarMonth: aItem.calMonth || (() => {
                      const base = startDate ? new Date(startDate) : new Date();
                      return { year: base.getFullYear(), month: base.getMonth() };
                    })(),
                    setCalendarMonth: (updater) => {
                      const base = startDate ? new Date(startDate) : new Date();
                      const prev = aItem.calMonth || { year: base.getFullYear(), month: base.getMonth() };
                      const next = typeof updater === 'function' ? updater(prev) : updater;
                      updateAccomListItem(aIdx, { calMonth: next });
                    }
                  })
                ),
                // Name search
                React.createElement('div', { className: 'form-group' },
                  React.createElement('label', { className: 'form-label' }, '\uC219\uC18C \uAC80\uC0C9'),
                  React.createElement('div', { className: 'search-input-wrap' },
                    React.createElement('input', {
                      className: `form-input${aItem.lat != null ? ' locked' : ''}`,
                      placeholder: '\uC219\uC18C \uAC80\uC0C9',
                      value: aItem.name,
                      readOnly: aItem.lat != null,
                      onChange: e => handleAccomListNameChange(aIdx, e.target.value),
                      onBlur: () => { setTimeout(() => updateAccomListItem(aIdx, { showDropdown: false }), 200); }
                    }),
                    aItem.lat != null && React.createElement('button', {
                      type: 'button',
                      className: 'search-clear-btn',
                      onClick: () => updateAccomListItem(aIdx, {
                        name: '', address: '', lat: null, lng: null,
                        searchResults: [], showDropdown: false
                      })
                    }, '\u2715'),
                    aItem.showDropdown && aItem.searchResults.length > 0 && React.createElement('div', { className: 'nominatim-dropdown' },
                      aItem.searchResults.map((sr, srIdx) =>
                        React.createElement('div', {
                          key: srIdx, className: 'nominatim-item',
                          onMouseDown: e => { e.preventDefault(); handleAccomListSelectPlace(aIdx, sr); },
                          onTouchStart: () => handleAccomListSelectPlace(aIdx, sr)
                        }, sr.display_name)
                      )
                    )
                  )
                ),
                // Guest count
                React.createElement('div', { className: 'form-group' },
                  React.createElement('label', { className: 'form-label' }, '\uC778\uC6D0'),
                  React.createElement('div', { className: 'stepper' },
                    React.createElement('button', {
                      type: 'button', className: 'stepper-btn',
                      onClick: () => updateAccomListItem(aIdx, { guestCount: Math.max(1, aItem.guestCount - 1) })
                    }, '\u2212'),
                    React.createElement('span', { className: 'stepper-val' }, aItem.guestCount),
                    React.createElement('button', {
                      type: 'button', className: 'stepper-btn',
                      onClick: () => updateAccomListItem(aIdx, { guestCount: aItem.guestCount + 1 })
                    }, '+')
                  )
                ),
                // Price
                React.createElement('div', { className: 'form-group' },
                  React.createElement('label', { className: 'form-label' }, '1\uC778\uB2F9 \uAE08\uC561'),
                  React.createElement('div', { className: 'currency-row' },
                    React.createElement('input', {
                      className: 'form-input', type: 'number', placeholder: '0', min: '0', step: 'any',
                      value: aItem.price, onChange: e => updateAccomListItem(aIdx, { price: e.target.value })
                    }),
                    React.createElement(CurrencyDropdown, {
                      value: aItem.currency,
                      options: CURRENCIES,
                      onChange: (v) => updateAccomListItem(aIdx, { currency: v, exchangeRate: v === 'KRW' ? '' : aItem.exchangeRate })
                    })
                  )
                ),
                !aIsKRW && React.createElement('div', { className: 'form-group' },
                  React.createElement('label', { className: 'form-label' }, `\uD658\uC728 (1 ${aItem.currency} = ? KRW)`),
                  React.createElement('input', {
                    className: 'form-input', type: 'number', placeholder: '\uD658\uC728 \uC785\uB825', min: '0', step: 'any',
                    value: aItem.exchangeRate, onChange: e => updateAccomListItem(aIdx, { exchangeRate: e.target.value })
                  })
                )
              )
            );
          }),
          React.createElement('button', {
            type: 'button', className: 'accom-add-btn',
            onClick: addAccomBlock
          }, '+ \uC219\uC18C \uCD94\uAC00')
        )
      ),

    ),

    // Floating submit button (outside form, linked via form attribute)
    React.createElement('div', { className: 'trip-create-floating-submit' },
      React.createElement('button', {
        className: 'form-submit', type: 'submit', form: 'trip-create-form', disabled: !isValid || loading
      }, loading ? React.createElement(Spinner) : (editTrip ? '\uC5EC\uD589 \uC218\uC815' : '\uB2E4\uC74C \uC77C\uC815 \uB9CC\uB4E4\uAE30')),
      React.createElement('div', { className: 'form-hint trip-create-floating-hint' }, '\u203B \uC5EC\uD589\uBA85, \uAD6D\uAC00 \uD544\uC218 | \uC2DC\uC791\uC77C \u2264 \uC885\uB8CC\uC77C')
    ),

    // Accommodation gap confirmation popup
    showAccomGapPopup && React.createElement('div', { className: 'modal-overlay', onClick: () => setShowAccomGapPopup(false) },
      React.createElement('div', { className: 'modal-card', onClick: e => e.stopPropagation() },
        React.createElement('div', { className: 'modal-info' },
          `\uC5EC\uD589 \uC77C\uC790: ${accomGapInfo.tripDays}\uC77C  |  \uC219\uC18C \uC77C\uC790: ${accomGapInfo.accomDays}\uC77C`
        ),
        React.createElement('div', { className: 'modal-message' },
          `${accomGapInfo.gapDays}\uC77C\uC758 \uC219\uC18C \uC77C\uC815\uC774 \uBE44\uC5B4\uC788\uC2B5\uB2C8\uB2E4.\n\uACC4\uC18D \uC9C4\uD589\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`
        ),
        React.createElement('div', { className: 'modal-buttons' },
          React.createElement('button', {
            type: 'button',
            className: 'modal-btn cancel',
            onClick: () => setShowAccomGapPopup(false)
          }, '\uCDE8\uC18C'),
          React.createElement('button', {
            type: 'button',
            className: 'modal-btn confirm',
            onClick: () => { setShowAccomGapPopup(false); handleSubmitConfirmed(); }
          }, '\uD655\uC778')
        )
      )
    )
  );
}

// ============================================================
// TRIP DETAIL PAGE
