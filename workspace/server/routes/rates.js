const express = require('express');
const router = express.Router();

// 간단 메모리 캐시 (동일 파라미터 1분간 재사용)
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

// GET /api/rates?from=KRW&to=USD,EUR,JPY,CNY
router.get('/', async (req, res, next) => {
  try {
    const from = String(req.query.from || 'KRW').toUpperCase();
    const to = String(req.query.to || 'USD,EUR,JPY,CNY').toUpperCase();

    const cacheKey = `${from}|${to}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(502).json({ error: 'upstream_error', status: upstream.status });
    }
    const data = await upstream.json();

    cache.set(cacheKey, { ts: Date.now(), data });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
