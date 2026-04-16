import React, { useState } from 'react';
import { useRouter } from '../contexts/RouterContext';
import { API_BASE } from '../utils/constants';
import Spinner from '../components/Spinner';

export default function ForgotPasswordPage() {
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('이메일을 입력해주세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API_BASE + '/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '요청 실패');
      }
      // Navigate to verify page, passing email via sessionStorage
      sessionStorage.setItem('resetEmail', email);
      navigate('/forgot-password/verify');
    } catch (err) {
      setError(err.message || '요청 실패');
    } finally {
      setLoading(false);
    }
  };

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
      }, '비밀번호 찾기'),
      React.createElement('form', { className: 'auth-form', onSubmit: handleSubmit },
        React.createElement('input', {
          className: 'auth-input',
          type: 'email',
          placeholder: '가입한 이메일 주소',
          value: email,
          onChange: (e) => setEmail(e.target.value),
        }),
        React.createElement('div', { className: `auth-error ${error ? 'visible' : ''}` },
          '\u203B ', error || ''
        ),
        React.createElement('button', {
          className: 'auth-btn',
          type: 'submit',
          disabled: loading,
        }, loading ? React.createElement(Spinner) : '확인'),
      ),
      React.createElement('div', { className: 'auth-link' },
        React.createElement('a', { onClick: () => navigate('/login') }, '로그인으로 돌아가기')
      )
    )
  );
}
