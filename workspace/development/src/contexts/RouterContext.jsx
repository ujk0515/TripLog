import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const RouterContext = createContext(null);

export function useRouter() { return useContext(RouterContext); }

export function Router({ children }) {
  const [path, setPath] = useState(window.location.hash.slice(1) || '/');

  useEffect(() => {
    const handler = () => setPath(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to) => {
    window.location.hash = to;
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  return React.createElement(RouterContext.Provider, { value: { path, navigate, goBack } }, children);
}

export function matchRoute(pattern, path) {
  const patternParts = pattern.split('/');
  const pathParts = path.split('?')[0].split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

// ============================================================
// TOAST
// ============================================================
const ToastContext = createContext(null);
