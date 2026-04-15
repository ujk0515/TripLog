import React, { useEffect, useRef, useState } from 'react';
import * as ReactDOM from 'react-dom';

export default function CurrencyDropdown({ value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const compute = () => {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = Math.min(options.length * 40 + 8, 240);
      const menuWidth = Math.max(rect.width, 100);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const goUp = spaceBelow < menuHeight + 8 && spaceAbove > spaceBelow;
      setMenuPos({
        left: Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
        top: goUp ? rect.top - menuHeight - 4 : rect.bottom + 4,
        width: menuWidth
      });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open, options.length]);

  return React.createElement('div', { className: 'cur-dd' },
    React.createElement('button', {
      type: 'button',
      className: 'cur-dd-trigger',
      disabled: !!disabled,
      ref: triggerRef,
      onClick: () => setOpen(o => !o)
    }, `${value} \u25BE`),
    open && menuPos && ReactDOM.createPortal(
      React.createElement('div', {
        ref: menuRef,
        className: 'cur-dd-menu',
        style: { position: 'fixed', left: menuPos.left, top: menuPos.top, width: menuPos.width }
      },
        options.map(opt => React.createElement('button', {
          key: opt,
          type: 'button',
          className: `cur-dd-opt${opt === value ? ' selected' : ''}`,
          onClick: () => { onChange(opt); setOpen(false); }
        }, opt))
      ),
      document.body
    )
  );
}
