import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export default function Modal({ open, title, body, onConfirm, onCancel, confirmLabel, confirmDanger }) {
  if (!open) return null;
  return React.createElement('div', { className: 'modal-overlay', onClick: onCancel },
    React.createElement('div', { className: 'modal', onClick: e => e.stopPropagation() },
      React.createElement('div', { className: 'modal-title' }, title),
      React.createElement('div', { className: 'modal-body' }, body),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { className: 'modal-btn', onClick: onCancel }, '\uCDE8\uC18C'),
        React.createElement('button', {
          className: `modal-btn ${confirmDanger ? 'modal-btn-danger' : 'modal-btn-primary'}`,
          onClick: onConfirm
        }, confirmLabel || '\uD655\uC778')
      )
    )
  );
}
