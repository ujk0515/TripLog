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
export default function AccommodationDetailPage() {
  const { path, navigate, goBack } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();
  const params = matchRoute('/trip/:id/accommodation/:accomId', path);
  const tripId = params?.id;
  const accomId = params?.accomId;

  const [accom, setAccom] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [guestCount, setGuestCount] = useState(1);
  const [pricePerPerson, setPricePerPerson] = useState('');

  useEffect(() => {
    if (tripId) loadData();
  }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tripData = await apiCall('GET', `/trips/${tripId}`);
      setTrip(tripData);
      const accomList = await apiCall('GET', `/trips/${tripId}/accommodations`);
      const accomData = Array.isArray(accomList) ? accomList.find(a => String(a.id) === String(accomId)) : null;
      if (accomData) {
        setAccom(accomData);
        setGuestCount(accomData.guest_count || 1);
        setPricePerPerson(accomData.price_per_person ? String(accomData.price_per_person) : '');
      }
    } catch(e) {}
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    if (!accom) return;
    setSaving(true);
    const body = {
      name: accom.name,
      address: accom.address,
      lat: accom.lat,
      lng: accom.lng,
      guest_count: guestCount,
      price_per_person: pricePerPerson ? Number(pricePerPerson) : 0,
      currency: accom.currency || 'KRW',
      exchange_rate: accom.exchange_rate || 1,
      check_in_date: accom.check_in_date || null,
      check_out_date: accom.check_out_date || null,
    };
    try {
      await apiCall('PUT', `/trips/${tripId}/accommodations/${accomId}`, body);
      toast('\uC219\uC18C \uC815\uBCF4\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      goBack();
    } catch(e) { toast('\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '\uC219\uC18C \uC0C1\uC138')
        )
      ),
      React.createElement('div', { className: 'accom-detail-page' }, React.createElement(SkeletonCards, { count: 2 }))
    );
  }

  if (!accom) {
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'topbar' },
        React.createElement('div', { className: 'topbar-left' },
          React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
          React.createElement('span', { className: 'topbar-title' }, '\uC219\uC18C \uC0C1\uC138')
        )
      ),
      React.createElement('div', { className: 'accom-detail-page' },
        React.createElement('div', { className: 'empty-state' },
          React.createElement('div', { className: 'empty-state-title' }, '\uC219\uC18C \uC815\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4')
        )
      )
    );
  }

  const localCurrency = accom.currency || (trip ? getCountryByCode(trip.country_code).currency : 'KRW');
  const rate = accom.exchange_rate || 1;
  const totalLocal = guestCount * (pricePerPerson ? Number(pricePerPerson) : 0);
  const totalKRW = localCurrency === 'KRW' ? totalLocal : Math.round(totalLocal * rate);

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, '\uC219\uC18C \uC0C1\uC138')
      )
    ),
    React.createElement('div', { className: 'accom-detail-page' },
      (() => {
        // 방어: 기존 DB의 name에 긴 주소가 들어있을 수 있음 → 콤마 앞뒤 분리
        const rawName = accom.name || '';
        const rawAddr = accom.address || '';
        const commaIdx = rawName.indexOf(',');
        const shortName = commaIdx >= 0 ? rawName.slice(0, commaIdx).trim() : rawName;
        let addrPart = rawAddr;
        if (!addrPart || addrPart === rawName || addrPart.startsWith(rawName)) {
          addrPart = commaIdx >= 0 ? rawName.slice(commaIdx + 1).trim() : '';
        }
        const copyToClip = (text, field) => {
          navigator.clipboard.writeText(text).then(() => {
            setCopiedField(field);
            toast('\uBCF5\uC0AC\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
            setTimeout(() => setCopiedField(null), 2000);
          }).catch(() => toast('\uBCF5\uC0AC \uC2E4\uD328'));
        };
        const copyIcon = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
          React.createElement('rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }),
          React.createElement('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' })
        );
        const checkIcon = React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: '#2563EB', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' },
          React.createElement('polyline', { points: '20 6 9 17 4 12' })
        );
        return React.createElement(React.Fragment, null,
          // Read-only: name + copy
          React.createElement('div', { className: 'accom-detail-row' },
            React.createElement('div', { className: 'accom-detail-label-row' },
              React.createElement('span', null, '\uC219\uC18C\uBA85'),
              React.createElement('button', {
                type: 'button', className: `copy-icon-btn${copiedField === 'name' ? ' copied' : ''}`,
                onClick: () => copyToClip(shortName, 'name')
              }, copiedField === 'name' ? checkIcon : copyIcon)
            ),
            React.createElement('div', { className: 'accom-detail-value' }, shortName)
          ),
          // Read-only: address + copy
          addrPart && React.createElement('div', { className: 'accom-detail-row' },
            React.createElement('div', { className: 'accom-detail-label-row' },
              React.createElement('span', null, '\uC8FC\uC18C'),
              React.createElement('button', {
                type: 'button', className: `copy-icon-btn${copiedField === 'addr' ? ' copied' : ''}`,
                onClick: () => copyToClip(addrPart, 'addr')
              }, copiedField === 'addr' ? checkIcon : copyIcon)
            ),
            React.createElement('div', { className: 'accom-detail-value' }, addrPart)
          )
        );
      })(),
      // Read-only: lat/lng
      (accom.lat != null && accom.lng != null) && React.createElement('div', { className: 'accom-detail-row' },
        React.createElement('div', { className: 'accom-detail-label' }, '\uC88C\uD45C'),
        React.createElement('div', { className: 'accom-detail-value' }, `${Number(accom.lat).toFixed(5)}, ${Number(accom.lng).toFixed(5)}`)
      ),
      // Read-only: check-in date
      accom.check_in_date && React.createElement('div', { className: 'accom-detail-row' },
        React.createElement('div', { className: 'accom-detail-label' }, '\uCCB4\uD06C\uC778'),
        React.createElement('div', { className: 'accom-detail-value' }, formatDate(accom.check_in_date))
      ),
      // Read-only: check-out date
      accom.check_out_date && React.createElement('div', { className: 'accom-detail-row' },
        React.createElement('div', { className: 'accom-detail-label' }, '\uCCB4\uD06C\uC544\uC6C3'),
        React.createElement('div', { className: 'accom-detail-value' }, formatDate(accom.check_out_date))
      ),

      // Editable: guest count stepper
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uC778\uC6D0'),
        React.createElement('div', { className: 'stepper' },
          React.createElement('button', {
            type: 'button', className: 'stepper-btn',
            onClick: () => setGuestCount(prev => Math.max(1, prev - 1))
          }, '\u2212'),
          React.createElement('span', { className: 'stepper-val' }, guestCount),
          React.createElement('button', {
            type: 'button', className: 'stepper-btn',
            onClick: () => setGuestCount(prev => prev + 1)
          }, '+')
        )
      ),

      // Editable: price per person
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, `1\uC778\uB2F9 \uAE08\uC561 (${localCurrency})`),
        React.createElement('input', {
          className: 'form-input', type: 'number', placeholder: '0', min: '0', step: 'any',
          value: pricePerPerson, onChange: e => setPricePerPerson(e.target.value)
        })
      ),

      // Total cost (auto-calculated)
      React.createElement('div', { className: 'accom-total-row' },
        React.createElement('span', { className: 'accom-total-label' }, '\uCD1D \uBE44\uC6A9'),
        React.createElement('span', { className: 'accom-total-value' },
          formatDualAmount(totalKRW, localCurrency !== 'KRW' ? totalLocal : null, localCurrency)
        )
      ),

      // Save button
      React.createElement('button', {
        className: 'form-submit', style: { marginTop: 24 },
        onClick: handleSave, disabled: saving
      }, saving ? React.createElement(Spinner) : '\uC800\uC7A5')
    )
  );
}

// ============================================================
// SHARE VIEW PAGE
