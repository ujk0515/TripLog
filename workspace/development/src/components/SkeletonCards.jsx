import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
export default function SkeletonCards({ count = 3 }) {
  return React.createElement('div', null,
    Array.from({ length: count }).map((_, i) =>
      React.createElement('div', { key: i, className: 'skeleton skeleton-card' })
    )
  );
}

// ============================================================
// PULL-TO-REFRESH HOOK
