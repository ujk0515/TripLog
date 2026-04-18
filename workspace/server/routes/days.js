const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function verifyTripOwner(db, tripId, userId) {
  const result = await db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) return { err: 404, msg: '여행을 찾을 수 없습니다' };
  if (result.rows[0].user_id !== userId) return { err: 403, msg: '권한이 없습니다' };
  return { ok: true };
}

// GET /api/trips/:id/days — 일별 날짜 목록 (메모 포함)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    // Get trip date range
    const tripResult = await req.db.query('SELECT start_date, end_date FROM trips WHERE id=$1', [tripId]);
    if (tripResult.rows.length === 0) return res.status(404).json({ message: '여행을 찾을 수 없습니다' });

    const { start_date, end_date } = tripResult.rows[0];

    // Get all memos for this trip
    const memoResult = await req.db.query(
      'SELECT date, memo FROM day_memos WHERE trip_id=$1',
      [tripId]
    );
    const memoMap = {};
    for (const row of memoResult.rows) {
      memoMap[row.date.toISOString().slice(0, 10)] = row.memo;
    }

    // Build day list from date range
    const days = [];
    const current = new Date(start_date);
    const end = new Date(end_date);
    let dayIndex = 1;
    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        day_index: dayIndex,
        memo: memoMap[dateStr] || null,
      });
      current.setDate(current.getDate() + 1);
      dayIndex++;
    }

    res.json(days);
  } catch (err) {
    next(err);
  }
});

// GET /api/trips/:id/days/:date/memo — 날짜 메모 조회
router.get('/:date/memo', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, date } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      'SELECT memo FROM day_memos WHERE trip_id=$1 AND date=$2',
      [tripId, date]
    );
    res.json({ memo: result.rows.length > 0 ? result.rows[0].memo : null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id/days/:date/memo — 날짜 메모 수정 (upsert)
router.put('/:date/memo', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, date } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { memo } = req.body;
    await req.db.query(
      `INSERT INTO day_memos (trip_id, date, memo)
       VALUES ($1, $2, $3)
       ON CONFLICT (trip_id, date) DO UPDATE SET memo = EXCLUDED.memo`,
      [tripId, date, memo || null]
    );
    res.json({ ok: true, memo: memo || null });
  } catch (err) {
    next(err);
  }
});

// GET /api/trips/:id/days/:date/memos — 일자별 메모 목록
router.get('/:date/memos', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, date } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      'SELECT id, memo, created_at FROM day_memo_entries WHERE trip_id=$1 AND date=$2 ORDER BY created_at ASC',
      [tripId, date]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips/:id/days/:date/memos — 메모 추가
router.post('/:date/memos', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, date } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { memo } = req.body;
    if (!memo || !memo.trim()) return res.status(400).json({ message: '메모를 입력하세요' });
    if (memo.length > 50) return res.status(400).json({ message: '메모는 50자까지 입력 가능합니다' });

    const result = await req.db.query(
      'INSERT INTO day_memo_entries (trip_id, date, memo) VALUES ($1, $2, $3) RETURNING id, memo, created_at',
      [tripId, date, memo.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/days/:date/memos/:memoId — 메모 삭제
router.delete('/:date/memos/:memoId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, memoId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    await req.db.query('DELETE FROM day_memo_entries WHERE id=$1 AND trip_id=$2', [memoId, tripId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
