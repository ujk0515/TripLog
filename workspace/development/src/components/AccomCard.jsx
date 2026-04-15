import React from 'react';

export default function AccomCard({ accom, variant, onClick }) {
  if (!accom) return null;
  const rawName = accom.name || '';
  const rawAddr = accom.address || '';
  const commaIdx = rawName.indexOf(',');
  const shortName = commaIdx >= 0 ? rawName.slice(0, commaIdx).trim() : rawName;
  let addrPart = rawAddr;
  if (!addrPart || addrPart === rawName || addrPart.startsWith(rawName)) {
    addrPart = commaIdx >= 0 ? rawName.slice(commaIdx + 1).trim() : '';
  }

  return React.createElement('div', {
    className: 'accommodation-card ' + variant,
    onClick
  },
    React.createElement('span', { className: 'accom-badge' }, variant === 'in' ? 'In' : variant === 'out' ? 'Out' : '🏨'),
    React.createElement('div', { className: 'accom-info' },
      React.createElement('div', { className: 'accom-name' }, shortName),
      addrPart && React.createElement('div', { className: 'accom-addr' }, addrPart)
    )
  );
}
