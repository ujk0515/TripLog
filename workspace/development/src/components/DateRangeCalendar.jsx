import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export default function DateRangeCalendar({ startDate, endDate, onSelect, onClose, calendarMonth, setCalendarMonth, triggerRef, minDate, maxDate }) {
  const calRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (calRef.current && !calRef.current.contains(e.target) &&
          (!triggerRef?.current || !triggerRef.current.contains(e.target))) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, triggerRef]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const { year, month } = calendarMonth;

  function getDaysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }
  function getFirstDayOfWeek(y, m) {
    return new Date(y, m, 1).getDay();
  }

  const months = [
    { year, month },
    { year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 }
  ];

  function renderMonth(y, m) {
    const daysInMonth = getDaysInMonth(y, m);
    const firstDay = getFirstDayOfWeek(y, m);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const monthLabel = `${y}\uB144 ${m + 1}\uC6D4`;

    const dowNames = ['\uC77C', '\uC6D4', '\uD654', '\uC218', '\uBAA9', '\uAE08', '\uD1A0'];

    return React.createElement('div', { key: `${y}-${m}`, className: 'cal-month' },
      React.createElement('div', { className: 'cal-month-title' }, monthLabel),
      React.createElement('div', { className: 'cal-dow-row' },
        dowNames.map((d, di) =>
          React.createElement('span', {
            key: d,
            className: `cal-dow${di === 0 ? ' sunday' : ''}${di === 6 ? ' saturday' : ''}`
          }, d)
        )
      ),
      React.createElement('div', { className: 'cal-grid' },
        cells.map((day, i) => {
          if (!day) return React.createElement('span', { key: 'e' + i, className: 'cal-cell empty' });

          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = dateStr < todayStr;
          const isOutOfRange = (minDate && dateStr < minDate) || (maxDate && dateStr > maxDate);
          const isDisabled = isPast || isOutOfRange;
          const isStart = dateStr === startDate;
          const isEnd = dateStr === endDate;
          const isInRange = startDate && endDate && dateStr > startDate && dateStr < endDate;
          const dayOfWeek = i % 7;

          let cls = 'cal-cell';
          if (dayOfWeek === 0) cls += ' sunday';
          if (dayOfWeek === 6) cls += ' saturday';
          if (isDisabled) cls += ' disabled';
          if (isStart || isEnd) cls += ' selected';
          if (isInRange) cls += ' in-range';
          if (isStart && isEnd) cls += ' single';
          if (isStart && endDate && startDate !== endDate) cls += ' range-start';
          if (isEnd && startDate && startDate !== endDate) cls += ' range-end';

          return React.createElement('span', {
            key: dateStr,
            className: cls,
            onClick: isDisabled ? undefined : () => onSelect(dateStr)
          }, day);
        })
      )
    );
  }

  const [topPos, setTopPos] = useState(() => triggerRef?.current ? triggerRef.current.getBoundingClientRect().bottom + 4 : 200);

  useEffect(() => {
    const updatePos = () => {
      if (triggerRef?.current) {
        setTopPos(triggerRef.current.getBoundingClientRect().bottom + 4);
      }
    };
    window.addEventListener('scroll', updatePos, true);
    return () => window.removeEventListener('scroll', updatePos, true);
  }, [triggerRef]);

  return React.createElement('div', { className: 'cal-overlay', ref: calRef, style: { top: topPos + 'px' } },
    React.createElement('div', { className: 'cal-header' },
      React.createElement('button', {
        type: 'button', className: 'cal-nav', onClick: () => {
          setCalendarMonth(prev => {
            const m = prev.month === 0 ? 11 : prev.month - 1;
            const y = prev.month === 0 ? prev.year - 1 : prev.year;
            return { year: y, month: m };
          });
        }
      }, '<'),
      React.createElement('button', {
        type: 'button', className: 'cal-nav', onClick: () => {
          setCalendarMonth(prev => {
            const m = prev.month === 11 ? 0 : prev.month + 1;
            const y = prev.month === 11 ? prev.year + 1 : prev.year;
            return { year: y, month: m };
          });
        }
      }, '>')
    ),
    React.createElement('div', { className: 'cal-months' },
      renderMonth(months[0].year, months[0].month),
      renderMonth(months[1].year, months[1].month)
    )
  );
}
