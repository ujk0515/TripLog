import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Spinner from './Spinner';
export default function AppLoading() {
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { style: { textAlign: 'center' } },
      React.createElement(Spinner),
      React.createElement('div', { style: { marginTop: 16, color: '#9E9E9E', fontSize: 14 } },
        '\uC11C\uBC84\uC5D0 \uC5F0\uACB0 \uC911...'
      )
    )
  );
}
