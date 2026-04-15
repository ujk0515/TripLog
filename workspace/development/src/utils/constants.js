export const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:3000/api'
  : '/api';

// ============================================================
// STATIC DATA
// ============================================================
export const COUNTRIES = [
  { code: 'JP', name: '\uC77C\uBCF8', flag: '\uD83C\uDDEF\uD83C\uDDF5', currency: 'JPY' },
  { code: 'FR', name: '\uD504\uB791\uC2A4', flag: '\uD83C\uDDEB\uD83C\uDDF7', currency: 'EUR' },
  { code: 'TH', name: '\uD0DC\uAD6D', flag: '\uD83C\uDDF9\uD83C\uDDED', currency: 'THB' },
  { code: 'US', name: '\uBBF8\uAD6D', flag: '\uD83C\uDDFA\uD83C\uDDF8', currency: 'USD' },
  { code: 'KR', name: '\uD55C\uAD6D', flag: '\uD83C\uDDF0\uD83C\uDDF7', currency: 'KRW' },
  { code: 'IT', name: '\uC774\uD0C8\uB9AC\uC544', flag: '\uD83C\uDDEE\uD83C\uDDF9', currency: 'EUR' },
  { code: 'ES', name: '\uC2A4\uD398\uC778', flag: '\uD83C\uDDEA\uD83C\uDDF8', currency: 'EUR' },
  { code: 'GB', name: '\uC601\uAD6D', flag: '\uD83C\uDDEC\uD83C\uDDE7', currency: 'GBP' },
  { code: 'DE', name: '\uB3C5\uC77C', flag: '\uD83C\uDDE9\uD83C\uDDEA', currency: 'EUR' },
  { code: 'CN', name: '\uC911\uAD6D', flag: '\uD83C\uDDE8\uD83C\uDDF3', currency: 'CNY' },
  { code: 'VN', name: '\uBCA0\uD2B8\uB0A8', flag: '\uD83C\uDDFB\uD83C\uDDF3', currency: 'VND' },
  { code: 'AU', name: '\uD638\uC8FC', flag: '\uD83C\uDDE6\uD83C\uDDFA', currency: 'AUD' },
];

export const CATEGORIES = [
  { id: 'food', label: '\uC2DD\uBE44' },
  { id: 'transport', label: '\uAD50\uD1B5' },
  { id: 'accommodation', label: '\uC219\uBC15' },
  { id: 'sightseeing', label: '\uAD00\uAD11' },
  { id: 'other', label: '\uAE30\uD0C0' },
];

export const CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];

// ============================================================
// UTILITY FUNCTIONS
