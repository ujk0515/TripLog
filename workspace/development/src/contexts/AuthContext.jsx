import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../utils/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [appState, setAppState] = useState('loading'); // 'loading' | 'ready' | 'server_error'

  const accessTokenRef = useRef(null);
  // Keep ref in sync so apiCall closure always sees latest token
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // --- API call with auto-refresh ---
  const apiCall = useCallback(async (method, endpoint, body, _isRetry) => {
    const token = accessTokenRef.current;
    const opts = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      },
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, opts);

    // 401 -> try refresh (only once)
    if (res.status === 401 && !_isRetry && endpoint !== '/auth/refresh') {
      const refreshRes = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setAccessToken(data.accessToken);
        accessTokenRef.current = data.accessToken;
        return apiCall(method, endpoint, body, true);
      } else {
        // Refresh failed -> force logout
        setUser(null);
        setAccessToken(null);
        accessTokenRef.current = null;
        throw { status: 401, message: '\uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4' };
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw { status: res.status, message: err.message || 'Server error', error: err.error || null };
    }
    return res.json();
  }, []);

  // --- App init: health check -> token refresh ---
  useEffect(() => {
    let cancelled = false;
    let timer;

    const init = async () => {
      // 1) Health check with timeout
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 10000);
      try {
        await fetch(API_BASE + '/health', { signal: controller.signal });
        clearTimeout(timer);
      } catch (e) {
        clearTimeout(timer);
        if (!cancelled) setAppState('server_error');
        return;
      }

      // 2) Try to refresh token (cookie-based)
      try {
        const refreshRes = await fetch(API_BASE + '/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (!cancelled) {
            setAccessToken(data.accessToken);
            accessTokenRef.current = data.accessToken;
            // Decode JWT payload to get user info
            try {
              const payload = JSON.parse(atob(data.accessToken.split('.')[1]));
              setUser({ id: payload.userId, email: payload.email });
            } catch {
              setUser({ id: 'unknown' });
            }
          }
        }
        // If refresh fails, user is just not logged in - that's fine
      } catch (e) {
        // ignore
      }

      if (!cancelled) setAppState('ready');
    };

    init();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // --- Auth actions ---
  const login = useCallback(async (email, password) => {
    const res = await apiCall('POST', '/auth/login', { email, password });
    setAccessToken(res.accessToken);
    accessTokenRef.current = res.accessToken;
    setUser(res.user || { email });
    return res;
  }, [apiCall]);

  const register = useCallback(async (email, password) => {
    const res = await apiCall('POST', '/auth/register', { email, password });
    setAccessToken(res.accessToken);
    accessTokenRef.current = res.accessToken;
    setUser(res.user || { email });
    return res;
  }, [apiCall]);

  const logout = useCallback(async () => {
    try { await apiCall('POST', '/auth/logout'); } catch(e) {}
    setUser(null);
    setAccessToken(null);
    accessTokenRef.current = null;
  }, [apiCall]);

  const retryConnection = useCallback(() => {
    setAppState('loading');
    // Re-run init by forcing a remount
    window.location.reload();
  }, []);

  return React.createElement(AuthContext.Provider, {
    value: { user, appState, apiCall, login, register, logout, retryConnection }
  }, children);
}

export function useAuth() { return useContext(AuthContext); }
