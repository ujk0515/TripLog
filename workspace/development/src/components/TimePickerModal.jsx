import React, { useEffect, useRef, useState } from 'react';

export default function TimePickerModal({ value, onChange, onClose }) {
  const parseTime = (v) => {
    if (!v) return { hour: 12, minute: 0, period: 'PM' };
    const [h, m] = v.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { hour: hour12, minute: m || 0, period };
  };

  const initial = parseTime(value);
  const [hour, setHour] = useState(String(initial.hour).padStart(2, '0'));
  const [minute, setMinute] = useState(String(initial.minute).padStart(2, '0'));
  const [period, setPeriod] = useState(initial.period);
  const hourRef = useRef(null);
  const minRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (hourRef.current) {
      hourRef.current.focus();
      hourRef.current.select();
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleConfirm = () => {
    let h = parseInt(hour, 10) || 12;
    const m = parseInt(minute, 10) || 0;
    if (h < 1) h = 1;
    if (h > 12) h = 12;
    let h24 = h;
    if (period === 'AM' && h === 12) h24 = 0;
    else if (period === 'PM' && h !== 12) h24 = h + 12;
    const result = `${String(h24).padStart(2, '0')}:${String(Math.min(m, 59)).padStart(2, '0')}`;
    onChange(result);
    onClose();
  };

  const handleHourChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHour(raw);
    if (raw.length === 2) {
      minRef.current?.focus();
      minRef.current?.select();
    }
  };

  const handleMinuteChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinute(raw);
  };

  const handleHourBlur = () => {
    let n = parseInt(hour, 10) || 0;
    if (n < 1) n = 1;
    if (n > 12) n = 12;
    setHour(String(n).padStart(2, '0'));
  };

  const handleMinuteBlur = () => {
    let n = parseInt(minute, 10) || 0;
    if (n > 59) n = 59;
    setMinute(String(n).padStart(2, '0'));
  };

  const handleFocus = (e) => e.target.select();

  return React.createElement('div', { className: 'tp-overlay' },
    React.createElement('div', { className: 'tp-modal', ref: modalRef },
      React.createElement('div', { className: 'tp-title' }, '\uBC29\uBB38 \uC2DC\uAC04 \uC120\uD0DD'),

      React.createElement('div', { className: 'tp-display' },
        React.createElement('input', {
          ref: hourRef,
          className: 'tp-input',
          type: 'text',
          inputMode: 'numeric',
          pattern: '[0-9]*',
          value: hour,
          onChange: handleHourChange,
          onBlur: handleHourBlur,
          onFocus: handleFocus,
          placeholder: '12'
        }),
        React.createElement('span', { className: 'tp-colon' }, ':'),
        React.createElement('input', {
          ref: minRef,
          className: 'tp-input',
          type: 'text',
          inputMode: 'numeric',
          pattern: '[0-9]*',
          value: minute,
          onChange: handleMinuteChange,
          onBlur: handleMinuteBlur,
          onFocus: handleFocus,
          placeholder: '00'
        }),
        React.createElement('div', { className: 'tp-period' },
          React.createElement('button', {
            type: 'button',
            className: 'tp-period-btn' + (period === 'AM' ? ' tp-period-active' : ''),
            onClick: () => setPeriod('AM')
          }, 'AM'),
          React.createElement('button', {
            type: 'button',
            className: 'tp-period-btn' + (period === 'PM' ? ' tp-period-active' : ''),
            onClick: () => setPeriod('PM')
          }, 'PM')
        )
      ),

      React.createElement('div', { className: 'tp-labels' },
        React.createElement('span', null, 'Hour'),
        React.createElement('span', null, 'Minute'),
        React.createElement('span', null, '')
      ),

      React.createElement('div', { className: 'tp-actions' },
        React.createElement('button', {
          type: 'button', className: 'tp-btn tp-btn-cancel', onClick: onClose
        }, '\uCDE8\uC18C'),
        React.createElement('button', {
          type: 'button', className: 'tp-btn tp-btn-ok', onClick: handleConfirm
        }, '\uD655\uC778')
      )
    )
  );
}
