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
export default function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || '\uB85C\uADF8\uC778 \uC2E4\uD328');
    } finally {
      setLoading(false);
    }
  };

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' },
        React.createElement('img', { className: 'auth-logo-img', src: 'icons/icon-512.png', alt: 'TripLog', style: { width: '200px', height: '200px', objectFit: 'contain', borderRadius: '36px' } }),
        React.createElement('div', { className: 'auth-logo-title', style: { marginTop: '12px', fontSize: '24px', fontWeight: '700', color: '#1E293B' } }, 'TripLog')
      ),
      React.createElement('form', { className: 'auth-form', onSubmit: handleSubmit },
        React.createElement('input', {
          className: 'auth-input', type: 'email', placeholder: '\uC774\uBA54\uC77C',
          value: email, onChange: e => setEmail(e.target.value)
        }),
        React.createElement('div', { className: 'auth-input-wrapper' },
          React.createElement('input', {
            className: 'auth-input', type: showPassword ? 'text' : 'password', placeholder: '\uBE44\uBC00\uBC88\uD638',
            value: password, onChange: e => setPassword(e.target.value)
          }),
          React.createElement('button', {
            type: 'button', className: 'auth-password-toggle',
            onClick: () => setShowPassword(v => !v),
            'aria-label': showPassword ? '\uBE44\uBC00\uBC88\uD638 \uC228\uAE30\uAE30' : '\uBE44\uBC00\uBC88\uD638 \uBCF4\uAE30'
          }, React.createElement(PasswordToggleIcon, { visible: showPassword }))
        ),
        React.createElement('div', { className: `auth-error ${error ? 'visible' : ''}` },
          '\u203B ', error || '\uC774\uBA54\uC77C \uB610\uB294 \uBE44\uBC00\uBC88\uD638 \uBD88\uC77C\uCE58 (\uC5D0\uB7EC \uC0C1\uD0DC)'
        ),
        React.createElement('button', {
          className: 'auth-btn', type: 'submit', disabled: loading
        }, loading ? React.createElement(Spinner) : '\uB85C\uADF8\uC778'),
      ),
      React.createElement('div', { className: 'auth-link' },
        '\uACC4\uC815\uC774 \uC5C6\uC73C\uC2E0\uAC00\uC694? ',
        React.createElement('a', { onClick: () => navigate('/register') }, '\uD68C\uC6D0\uAC00\uC785 \u2192')
      )
    )
  );
}
