const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

const VALID_CURRENCIES = ['KRW', 'USD', 'EUR', 'JPY', 'CNY'];
// Frontend sends English IDs; accept both for compatibility
const VALID_CATEGORIES = ['food', 'transport', 'accommodation', 'sightseeing', 'other', '식비', '교통', '숙박', '관광', '기타'];

async function verifyTripOwner(db, tripId, userId) {
  const result = await db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) return { err: 404, msg: '여행을 찾을 수 없습니다' };
  if (result.rows[0].user_id !== userId) return { err: 403, msg: '권한이 없습니다' };
  return { ok: true };
}

// GET /api/trips/:id/expenses — 경비 목록
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      `SELECT e.*, p.name AS place_name
       FROM expenses e
       LEFT JOIN places p ON e.place_id = p.id
       WHERE e.trip_id = $1
       ORDER BY e.date ASC, e.created_at ASC`,
      [tripId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips/:id/expenses — 경비 추가
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { title, amount, currency, exchange_rate, category, date, place_id, rate_fetched_at } = req.body;
    if (!title || amount === undefined || !currency || !category) {
      return res.status(400).json({ message: '필수 항목을 모두 입력해주세요' });
    }
    if (!VALID_CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: '지원하지 않는 통화입니다' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: '유효하지 않은 카테고리입니다' });
    }
    if (currency !== 'KRW' && (exchange_rate === undefined || exchange_rate === null || exchange_rate === '')) {
      return res.status(400).json({ message: 'KRW 외 통화는 환율을 입력해야 합니다' });
    }

    const rate = currency === 'KRW' ? 1 : exchange_rate;
    const fetchedAt = currency === 'KRW' ? null : (rate_fetched_at || null);

    const result = await req.db.query(
      `INSERT INTO expenses (trip_id, place_id, title, amount, currency, exchange_rate, category, date, rate_fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [tripId, place_id || null, title, amount, currency, rate, category, date || null, fetchedAt]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id/expenses/:expenseId — 경비 수정
router.put('/:expenseId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, expenseId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { title, amount, currency, exchange_rate, category, date, place_id, rate_fetched_at } = req.body;
    if (!title || amount === undefined || !currency || !category) {
      return res.status(400).json({ message: '필수 항목을 모두 입력해주세요' });
    }
    if (!VALID_CURRENCIES.includes(currency)) {
      return res.status(400).json({ message: '지원하지 않는 통화입니다' });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ message: '유효하지 않은 카테고리입니다' });
    }
    if (currency !== 'KRW' && (exchange_rate === undefined || exchange_rate === null || exchange_rate === '')) {
      return res.status(400).json({ message: 'KRW 외 통화는 환율을 입력해야 합니다' });
    }

    const rate = currency === 'KRW' ? 1 : exchange_rate;

    // 수정 모드에서는 rate_fetched_at가 body에 있으면 그대로 유지, 없으면 기존 값 보존
    let fetchedAtClause = '';
    let params;
    if (rate_fetched_at !== undefined) {
      fetchedAtClause = ', rate_fetched_at=$8';
      params = [place_id || null, title, amount, currency, rate, category, date || null, rate_fetched_at || null, expenseId, tripId];
      const result = await req.db.query(
        `UPDATE expenses SET place_id=$1, title=$2, amount=$3, currency=$4, exchange_rate=$5, category=$6, date=$7${fetchedAtClause}
         WHERE id=$9 AND trip_id=$10 RETURNING *`,
        params
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: '경비 항목을 찾을 수 없습니다' });
      }
      res.json(result.rows[0]);
    } else {
      // rate_fetched_at 미전달 시 기존 값 유지
      const result = await req.db.query(
        `UPDATE expenses SET place_id=$1, title=$2, amount=$3, currency=$4, exchange_rate=$5, category=$6, date=$7
         WHERE id=$8 AND trip_id=$9 RETURNING *`,
        [place_id || null, title, amount, currency, rate, category, date || null, expenseId, tripId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ message: '경비 항목을 찾을 수 없습니다' });
      }
      res.json(result.rows[0]);
    }
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/expenses/:expenseId — 경비 삭제
router.delete('/:expenseId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, expenseId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      'DELETE FROM expenses WHERE id=$1 AND trip_id=$2 RETURNING id',
      [expenseId, tripId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '경비 항목을 찾을 수 없습니다' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
