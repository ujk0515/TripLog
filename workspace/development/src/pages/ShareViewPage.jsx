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
export default function ShareViewPage() {
  const { path, navigate } = useRouter();
  const { user, apiCall } = useAuth();
  const toast = useToast();
  const params = matchRoute('/share/:shareToken', path);
  const shareToken = params?.shareToken;

  const [data, setData] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (shareToken) loadData();
  }, [shareToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shareData, commentData] = await Promise.all([
        apiCall('GET', `/share/${shareToken}`),
        apiCall('GET', `/share/${shareToken}/comments`),
      ]);
      setData(shareData);
      setComments(commentData);
    } catch(e) { setError(true); }
    finally { setLoading(false); }
  };

  const handleComment = async () => {
    if (!user) { setShowLoginModal(true); return; }
    if (!commentText.trim()) return;
    try {
      const comment = await apiCall('POST', `/share/${shareToken}/comments`, { content: commentText.trim() });
      setComments(prev => [...prev, comment]);
      setCommentText('');
      toast('\uB313\uAE00\uC774 \uC791\uC131\uB418\uC5C8\uC2B5\uB2C8\uB2E4');
    } catch(e) { toast('\uB313\uAE00 \uC791\uC131 \uC2E4\uD328'); }
  };

  if (loading) return React.createElement('div', { className: 'share-page' }, React.createElement(SkeletonCards, { count: 2 }));
  if (error) return React.createElement('div', { className: 'share-page' },
    React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'empty-state-title' }, '\uACF5\uC720 \uB9C1\uD06C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'),
      React.createElement('div', { className: 'empty-state-desc' }, '\uB9C1\uD06C\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uAC70\uB098 \uC874\uC7AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4')
    )
  );

  const { trip, days, viewerRole } = data;
  const country = getCountryByCode(trip.country_code);
  const isOwner = viewerRole === 'owner';

  return React.createElement('div', { className: 'share-page' },
    React.createElement('div', { className: 'share-header' }, 'TripLog \uACF5\uC720 \uC5F4\uB78C'),

    // Owner banner
    isOwner && React.createElement('div', { className: 'share-owner-banner' },
      React.createElement('span', null, '\uB0B4 \uC5EC\uD589\uC785\uB2C8\uB2E4'),
      React.createElement('span', {
        className: 'share-owner-link',
        onClick: () => navigate(`/trip/${trip.id}`)
      }, '\uC6D0\uBCF8 \uC218\uC815\uC73C\uB85C \uC774\uB3D9 \u2192')
    ),

    // Trip summary
    React.createElement('div', { className: 'share-trip-card' },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: 8 } },
        `${country.flag} ${country.name} ${trip.title}`
      ),
      React.createElement('div', { style: { fontSize: 13, color: '#9E9E9E' } },
        `${formatDate(trip.start_date)} ~ ${formatDate(trip.end_date)} \u00B7 ${getDaysBetween(trip.start_date, trip.end_date).length}\uC77C`
      ),
      React.createElement('div', { style: { fontSize: 13, color: '#9E9E9E' } },
        `\uC7A5\uC18C ${trip.place_count || trip.placeCount || 0}\uAC1C \u00B7 ${formatDualAmount(Math.round(Number(trip.total_expense_krw || trip.totalExpense || 0)), trip.total_expense_local || 0, trip.local_currency)}`
      )
    ),

    // Days
    React.createElement('div', { className: 'share-day-list' },
      React.createElement('div', { className: 'share-day-section-title' }, '\uC77C\uC790\uBCC4 \uC77C\uC815 (\uC77D\uAE30 \uC804\uC6A9)'),
      days.map((day, i) => React.createElement('div', { key: day.date, className: 'share-day-card' },
        React.createElement('div', { className: 'share-day-label' }, `Day ${i + 1}`),
        React.createElement('div', { className: 'share-day-places' }, `\uC7A5\uC18C ${day.places.length}\uAC1C`)
      ))
    ),

    // Comments
    React.createElement('div', { className: 'comments-section' },
      React.createElement('div', { className: 'comments-title' }, `\uB313\uAE00 (${comments.length})`),
      comments.map(c => React.createElement('div', { key: c.id, className: 'comment-item' },
        React.createElement('div', { className: 'comment-author' }, `${c.user_email}:`),
        React.createElement('div', { className: 'comment-content' }, c.content)
      )),

      user ?
        React.createElement('div', { className: 'comment-form' },
          React.createElement('input', {
            className: 'comment-input', placeholder: '\uB313\uAE00\uC744 \uC785\uB825\uD558\uC138\uC694',
            value: commentText, onChange: e => setCommentText(e.target.value),
            onKeyDown: e => { if (e.key === 'Enter') handleComment(); }
          }),
          React.createElement('button', { className: 'comment-submit', onClick: handleComment }, '\uC804\uC1A1')
        ) :
        React.createElement('div', {
          className: 'comment-login-prompt',
          onClick: () => setShowLoginModal(true)
        }, '\uB313\uAE00 \uB2EC\uAE30 (\uB85C\uADF8\uC778 \uD544\uC694)')
    ),

    React.createElement(Modal, {
      open: showLoginModal,
      title: '\uB85C\uADF8\uC778 \uD544\uC694',
      body: '\uB313\uAE00\uC744 \uC791\uC131\uD558\uB824\uBA74 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.',
      confirmLabel: '\uB85C\uADF8\uC778\uD558\uAE30',
      onConfirm: () => { setShowLoginModal(false); navigate('/login'); },
      onCancel: () => setShowLoginModal(false)
    })
  );
}

// ============================================================
// APP (Router + Layout)
