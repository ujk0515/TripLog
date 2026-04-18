import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { matchRoute, useRouter } from './contexts/RouterContext';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import AppLoading from './components/AppLoading';
import ServerError from './components/ServerError';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import TripCreatePage from './pages/TripCreatePage';
import TripDetailPage from './pages/TripDetailPage';
import PlaceAddPage from './pages/PlaceAddPage';
import ExpenseListPage from './pages/ExpenseListPage';
import ExpenseAddPage from './pages/ExpenseAddPage';
import ScheduleCreatePage from './pages/ScheduleCreatePage';
import AccommodationDetailPage from './pages/AccommodationDetailPage';
import PlaceDetailPage from './pages/PlaceDetailPage';
import ShareViewPage from './pages/ShareViewPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyCodePage from './pages/VerifyCodePage';
import ResetPasswordPage from './pages/ResetPasswordPage';

export default function App() {
  const { user, appState, retryConnection } = useAuth();
  const { path, navigate } = useRouter();
  const [currentTrip, setCurrentTrip] = useState(null);

  // App loading state
  if (appState === 'loading') return React.createElement(AppLoading);
  if (appState === 'server_error') return React.createElement(ServerError, { onRetry: retryConnection });

  // Share view is accessible without login
  const shareMatch = matchRoute('/share/:shareToken', path);
  if (shareMatch) {
    return React.createElement(ShareViewPage);
  }

  // Not logged in
  if (!user) {
    if (path === '/register') return React.createElement(RegisterPage);
    if (path === '/forgot-password') return React.createElement(ForgotPasswordPage);
    if (path === '/forgot-password/verify') return React.createElement(VerifyCodePage);
    if (path === '/forgot-password/reset') return React.createElement(ResetPasswordPage);
    return React.createElement(LoginPage);
  }

  // Determine current page
  let pageContent;
  const tripNewMatch = path === '/trip/new';
  const tripEditMatch = matchRoute('/trip/:id/edit', path);
  const tripDetailMatch = matchRoute('/trip/:id', path);
  const placeNewMatch = matchRoute('/trip/:tripId/day/:date/place/new', path);
  const placeEditMatch = matchRoute('/trip/:tripId/day/:date/place/:placeId/edit', path);
  const placeDetailMatch = matchRoute('/trip/:tripId/day/:date/place/:placeId', path);
  const expenseListMatch = matchRoute('/trip/:id/expense', path);
  const expenseNewMatch = matchRoute('/trip/:tripId/expense/new', path);
  const expenseEditMatch = matchRoute('/trip/:tripId/expense/:expenseId/edit', path);
  const scheduleMatch = matchRoute('/trip/:id/schedule', path);
  const accommodationMatch = matchRoute('/trip/:id/accommodation/:accomId', path);

  if (tripNewMatch) {
    pageContent = React.createElement(TripCreatePage, { onSelectTrip: setCurrentTrip });
  } else if (tripEditMatch) {
    pageContent = React.createElement(TripCreatePage, { onSelectTrip: setCurrentTrip, editTrip: currentTrip });
  } else if (placeNewMatch || placeEditMatch) {
    pageContent = React.createElement(PlaceAddPage);
  } else if (placeDetailMatch) {
    pageContent = React.createElement(PlaceDetailPage);
  } else if (expenseNewMatch || expenseEditMatch) {
    pageContent = React.createElement(ExpenseAddPage);
  } else if (scheduleMatch) {
    pageContent = React.createElement(ScheduleCreatePage, { onSelectTrip: setCurrentTrip });
  } else if (accommodationMatch) {
    pageContent = React.createElement(AccommodationDetailPage);
  } else if (expenseListMatch) {
    pageContent = React.createElement(ExpenseListPage, { currentTrip });
  } else if (tripDetailMatch) {
    pageContent = React.createElement(TripDetailPage, { onSelectTrip: setCurrentTrip });
  } else {
    pageContent = React.createElement(HomePage, { onSelectTrip: setCurrentTrip });
  }

  return React.createElement('div', { className: 'app-container' },
    React.createElement(Sidebar, { currentTrip }),
    React.createElement('div', {
      className: 'main-content',
      style: path.includes('/schedule') ? { paddingBottom: 0 } : undefined
    }, pageContent),
    React.createElement(TabBar, { currentTrip })
  );
}
