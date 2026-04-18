const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Verify trip ownership helper
async function verifyTripOwner(db, tripId, userId) {
  const result = await db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) return { err: 404, msg: '여행을 찾을 수 없습니다' };
  if (result.rows[0].user_id !== userId) return { err: 403, msg: '권한이 없습니다' };
  return { ok: true };
}

// GET /api/trips/:id/places?date=YYYY-MM-DD — 장소 목록
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const { date } = req.query;

    // Verify user owns trip
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    let query = 'SELECT * FROM places WHERE trip_id = $1';
    const params = [tripId];

    if (date) {
      query += ' AND date = $2 ORDER BY order_index ASC, created_at ASC';
      params.push(date);
    } else {
      query += ' ORDER BY date ASC, order_index ASC, created_at ASC';
    }

    const result = await req.db.query(query, params);
    // date를 YYYY-MM-DD 문자열로 변환 (PostgreSQL DATE가 타임스탬프로 반환되는 문제 해결)
    const rows = result.rows.map(r => ({
      ...r,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : typeof r.date === 'string' && r.date.length > 10 ? r.date.slice(0, 10) : r.date,
    }));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Validate date is within trip range helper
async function validateDateRange(db, tripId, date) {
  const result = await db.query('SELECT start_date, end_date FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) return false;
  const trip = result.rows[0];
  const d = date;
  const start = trip.start_date instanceof Date
    ? trip.start_date.toISOString().slice(0, 10)
    : String(trip.start_date).slice(0, 10);
  const end = trip.end_date instanceof Date
    ? trip.end_date.toISOString().slice(0, 10)
    : String(trip.end_date).slice(0, 10);
  if (d < start || d > end) return false;
  return true;
}

// POST /api/trips/:id/places — 장소 추가
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { date, name, lat, lng, visit_time, memo, order_index } = req.body;
    if (!date || !name) {
      return res.status(400).json({ message: '날짜와 장소명은 필수입니다' });
    }

    const inRange = await validateDateRange(req.db, tripId, date);
    if (!inRange) {
      return res.status(400).json({ error: 'date_out_of_range', message: '날짜가 여행 기간 범위를 벗어났습니다' });
    }

    const result = await req.db.query(
      `INSERT INTO places (trip_id, date, name, lat, lng, visit_time, memo, order_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [tripId, date, name, lat || null, lng || null, visit_time || null, memo || null, order_index || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id/places/:placeId — 장소 수정
router.put('/:placeId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, placeId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { date, name, lat, lng, visit_time, memo, order_index } = req.body;

    // order_index만 변경하는 경우 (순서 변경)
    if (order_index !== undefined && !date && !name) {
      const result = await req.db.query(
        `UPDATE places SET order_index=$1 WHERE id=$2 AND trip_id=$3 RETURNING *`,
        [order_index, placeId, tripId]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: '장소를 찾을 수 없습니다' });
      return res.json(result.rows[0]);
    }

    if (!date || !name) {
      return res.status(400).json({ message: '날짜와 장소명은 필수입니다' });
    }

    const inRange = await validateDateRange(req.db, tripId, date);
    if (!inRange) {
      return res.status(400).json({ error: 'date_out_of_range', message: '날짜가 여행 기간 범위를 벗어났습니다' });
    }

    const result = await req.db.query(
      `UPDATE places SET date=$1, name=$2, lat=$3, lng=$4, visit_time=$5, memo=$6, order_index=$7
       WHERE id=$8 AND trip_id=$9 RETURNING *`,
      [date, name, lat || null, lng || null, visit_time || null, memo || null, order_index || 0, placeId, tripId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '장소를 찾을 수 없습니다' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/places/:placeId — 장소 삭제
router.delete('/:placeId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, placeId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      'DELETE FROM places WHERE id=$1 AND trip_id=$2 RETURNING id',
      [placeId, tripId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '장소를 찾을 수 없습니다' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Place Memo Entries (place_memo_entries)
// ============================================================

// Verify place belongs to trip helper
async function verifyPlaceOwnership(db, placeId, tripId) {
  const result = await db.query('SELECT id FROM places WHERE id=$1 AND trip_id=$2', [placeId, tripId]);
  return result.rows.length > 0;
}

// GET /api/trips/:id/places/:placeId/memos — 장소 메모 목록
router.get('/:placeId/memos', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, placeId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const owns = await verifyPlaceOwnership(req.db, placeId, tripId);
    if (!owns) return res.status(404).json({ message: '장소를 찾을 수 없습니다' });

    const result = await req.db.query(
      'SELECT id, memo, created_at FROM place_memo_entries WHERE place_id=$1 ORDER BY created_at ASC',
      [placeId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips/:id/places/:placeId/memos — 장소 메모 추가
router.post('/:placeId/memos', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, placeId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const owns = await verifyPlaceOwnership(req.db, placeId, tripId);
    if (!owns) return res.status(404).json({ message: '장소를 찾을 수 없습니다' });

    const { memo } = req.body;
    if (!memo || !memo.trim()) return res.status(400).json({ message: '메모를 입력하세요' });
    if (memo.length > 50) return res.status(400).json({ message: '메모는 50자까지 입력 가능합니다' });

    const result = await req.db.query(
      'INSERT INTO place_memo_entries (place_id, memo) VALUES ($1, $2) RETURNING id, memo, created_at',
      [placeId, memo.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/places/:placeId/memos/:memoId — 장소 메모 삭제
router.delete('/:placeId/memos/:memoId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, placeId, memoId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const owns = await verifyPlaceOwnership(req.db, placeId, tripId);
    if (!owns) return res.status(404).json({ message: '장소를 찾을 수 없습니다' });

    await req.db.query('DELETE FROM place_memo_entries WHERE id=$1 AND place_id=$2', [memoId, placeId]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
