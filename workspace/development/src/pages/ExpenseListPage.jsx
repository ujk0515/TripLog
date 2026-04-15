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
export default function ExpenseListPage({ currentTrip }) {
  const { path, navigate, goBack } = useRouter();
  const toast = useToast();
  const { apiCall } = useAuth();
  const params = matchRoute('/trip/:id/expense', path);
  const tripId = params?.id || currentTrip?.id;

  const [expenses, setExpenses] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const ptrContainerRef = useRef(null);

  useEffect(() => {
    if (tripId) loadData();
  }, [tripId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expData, plData] = await Promise.all([
        apiCall('GET', `/trips/${tripId}/expenses`),
        apiCall('GET', `/trips/${tripId}/places`),
      ]);
      setExpenses(expData);
      setPlaces(plData);
    } catch(e) {} finally { setLoading(false); }
  };

  const handlePullRefresh = useCallback(async () => {
    try {
      const [expData, plData] = await Promise.all([
        apiCall('GET', `/trips/${tripId}/expenses`),
        apiCall('GET', `/trips/${tripId}/places`),
      ]);
      setExpenses(expData);
      setPlaces(plData);
    } catch(e) {}
  }, [apiCall, tripId]);

  const { indicatorEl: ptrIndicator } = usePullToRefresh(ptrContainerRef, handlePullRefresh);

  const handleDelete = async (expenseId) => {
    try {
      await apiCall('DELETE', `/trips/${tripId}/expenses/${expenseId}`);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast('\uACBD\uBE44\uAC00 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch(e) { toast('\uC0AD\uC81C \uC2E4\uD328'); }
  };

  // Summary calculation
  const categoryTotals = {};
  let totalKRW = 0;
  let totalLocal = 0;
  const country = currentTrip ? getCountryByCode(currentTrip.country_code) : null;
  const localCurrency = country?.currency || null;
  expenses.forEach(e => {
    const krw = Math.round(e.amount * (e.exchange_rate || 1));
    totalKRW += krw;
    if (localCurrency && e.currency === localCurrency) {
      totalLocal += Math.round(Number(e.amount));
    }
    const cat = CATEGORIES.find(c => c.id === e.category) || { id: e.category, label: e.category };
    categoryTotals[cat.label] = (categoryTotals[cat.label] || 0) + krw;
  });

  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'topbar' },
      React.createElement('div', { className: 'topbar-left' },
        React.createElement('button', { className: 'topbar-back', onClick: () => navigate(`/trip/${tripId}`) }, '\u2190'),
        React.createElement('span', { className: 'topbar-title' }, '\uACBD\uBE44 \uBAA9\uB85D')
      )
    ),
    React.createElement('div', { className: 'trip-detail-page', ref: ptrContainerRef },
      ptrIndicator,
      loading ? React.createElement(SkeletonCards, { count: 2 }) :
      React.createElement(React.Fragment, null,
        // Summary
        React.createElement('div', { className: 'expense-summary' },
          React.createElement('div', { className: 'expense-total' }, `\uD569\uACC4: ${formatDualAmount(totalKRW, totalLocal, localCurrency)}`),
          React.createElement('div', { className: 'expense-categories' },
            Object.entries(categoryTotals).map(([label, amount]) =>
              `${label} \u20A9${amount.toLocaleString()}`
            ).join('  ')
          )
        ),

        expenses.length === 0 ?
          React.createElement('div', { className: 'empty-state', style: { minHeight: 200 } },
            React.createElement('div', { className: 'empty-state-icon', style: { width: 80, height: 80, fontSize: 32 } }, '\uD83D\uDCB0'),
            React.createElement('div', { className: 'empty-state-title' }, '\uACBD\uBE44\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'),
            React.createElement('div', { className: 'empty-state-desc' }, '\uACBD\uBE44\uB97C \uCD94\uAC00\uD574 \uBCF4\uC138\uC694'),
          ) :
          React.createElement('div', { className: 'expense-list' },
            expenses.map(expense => {
              const cat = CATEGORIES.find(c => c.id === expense.category) || { id: 'other', label: '\uAE30\uD0C0' };
              const krwAmount = Math.round(expense.amount * (expense.exchange_rate || 1));
              return React.createElement('div', { key: expense.id, className: 'expense-card' },
                React.createElement('span', { className: `expense-category-badge ${cat.id}` }, cat.label),
                React.createElement('div', { className: 'expense-info' },
                  React.createElement('div', { className: 'expense-title' }, expense.title),
                  React.createElement('div', { className: 'expense-amount' }, formatCurrency(expense.amount, expense.currency)),
                  expense.currency !== 'KRW' && React.createElement('div', { className: 'expense-krw' }, `(\u2248\u20A9${krwAmount.toLocaleString()})`)
                ),
                React.createElement('div', { style: { position: 'relative' } },
                  React.createElement('button', {
                    className: 'expense-more-btn',
                    onClick: () => setActiveDropdown(activeDropdown === expense.id ? null : expense.id)
                  }, '\u00B7\u00B7\u00B7'),
                  activeDropdown === expense.id && React.createElement('div', { className: 'expense-dropdown' },
                    React.createElement('button', {
                      className: 'expense-dropdown-item',
                      onClick: () => { setActiveDropdown(null); navigate(`/trip/${tripId}/expense/${expense.id}/edit`); }
                    }, '\uC218\uC815'),
                    React.createElement('button', {
                      className: 'expense-dropdown-item danger',
                      onClick: () => { setActiveDropdown(null); handleDelete(expense.id); }
                    }, '\uC0AD\uC81C')
                  )
                )
              );
            })
          )
      )
    ),
    React.createElement('button', {
      className: 'fab',
      onClick: () => navigate(`/trip/${tripId}/expense/new`)
    }, '+')
  );
}

// ============================================================
// EXPENSE ADD/EDIT PAGE
