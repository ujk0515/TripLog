import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export default function PasswordToggleIcon({ visible }) {
  if (visible) {
    // Eye with slash (password visible, click to hide)
    return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
      React.createElement('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94' }),
      React.createElement('path', { d: 'M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19' }),
      React.createElement('line', { x1: 1, y1: 1, x2: 23, y2: 23 }),
      React.createElement('path', { d: 'M14.12 14.12a3 3 0 1 1-4.24-4.24' })
    );
  }
  // Eye (password hidden, click to show)
  return React.createElement('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
    React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
    React.createElement('circle', { cx: 12, cy: 12, r: 3 })
  );
}
