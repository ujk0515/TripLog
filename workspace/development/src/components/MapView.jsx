import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';

export default function MapView({ places, accommodation, dayAccommodations }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);
  const routeLinesRef = useRef([]);
  const accomMarkersRef = useRef([]);

  // Resolve accommodations to render: prefer dayAccommodations (In/Out/Normal), fallback to legacy single accommodation
  const accomEntries = useMemo(() => {
    if (dayAccommodations) {
      const entries = [];
      if (dayAccommodations.out) entries.push({ accom: dayAccommodations.out, variant: 'out' });
      if (dayAccommodations.in) entries.push({ accom: dayAccommodations.in, variant: 'in' });
      if (dayAccommodations.normal) entries.push({ accom: dayAccommodations.normal, variant: 'normal' });
      return entries;
    }
    if (accommodation?.lat && accommodation?.lng) {
      return [{ accom: accommodation, variant: 'normal' }];
    }
    return [];
  }, [dayAccommodations, accommodation]);

  // Determine default center
  const defaultCenter = accomEntries.length > 0 && accomEntries[0].accom.lat && accomEntries[0].accom.lng
    ? [Number(accomEntries[0].accom.lat), Number(accomEntries[0].accom.lng)]
    : [37.5665, 126.9780];

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;
    leafletMapRef.current = L.map(mapRef.current).setView(defaultCenter, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(leafletMapRef.current);

    // 지도 컨텍스트 메뉴 차단 (롱프레스/우클릭 후 pointer 캡쳐 해제 불가 이슈 방지)
    const container = mapRef.current;
    const preventCtx = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
    container.addEventListener('contextmenu', preventCtx);
    // pointer가 지도 밖으로 나가거나 캔슬 시 강제 해제
    const forceRelease = (e) => {
      try { if (e.pointerId != null) container.releasePointerCapture?.(e.pointerId); } catch (_) {}
    };
    container.addEventListener('pointerup', forceRelease);
    container.addEventListener('pointercancel', forceRelease);
    container.addEventListener('pointerleave', forceRelease);
  }, []);

  // Marker color per variant
  function accomMarkerColor(variant) {
    if (variant === 'in') return '#2563EB';
    if (variant === 'out') return '#EF4444';
    return '#64748B';
  }
  function accomMarkerLabel(variant) {
    if (variant === 'in') return 'In';
    if (variant === 'out') return 'Out';
    return '\uD83C\uDFE8';
  }

  // Update markers and polyline when places or accommodations change
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // Clear existing accommodation markers
    accomMarkersRef.current.forEach(m => map.removeLayer(m));
    accomMarkersRef.current = [];

    // Clear existing route lines
    routeLinesRef.current.forEach(l => map.removeLayer(l));
    routeLinesRef.current = [];

    const validPlaces = (places || []).filter(p => p.lat && p.lng);

    // Add accommodation markers with In/Out/Normal color distinction
    accomEntries.forEach(({ accom, variant }) => {
      if (!accom.lat || !accom.lng) return;
      const color = accomMarkerColor(variant);
      const label = accomMarkerLabel(variant);
      const isEmoji = variant === 'normal';
      const accomIcon = L.divIcon({
        className: 'leaflet-accom-icon',
        html: '<div style="background:#fff;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:' + (isEmoji ? '18px' : '11px;font-weight:700') + ';border:2px solid ' + color + ';box-shadow:0 2px 6px rgba(0,0,0,0.2);color:' + color + ';">' + label + '</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
      const m = L.marker([Number(accom.lat), Number(accom.lng)], { icon: accomIcon }).addTo(map);
      m.bindPopup('<b>' + label + ' ' + (accom.name || '\uC219\uBC15') + '</b>');
      accomMarkersRef.current.push(m);
    });

    const hasAccomMarkers = accomMarkersRef.current.length > 0;

    if (validPlaces.length === 0 && !hasAccomMarkers) return;

    // Add numbered markers
    const latlngs = [];
    validPlaces.forEach((p, i) => {
      const numberedIcon = L.divIcon({
        className: 'leaflet-numbered-icon',
        html: '<div style="background:#333;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:1px solid #333;">' + (i + 1) + '</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });
      const marker = L.marker([Number(p.lat), Number(p.lng)], { icon: numberedIcon }).addTo(map);
      marker.bindPopup('<b>' + (i + 1) + '. ' + (p.name || '') + '</b>');
      markersRef.current.push(marker);
      latlngs.push([Number(p.lat), Number(p.lng)]);
    });

    // Draw route lines: 숙소(Out/In 각각) → 각 장소 (OSRM 차량 경로, 실패 시 직선)
    const outAccom = accomEntries.find(e => e.variant === 'out');
    const inAccom = accomEntries.find(e => e.variant === 'in');
    const normalAccom = accomEntries.find(e => e.variant === 'normal');

    const routeOrigins = [];
    if (outAccom && outAccom.accom.lat && outAccom.accom.lng) {
      routeOrigins.push({ coord: [Number(outAccom.accom.lat), Number(outAccom.accom.lng)], colors: ['#EF4444', '#F97316', '#DC2626', '#E11D48', '#B91C1C'] });
    }
    if (inAccom && inAccom.accom.lat && inAccom.accom.lng) {
      routeOrigins.push({ coord: [Number(inAccom.accom.lat), Number(inAccom.accom.lng)], colors: ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706'] });
    }
    if (routeOrigins.length === 0 && normalAccom && normalAccom.accom.lat && normalAccom.accom.lng) {
      routeOrigins.push({ coord: [Number(normalAccom.accom.lat), Number(normalAccom.accom.lng)], colors: ['#2563EB', '#7C3AED', '#0891B2', '#059669', '#D97706'] });
    }

    if (routeOrigins.length > 0 && validPlaces.length > 0) {
      routeOrigins.forEach(({ coord: originCoord, colors }) => {
        validPlaces.forEach((p, i) => {
          const placeCoord = [Number(p.lat), Number(p.lng)];
          const color = colors[i % colors.length];
          const cacheKey = `route_${originCoord[0]}_${originCoord[1]}_${placeCoord[0]}_${placeCoord[1]}`;

          // localStorage 캐시 확인
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const coords = JSON.parse(cached);
              const line = L.polyline(coords, { color, weight: 4, opacity: 0.9 }).addTo(map);
              routeLinesRef.current.push(line);
              return;
            } catch { localStorage.removeItem(cacheKey); }
          }

          // 캐시 없으면 OSRM 1회 요청 → 저장
          fetch(`https://router.project-osrm.org/route/v1/driving/${originCoord[1]},${originCoord[0]};${placeCoord[1]},${placeCoord[0]}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => {
              if (data.routes && data.routes[0] && data.routes[0].geometry) {
                const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                localStorage.setItem(cacheKey, JSON.stringify(coords));
                const line = L.polyline(coords, { color, weight: 4, opacity: 0.9 }).addTo(map);
                routeLinesRef.current.push(line);
              } else {
                const line = L.polyline([originCoord, placeCoord], { color, weight: 4, opacity: 0.9 }).addTo(map);
                routeLinesRef.current.push(line);
              }
            })
            .catch(() => {
              const line = L.polyline([originCoord, placeCoord], { color, weight: 4, opacity: 0.9 }).addTo(map);
              routeLinesRef.current.push(line);
            });
        });
      });
    } else if (latlngs.length > 1 && routeOrigins.length === 0) {
      // 숙소 없으면 기존처럼 장소 간 직선
      const line = L.polyline(latlngs, { color: '#333', weight: 4, opacity: 0.9 }).addTo(map);
      routeLinesRef.current.push(line);
    }

    // Build bounds including accommodation markers
    const allLatLngs = [...latlngs];
    accomEntries.forEach(({ accom }) => {
      if (accom.lat && accom.lng) allLatLngs.push([Number(accom.lat), Number(accom.lng)]);
    });

    // Fit bounds
    if (allLatLngs.length === 1) {
      map.setView(allLatLngs[0], 14);
    } else if (allLatLngs.length > 1) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [places, accomEntries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return React.createElement('div', {
    className: 'map-container',
    ref: mapRef,
    style: { width: '100%', height: 240 }
  });
}

// ============================================================
// PLACE ADD/EDIT PAGE
