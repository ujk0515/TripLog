import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { API_BASE } from '../utils/constants';
import Spinner from '../components/Spinner';

const CODE_LENGTH = 6;
const TIMER_SECONDS = 120; // 2 minutes

export default function VerifyCodePage() {
  const { navigate } = useRouter();
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [expired, setExpired] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);

  const email = sessionStorage.getItem('resetEmail');

  // Redirect if no email
  useEffect(() => {
    if (!email) {
      navigate('/forgot-password');
    }
  }, [email, navigate]);

  // Countdown timer
  useEffect(() => {
    if (expired) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [expired]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleChange = useCallback((index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError('');

    // Auto-focus next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Move to previous input on backspace when current is empty
        inputRefs.current[index - 1]?.focus();
        setCode((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        e.preventDefault();
      }
    }
  }, [code]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const newCode = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newCode[i] = pasted[i];
      }
      setCode(newCode);
      // Focus the next empty input or the last one
      const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  }, []);

  // Auto-submit when all 6 digits entered
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === CODE_LENGTH && !expired && !loading) {
      handleVerify(fullCode);
    }
  }, [code, expired, loading]);

  const handleVerify = async (fullCode) => {
    if (!fullCode || fullCode.length !== CODE_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_BASE + '/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '인증 실패');
      }
      // Store resetToken and navigate to reset page
      sessionStorage.setItem('resetToken', data.resetToken);
      navigate('/forgot-password/reset');
    } catch (err) {
      setError(err.message || '인증코드가 올바르지 않습니다.');
      // Clear code on error
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await fetch(API_BASE + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '재전송 실패');
      }
      // Reset timer
      setTimeLeft(TIMER_SECONDS);
      setExpired(false);
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || '재전송 실패');
    } finally {
      setResending(false);
    }
  };

  if (!email) return null;

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' },
        React.createElement('img', {
          className: 'auth-logo-img',
          src: 'icons/icon-512.png',
          alt: 'TripLog',
          style: { width: '200px', height: '200px', objectFit: 'contain', borderRadius: '36px' },
        }),
        React.createElement('div', {
          className: 'auth-logo-title',
          style: { marginTop: '12px', fontSize: '24px', fontWeight: '700', color: '#1E293B' },
        }, 'TripLog')
      ),
      React.createElement('div', {
        style: { textAlign: 'center', marginBottom: '8px', fontSize: '18px', fontWeight: '600', color: '#1E293B' },
      }, '인증코드 입력'),
      React.createElement('p', {
        style: { textAlign: 'center', fontSize: '13px', color: '#64748B', marginBottom: '24px' },
      }, email, '으로 전송된 6자리 코드를 입력해주세요.'),

      // Code inputs
      React.createElement('div', { className: 'verify-code-inputs', onPaste: handlePaste },
        ...Array.from({ length: CODE_LENGTH }, (_, i) =>
          React.createElement('input', {
            key: i,
            ref: (el) => { inputRefs.current[i] = el; },
            className: 'verify-code-input',
            type: 'text',
            inputMode: 'numeric',
            maxLength: 1,
            value: code[i],
            onChange: (e) => handleChange(i, e.target.value),
            onKeyDown: (e) => handleKeyDown(i, e),
            disabled: expired || loading,
            autoFocus: i === 0,
          })
        )
      ),

      // Timer
      React.createElement('div', {
        className: 'verify-timer',
        style: { color: timeLeft <= 30 ? '#EF4444' : '#EF4444' },
      }, expired ? '시간이 만료되었습니다' : formatTime(timeLeft)),

      // Error
      React.createElement('div', { className: `auth-error ${error ? 'visible' : ''}`, style: { marginTop: '12px' } },
        '\u203B ', error || ''
      ),

      // Resend button (shown when expired)
      expired && React.createElement('button', {
        className: 'auth-btn',
        style: { marginTop: '16px' },
        onClick: handleResend,
        disabled: resending,
      }, resending ? React.createElement(Spinner) : '재전송'),

      // Loading indicator
      loading && React.createElement('div', {
        style: { textAlign: 'center', marginTop: '16px' },
      }, React.createElement(Spinner)),

      React.createElement('div', { className: 'auth-link', style: { marginTop: '24px' } },
        React.createElement('a', { onClick: () => navigate('/forgot-password') }, '이전으로 돌아가기')
      )
    )
  );
}
