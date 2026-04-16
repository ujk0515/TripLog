import React, { useEffect, useState } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { useToast } from '../contexts/ToastContext';
import { API_BASE } from '../utils/constants';
import Spinner from '../components/Spinner';
import PasswordToggleIcon from '../components/PasswordToggleIcon';

export default function ResetPasswordPage() {
  const { navigate } = useRouter();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = sessionStorage.getItem('resetEmail');
  const resetToken = sessionStorage.getItem('resetToken');

  // Redirect if missing prerequisites
  useEffect(() => {
    if (!email || !resetToken) {
      navigate('/forgot-password');
    }
  }, [email, resetToken, navigate]);

  // Block back navigation
  useEffect(() => {
    const blockBack = () => {
      window.history.replaceState(null, '', window.location.href);
    };
    // Push a state so popstate fires
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  // Validation
  const getValidationError = () => {
    if (newPassword && newPassword.length < 8) {
      return '비밀번호는 8자 이상이어야 합니다';
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return '입력하신 비밀번호가 동일하지 않습니다.';
    }
    return '';
  };

  const validationError = getValidationError();
  const isButtonDisabled = !newPassword || !confirmPassword || !!validationError || loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isButtonDisabled) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_BASE + '/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '비밀번호 변경 실패');
      }

      // Clean up sessionStorage
      sessionStorage.removeItem('resetEmail');
      sessionStorage.removeItem('resetToken');

      // Navigate to login with toast
      toast('비밀번호가 정상적으로 변경되었습니다.');

      // Use replaceState to prevent back navigation to reset page
      navigate('/login');
      // Replace the hash history entry to block back
      setTimeout(() => {
        window.history.replaceState(null, '', window.location.href);
      }, 100);
    } catch (err) {
      setError(err.message || '비밀번호 변경 실패');
    } finally {
      setLoading(false);
    }
  };

  if (!email || !resetToken) return null;

  const displayError = error || validationError;

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
        style: { textAlign: 'center', marginBottom: '24px', fontSize: '18px', fontWeight: '600', color: '#1E293B' },
      }, '새 비밀번호 설정'),
      React.createElement('form', { className: 'auth-form', onSubmit: handleSubmit },
        React.createElement('div', { className: 'auth-input-wrapper' },
          React.createElement('input', {
            className: 'auth-input',
            type: showPassword ? 'text' : 'password',
            placeholder: '새 비밀번호 (8자 이상)',
            value: newPassword,
            onChange: (e) => { setNewPassword(e.target.value); setError(''); },
          }),
          React.createElement('button', {
            type: 'button',
            className: 'auth-password-toggle',
            onClick: () => setShowPassword((v) => !v),
            'aria-label': showPassword ? '비밀번호 숨기기' : '비밀번호 보기',
          }, React.createElement(PasswordToggleIcon, { visible: showPassword }))
        ),
        React.createElement('div', { className: 'auth-input-wrapper' },
          React.createElement('input', {
            className: 'auth-input',
            type: showConfirmPassword ? 'text' : 'password',
            placeholder: '비밀번호 확인',
            value: confirmPassword,
            onChange: (e) => { setConfirmPassword(e.target.value); setError(''); },
          }),
          React.createElement('button', {
            type: 'button',
            className: 'auth-password-toggle',
            onClick: () => setShowConfirmPassword((v) => !v),
            'aria-label': showConfirmPassword ? '비밀번호 숨기기' : '비밀번호 보기',
          }, React.createElement(PasswordToggleIcon, { visible: showConfirmPassword }))
        ),
        React.createElement('div', { className: `auth-error ${displayError ? 'visible' : ''}` },
          '\u203B ', displayError || ''
        ),
        React.createElement('button', {
          className: 'auth-btn',
          type: 'submit',
          disabled: isButtonDisabled,
        }, loading ? React.createElement(Spinner) : '비밀번호 변경'),
      )
    )
  );
}
