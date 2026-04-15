import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '../contexts/RouterContext';
export default function Sidebar({ currentTrip }) {
  const { navigate, path } = useRouter();
  const { logout } = useAuth();

  const isHome = path === '/' || path === '';
  const isTripDetail = path.includes('/trip/') && !path.includes('/expense');
  const isExpense = path.includes('/expense');
  const hasTripSelected = !!currentTrip;

  return React.createElement('aside', { className: 'sidebar' },
    React.createElement('div', { className: 'sidebar-logo' }, 'TripLog'),
    React.createElement('ul', { className: 'sidebar-nav' },
      React.createElement('li', {
        className: `sidebar-nav-item ${isHome ? 'active' : ''}`,
        onClick: () => navigate('/')
      }, '\uD648'),
      React.createElement('li', {
        className: `sidebar-nav-item ${isTripDetail ? 'active' : ''} ${!hasTripSelected ? 'disabled' : ''}`,
        onClick: () => hasTripSelected && navigate(`/trip/${currentTrip.id}`)
      }, '\uC5EC\uD589 \uC0C1\uC138'),
      React.createElement('li', {
        className: `sidebar-nav-item ${isExpense ? 'active' : ''} ${!hasTripSelected ? 'disabled' : ''}`,
        onClick: () => hasTripSelected && navigate(`/trip/${currentTrip.id}/expense`)
      }, '\uACBD\uBE44')
    ),
    React.createElement('div', { className: 'sidebar-bottom' },
      React.createElement('button', { className: 'sidebar-logout', onClick: logout }, '\uB85C\uADF8\uC544\uC6C3')
    )
  );
}
