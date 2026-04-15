import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export default function ServerError({ onRetry }) {
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card', style: { textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '\u26A0\uFE0F'),
      React.createElement('div', { style: { fontWeight: 700, fontSize: 18, marginBottom: 8 } },
        '\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'
      ),
      React.createElement('div', { style: { color: '#9E9E9E', fontSize: 14, marginBottom: 24 } },
        '\uC11C\uBC84\uAC00 \uC2E4\uD589 \uC911\uC778\uC9C0 \uD655\uC778\uD574\uC8FC\uC138\uC694.'
      ),
      React.createElement('button', {
        className: 'auth-btn', onClick: onRetry
      }, '\uB2E4\uC2DC \uC2DC\uB3C4')
    )
  );
}

// ============================================================
// LAYOUT COMPONENTS
