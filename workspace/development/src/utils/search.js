import { API_BASE } from './constants';

export async function searchNominatim(query, centerLat, centerLng) {
  if (!query.trim()) return [];
  let url = `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`;
  if (centerLat && centerLng) url += `&lat=${centerLat}&lng=${centerLng}`;
  try {
    const res = await fetch(url);
    return await res.json();
  } catch { return []; }
}
