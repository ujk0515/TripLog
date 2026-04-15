import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { matchRoute, useRouter } from '../contexts/RouterContext';
import { useToast } from '../contexts/ToastContext';
import { API_BASE, CATEGORIES, COUNTRIES, CURRENCIES } from '../utils/constants';
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
export default function ExpenseAddPage() {
  const { path, navigate, goBack } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();

  const newParams = matchRoute('/trip/:tripId/expense/new', path);
  const editParams = matchRoute('/trip/:tripId/expense/:expenseId/edit', path);
  const params = newParams || editParams;
  const isEdit = !!editParams;
  const tripId = params?.tripId;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [category, setCategory] = useState('food');
  const [placeId, setPlaceId] = useState('');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // 환율 자동화 state
  const [rates, setRates] = useState(null); // { USD: 1350.5, EUR: ... } — 1 KRW 기준 역수로 변환
  const [ratesError, setRatesError] = useState(false);
  const [ratesFetchedAt, setRatesFetchedAt] = useState(null); // ISO string

  // 수정 모드 전용: 저장된 환율/시각
  const [editExchangeRate, setEditExchangeRate] = useState(null);
  const [editRateFetchedAt, setEditRateFetchedAt] = useState(null);

  const fetchRates = async () => {
    setRatesError(false);
    try {
      const resp = await fetch(`${API_BASE}/rates?from=KRW&to=USD,EUR,JPY,CNY`);
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      // data.rates = { USD: 0.00074, EUR: ... } (1 KRW = X 외화)
      // 우리는 1 외화 = ? KRW 가 필요 → 역수
      const converted = {};
      for (const [cur, val] of Object.entries(data.rates)) {
        converted[cur] = val > 0 ? (1 / val) : 0;
      }
      setRates(converted);
      setRatesFetchedAt(new Date().toISOString());
    } catch {
      setRatesError(true);
    }
  };

  useEffect(() => {
    if (tripId) {
      apiCall('GET', `/trips/${tripId}/places`).then(setPlaces).catch(() => {});
    }
    if (isEdit && params?.expenseId) {
      setFetching(true);
      apiCall('GET', `/trips/${tripId}/expenses`).then(expenses => {
        const exp = expenses.find(e => e.id === params.expenseId);
        if (exp) {
          setTitle(exp.title);
          setAmount(String(exp.amount));
          setCurrency(exp.currency);
          setCategory(exp.category);
          setPlaceId(exp.place_id || '');
          setEditExchangeRate(exp.exchange_rate ? Number(exp.exchange_rate) : null);
          setEditRateFetchedAt(exp.rate_fetched_at || null);
        }
      }).finally(() => setFetching(false));
      // 수정 모드에서는 fetchRates 호출하지 않음
    } else {
      // 새 경비 추가 → 화면 진입 시 환율 1회 호출
      fetchRates();
    }
  }, []);

  const isKRW = currency === 'KRW';

  // 현재 환율 값 계산
  const currentRate = (() => {
    if (isKRW) return 1;
    if (isEdit && editExchangeRate != null) return editExchangeRate;
    if (rates && rates[currency]) return rates[currency];
    return null;
  })();

  // KRW 자동계산 값
  const krwCalcValue = (() => {
    if (isKRW) return null;
    if (currentRate && amount && Number(amount) > 0) {
      return Math.round(Number(amount) * currentRate);
    }
    return 0;
  })();

  // 유효성 검사: KRW이면 환율 불필요, 외화면 currentRate가 있어야 함
  const isValid = title.trim() && amount && Number(amount) > 0 && category && (isKRW || currentRate != null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    const body = {
      title: title.trim(),
      amount: Number(amount),
      currency,
      exchange_rate: isKRW ? 1 : currentRate,
      rate_fetched_at: isKRW ? null : (isEdit ? editRateFetchedAt : ratesFetchedAt),
      category,
      place_id: placeId || null,
      date: new Date().toISOString().split('T')[0],
    };
    try {
      if (isEdit) {
        await apiCall('PUT', `/trips/${tripId}/expenses/${params.expenseId}`, body);
        toast('\uACBD\uBE44\uAC00 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      } else {
        await apiCall('POST', `/trips/${tripId}/expenses`, body);
        toast('\uACBD\uBE44\uAC00 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
      }
      navigate(`/trip/${tripId}/expense`);
    } catch(e) { toast('\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4'); }
    finally { setLoading(false); }
  };

  // 안내 문구에 표시할 시각
  const displayFetchedAt = isEdit ? editRateFetchedAt : ratesFetchedAt;

  if (fetching) return React.createElement('div', { className: 'form-page' }, React.createElement(SkeletonCards, { count: 1 }));

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: goBack }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, isEdit ? '\uACBD\uBE44 \uC218\uC815' : '\uACBD\uBE44 \uCD94\uAC00')
      )
    ),
    React.createElement('form', { className: 'form-page', onSubmit: handleSubmit },
      // 제목 입력
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uD56D\uBAA9\uBA85 *'),
        React.createElement('input', {
          className: 'form-input', placeholder: '\uC608) \uC800\uB141 \uC2DD\uC0AC',
          value: title, onChange: e => setTitle(e.target.value)
        })
      ),
      // 카테고리
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uCE74\uD14C\uACE0\uB9AC *'),
        React.createElement('div', { className: 'category-selector' },
          CATEGORIES.map(cat => React.createElement('button', {
            key: cat.id, type: 'button',
            className: `category-chip ${category === cat.id ? 'selected' : ''}`,
            onClick: () => setCategory(cat.id)
          }, cat.label))
        )
      ),
      // 금액 + 통화
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uAE08\uC561 *'),
        React.createElement('div', { className: 'amount-row' },
          React.createElement('input', {
            className: 'form-input', type: 'number', placeholder: '0', min: '0', step: 'any',
            value: amount, onChange: e => setAmount(e.target.value)
          }),
          React.createElement(CurrencyDropdown, {
            value: currency,
            options: CURRENCIES,
            disabled: isEdit,
            onChange: (v) => setCurrency(v)
          })
        ),
        // KRW 자동계산 readonly 인풋 + 새로고침 버튼 (KRW 아닐 때만)
        !isKRW && React.createElement('div', { className: 'krw-calc-row' },
          React.createElement('input', {
            className: 'krw-readonly',
            type: 'text',
            readOnly: true,
            value: krwCalcValue != null && krwCalcValue > 0
              ? `\u2248 \u20A9${krwCalcValue.toLocaleString()}`
              : (ratesError ? '' : '\u2248 \u20A90')
          }),
          // 새로고침 버튼: 수정 모드에서는 미노출
          !isEdit && React.createElement('button', {
            type: 'button',
            className: `rate-refresh${ratesError ? ' error' : ''}`,
            onClick: fetchRates,
            title: '\uD658\uC728 \uC0C8\uB85C\uACE0\uCE68'
          }, '\u21BB')
        ),
        // 안내 문구 (KRW 아닐 때만)
        !isKRW && displayFetchedAt && React.createElement('div', { className: 'rate-notice' },
          `\u203B \uD574\uB2F9 \uAE08\uC561\uC740 ${formatRateTime(displayFetchedAt)}\uC758 \uD658\uC728\uB85C \uACC4\uC0B0\uB41C \uAE08\uC561\uC774\uC624\uB2C8 \uC2E4\uC81C \uC0AC\uC6A9\uD55C \uAE08\uC561\uACFC \uCC28\uC774\uAC00 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`
        ),
        // API 실패 안내
        !isKRW && ratesError && !isEdit && React.createElement('div', { className: 'rate-notice error' },
          '\uD658\uC728 \uC870\uD68C \uC2E4\uD328. \uC0C8\uB85C\uACE0\uCE68 \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694'
        ),
        // rate_fetched_at NULL이면 안내 문구 미노출 (위 조건으로 자동 처리)
      ),
      // 연결 장소
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, '\uC5F0\uACB0 \uC7A5\uC18C (\uC120\uD0DD)'),
        React.createElement('select', {
          className: 'form-select', value: placeId,
          onChange: e => setPlaceId(e.target.value)
        },
          React.createElement('option', { value: '' }, '\uC7A5\uC18C \uC120\uD0DD...'),
          places.map(p => React.createElement('option', { key: p.id, value: p.id }, p.name))
        )
      ),
      // 저장 버튼
      React.createElement('button', {
        className: 'form-submit', type: 'submit', disabled: !isValid || loading
      }, loading ? React.createElement(Spinner) : '\uC800\uC7A5')
    )
  );
}
