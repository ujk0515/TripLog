const express = require('express');
const router = express.Router();

// 간단 캐시 (동일 쿼리 1분간 재사용)
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// GET /api/search?q=검색어&lat=37.46&lng=126.68
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const lat = req.query.lat ? parseFloat(req.query.lat) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng) : null;

    const cacheKey = `${q}|${lat}|${lng}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=ko`;

    // 숙소 좌표 있으면 viewbox로 근거리 우선 (bounded=0: 밖 결과도 포함)
    if (lat && lng) {
      const r = 0.1; // ~20km
      url += `&viewbox=${lng - r},${lat + r},${lng + r},${lat - r}&bounded=0`;
    }

    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'TripLog/1.0' }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json([]);
    }

    const data = await upstream.json();
    cache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
