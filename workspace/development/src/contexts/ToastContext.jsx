import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = useCallback((text) => {
    setMsg(text);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2500);
  }, []);

  return React.createElement(ToastContext.Provider, { value: show },
    children,
    React.createElement('div', { className: `toast ${visible ? 'visible' : ''}` }, msg)
  );
}

export function useToast() { return useContext(ToastContext); }
