import { COUNTRIES } from './constants';

export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

export function getDaysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const days = [];
  const current = new Date(s);
  while (current <= e) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

export function formatCurrency(amount, currency) {
  const symbols = { KRW: '\u20A9', USD: '$', EUR: '\u20AC', JPY: '\u00A5', CNY: '\u00A5' };
  const sym = symbols[currency] || currency;
  return `${sym}${Number(amount).toLocaleString()}`;
}

export function getCountryByCode(code) {
  return COUNTRIES.find(c => c.code === code) || { code, name: code, flag: '\uD83C\uDFF3\uFE0F', currency: 'KRW' };
}

export function formatDualAmount(totalKRW, totalLocal, localCurrency) {
  if (!localCurrency || localCurrency === 'KRW' || !totalLocal) {
    return formatCurrency(totalKRW, 'KRW');
  }
  return `${formatCurrency(totalLocal, localCurrency)} (${formatCurrency(totalKRW, 'KRW')})`;
}

export function formatDualCurrency(totalKRW, totalLocal, localCurrency) {
  return `총 경비 ${formatDualAmount(totalKRW, totalLocal, localCurrency)}`;
}

export function formatRateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function getDayAccommodations(day, accoms) {
  if (!day || !accoms || accoms.length === 0) return { out: null, in: null, normal: null };
  const out = accoms.find((a) => a.check_out_date === day) || null;
  const inn = accoms.find((a) => a.check_in_date === day) || null;
  if (out || inn) return { out, in: inn, normal: null };
  const normal = accoms.find((a) => a.check_in_date && a.check_out_date && day > a.check_in_date && day < a.check_out_date) || null;
  return { out: null, in: null, normal };
}

export function isTripPast(trip) {
  if (!trip?.start_date || !trip?.end_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(trip.end_date + 'T00:00:00');
  return endDate < today;
}

export function parsePlaceName(name) {
  const ci = (name || '').indexOf(',');
  return {
    short: ci >= 0 ? name.slice(0, ci).trim() : name,
    addr: ci >= 0 ? name.slice(ci + 1).trim() : ''
  };
}
