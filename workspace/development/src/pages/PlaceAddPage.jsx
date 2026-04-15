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
export default function PlaceAddPage() {
  const { path, navigate, goBack } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();

  // Match both new and edit routes
  const newParams = matchRoute('/trip/:tripId/day/:date/place/new', path);
  const editParams = matchRoute('/trip/:tripId/day/:date/place/:placeId/edit', path);
  const params = newParams || editParams;
  const isEdit = !!editParams;

  const [name, setName] = useState('');
  const [visitTime, setVisitTime] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [errors, setErrors] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLat, setSelectedLat] = useState(null);
  const [selectedLng, setSelectedLng] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isEdit && params) {
      setFetching(true);
      apiCall('GET', `/trips/${params.tripId}/places`).then(places => {
        const place = places.find(p => p.id === params.placeId);
        if (place) {
          setName(place.name);
          setVisitTime(place.visit_time || '');
          setMemo(place.memo || '');
          if (place.lat != null) setSelectedLat(place.lat);
          if (place.lng != null) setSelectedLng(place.lng);
        }
      }).finally(() => setFetching(false));
    }
  }, []);

  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    setSelectedLat(null);
    setSelectedLng(null);
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchNominatim(val, null, null);
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);
  };

  const handleSelectPlace = (item) => {
    setName(item.display_name);
    setSelectedLat(parseFloat(item.lat));
    setSelectedLng(parseFloat(item.lon));
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!name.trim()) newErrors.name = '장소명을 입력해 주세요';
    if (!params.date) newErrors.date = '날짜를 선택해 주세요';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    const body = { name: name.trim(), visit_time: visitTime || null, memo: memo.trim(), date: params.date, lat: selectedLat, lng: selectedLng };
    try {
      if (isEdit) {
        await apiCall('PUT', `/trips/${params.tripId}/places/${params.placeId}`, body);
        toast('\uC7A5\uC18C\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      } else {
        await apiCall('POST', `/trips/${params.tripId}/places`, body);
        toast('\uC7A5\uC18C\uAC00 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      }
      navigate(`/trip/${params.tripId}?day=${params.date}`);
    } catch(e) {
      if (e.error === 'date_out_of_range') {
        toast('날짜가 여행 기간 범위를 벗어났습니다');
      } else {
        toast('\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4');
      }
    }
    finally { setLoading(false); }
  };

  if (fetching) return React.createElement('div', { className: 'form-page' }, React.createElement(SkeletonCards, { count: 1 }));

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, isEdit ? '\uC7A5\uC18C \uC218\uC815' : '\uC7A5\uC18C \uCD94\uAC00')
      )
    ),
    React.createElement('form', { className: 'form-page', onSubmit: handleSubmit },
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' },
          '\uB0A0\uC9DC',
          React.createElement('span', { className: 'form-label-required' }, '*')
        ),
        React.createElement('input', {
          className: 'form-input' + (errors.date ? ' form-input-error' : ''),
          type: 'date',
          value: params.date || '',
          disabled: true
        }),
        errors.date && React.createElement('div', { className: 'form-error-text' }, errors.date)
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' },
          '\uC7A5\uC18C\uBA85',
          React.createElement('span', { className: 'form-label-required' }, '*')
        ),
        React.createElement('div', { className: 'search-input-wrap' },
          React.createElement('input', {
            className: 'form-input' + (errors.name ? ' form-input-error' : '') + (selectedLat != null ? ' locked' : ''),
            placeholder: '\uC7A5\uC18C \uAC80\uC0C9 (\uC608: \uC5D0\uD3A0\uD0D1)',
            value: name,
            readOnly: selectedLat != null,
            onChange: handleNameChange,
            onBlur: () => { setTimeout(() => setShowDropdown(false), 200); }
          }),
          selectedLat != null && React.createElement('button', {
            type: 'button',
            className: 'search-clear-btn',
            onClick: () => {
              setName(''); setSelectedLat(null); setSelectedLng(null);
              setSearchResults([]); setShowDropdown(false);
            }
          }, '\u2715'),
          showDropdown && searchResults.length > 0 && React.createElement('div', { className: 'nominatim-dropdown' },
            searchResults.map((item, idx) =>
              React.createElement('div', {
                key: idx,
                className: 'nominatim-item',
                onMouseDown: (e) => { e.preventDefault(); handleSelectPlace(item); },
                onTouchStart: () => handleSelectPlace(item)
              }, item.display_name)
            )
          )
        ),
        errors.name && React.createElement('div', { className: 'form-error-text' }, errors.name)
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uBC29\uBB38 \uC2DC\uAC04'),
        React.createElement('input', {
          className: 'form-input', type: 'time', placeholder: '\uC608: 14:00',
          value: visitTime, onChange: e => setVisitTime(e.target.value)
        })
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uBA54\uBAA8'),
        React.createElement('textarea', {
          className: 'day-memo-textarea', placeholder: '\uC790\uC720 \uD14D\uC2A4\uD2B8 \uC785\uB825',
          value: memo, onChange: e => setMemo(e.target.value), style: { minHeight: 120 }
        })
      ),
      // Map preview when coordinates are selected
      selectedLat != null && selectedLng != null && React.createElement('div', { className: 'place-add-map' },
        React.createElement(MapView, { places: [{ lat: selectedLat, lng: selectedLng, name: name }] })
      ),

      React.createElement('button', {
        className: 'form-submit', type: 'submit', disabled: loading
      }, loading ? React.createElement(Spinner) : '\uC800\uC7A5'),
      React.createElement('div', { className: 'form-hint' }, '\uC800\uC7A5 \uC911: \uBC84\uD2BC \uBE44\uD65C\uC131\uD654 + \uC2A4\uD53C\uB108')
    )
  );
}

// ============================================================
// EXPENSE LIST PAGE
