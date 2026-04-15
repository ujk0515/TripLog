const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

async function verifyTripOwner(db, tripId, userId) {
  const result = await db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
  if (result.rows.length === 0) return { err: 404, msg: '여행을 찾을 수 없습니다' };
  if (result.rows[0].user_id !== userId) return { err: 403, msg: '권한이 없습니다' };
  return { ok: true };
}

// 날짜 겹침 검증 (excludeId: 수정 시 자기 자신 제외)
async function checkDateOverlap(db, tripId, checkIn, checkOut, excludeId) {
  const query = excludeId
    ? `SELECT id FROM accommodations WHERE trip_id = $1 AND id != $4
       AND check_in_date < $3 AND check_out_date > $2`
    : `SELECT id FROM accommodations WHERE trip_id = $1
       AND check_in_date < $3 AND check_out_date > $2`;
  const params = excludeId
    ? [tripId, checkIn, checkOut, excludeId]
    : [tripId, checkIn, checkOut];
  const result = await db.query(query, params);
  return result.rows.length > 0;
}

// GET /api/trips/:id/accommodation — 숙소 목록 조회
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const result = await req.db.query(
      'SELECT * FROM accommodations WHERE trip_id = $1 ORDER BY check_in_date ASC NULLS LAST, created_at ASC',
      [tripId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips/:id/accommodation — 숙소 생성
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { name: rawName, address: rawAddress, phone, lat, lng, guest_count, price_per_person, currency, exchange_rate, check_in_date, check_out_date } = req.body;
    if (!rawName) {
      return res.status(400).json({ message: '숙소명은 필수입니다' });
    }

    // 숙소명 파싱: 콤마 포함이면 앞=name, 뒤=address로 분리
    const parts = rawName.split(',');
    const name = parts[0].trim();
    const address = rawAddress || (parts.length > 1 ? parts.slice(1).join(',').trim() : null);

    // 날짜 겹침 검증
    if (check_in_date && check_out_date) {
      if (check_in_date >= check_out_date) {
        return res.status(400).json({ message: '체크아웃은 체크인 이후여야 합니다' });
      }
      const overlap = await checkDateOverlap(req.db, tripId, check_in_date, check_out_date);
      if (overlap) {
        return res.status(409).json({ message: '다른 숙소와 날짜가 겹칩니다' });
      }
    }

    const result = await req.db.query(
      `INSERT INTO accommodations (trip_id, name, address, phone, lat, lng, guest_count, price_per_person, currency, exchange_rate, check_in_date, check_out_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [tripId, name, address || null, phone || null, lat || null, lng || null, guest_count || 1, price_per_person || 0, currency || 'KRW', exchange_rate || 1, check_in_date || null, check_out_date || null]
    );

    const accommodation = result.rows[0];

    // 경비 자동 연동
    const totalPrice = (guest_count || 1) * (price_per_person || 0);
    if (totalPrice > 0) {
      const expTitle = `숙소: ${name}`;
      const expCurrency = currency || 'KRW';
      const expRate = expCurrency === 'KRW' ? 1 : (exchange_rate || 1);
      const expDate = check_in_date || null;

      await req.db.query(
        `INSERT INTO expenses (trip_id, title, amount, currency, exchange_rate, category, date)
         VALUES ($1, $2, $3, $4, $5, 'accommodation', $6)`,
        [tripId, expTitle, totalPrice, expCurrency, expRate, expDate]
      );
    }

    res.status(201).json(accommodation);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id/accommodation/:accomId — 숙소 수정
router.put('/:accomId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, accomId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { name: rawName, address: rawAddress, phone, lat, lng, guest_count, price_per_person, currency, exchange_rate, check_in_date, check_out_date } = req.body;
    if (!rawName) {
      return res.status(400).json({ message: '숙소명은 필수입니다' });
    }

    // 숙소명 파싱: 콤마 포함이면 앞=name, 뒤=address로 분리
    const parts = rawName.split(',');
    const name = parts[0].trim();
    const address = rawAddress || (parts.length > 1 ? parts.slice(1).join(',').trim() : null);

    // 날짜 겹침 검증
    if (check_in_date && check_out_date) {
      if (check_in_date >= check_out_date) {
        return res.status(400).json({ message: '체크아웃은 체크인 이후여야 합니다' });
      }
      const overlap = await checkDateOverlap(req.db, tripId, check_in_date, check_out_date, accomId);
      if (overlap) {
        return res.status(409).json({ message: '다른 숙소와 날짜가 겹칩니다' });
      }
    }

    // 기존 숙소 이름 조회 (경비 업데이트용)
    const oldAccom = await req.db.query('SELECT name FROM accommodations WHERE id = $1 AND trip_id = $2', [accomId, tripId]);

    const result = await req.db.query(
      `UPDATE accommodations SET name=$1, address=$2, phone=$3, lat=$4, lng=$5, guest_count=$6, price_per_person=$7, currency=$8, exchange_rate=$9, check_in_date=$10, check_out_date=$11
       WHERE id=$12 AND trip_id=$13 RETURNING *`,
      [name, address || null, phone || null, lat || null, lng || null, guest_count || 1, price_per_person || 0, currency || 'KRW', exchange_rate || 1, check_in_date || null, check_out_date || null, accomId, tripId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '숙소를 찾을 수 없습니다' });
    }

    const accommodation = result.rows[0];

    // 경비 자동 연동
    const totalPrice = (guest_count || 1) * (price_per_person || 0);
    const expCurrency = currency || 'KRW';
    const expRate = expCurrency === 'KRW' ? 1 : (exchange_rate || 1);
    const oldName = oldAccom.rows[0]?.name;
    const oldExpTitle = oldName ? `숙소: ${oldName}` : null;
    const newExpTitle = `숙소: ${name}`;

    const existingExpense = await req.db.query(
      `SELECT id FROM expenses WHERE trip_id = $1 AND category = 'accommodation' AND title = $2`,
      [tripId, oldExpTitle || newExpTitle]
    );

    if (totalPrice > 0) {
      if (existingExpense.rows.length > 0) {
        await req.db.query(
          `UPDATE expenses SET title=$1, amount=$2, currency=$3, exchange_rate=$4, date=$5 WHERE id=$6`,
          [newExpTitle, totalPrice, expCurrency, expRate, check_in_date || null, existingExpense.rows[0].id]
        );
      } else {
        await req.db.query(
          `INSERT INTO expenses (trip_id, title, amount, currency, exchange_rate, category, date)
           VALUES ($1, $2, $3, $4, $5, 'accommodation', $6)`,
          [tripId, newExpTitle, totalPrice, expCurrency, expRate, check_in_date || null]
        );
      }
    } else if (existingExpense.rows.length > 0) {
      await req.db.query('DELETE FROM expenses WHERE id = $1', [existingExpense.rows[0].id]);
    }

    res.json(accommodation);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id/accommodation (no accomId) — 하위호환: 단일 숙소 upsert
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const { name: rawName, address: rawAddress, phone, lat, lng, guest_count, price_per_person, currency, exchange_rate, check_in_date, check_out_date } = req.body;
    if (!rawName) {
      return res.status(400).json({ message: '숙소명은 필수입니다' });
    }

    // 숙소명 파싱: 콤마 포함이면 앞=name, 뒤=address로 분리
    const parts = rawName.split(',');
    const name = parts[0].trim();
    const address = rawAddress || (parts.length > 1 ? parts.slice(1).join(',').trim() : null);

    const existing = await req.db.query(
      'SELECT id FROM accommodations WHERE trip_id = $1 ORDER BY created_at ASC LIMIT 1',
      [tripId]
    );

    if (existing.rows.length > 0) {
      req.params.accomId = existing.rows[0].id;
      return router.handle(Object.assign({}, req, { method: 'PUT', url: `/${existing.rows[0].id}` }), res, next);
    }

    // 없으면 POST로 처리
    const result = await req.db.query(
      `INSERT INTO accommodations (trip_id, name, address, phone, lat, lng, guest_count, price_per_person, currency, exchange_rate, check_in_date, check_out_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [tripId, name, address || null, phone || null, lat || null, lng || null, guest_count || 1, price_per_person || 0, currency || 'KRW', exchange_rate || 1, check_in_date || null, check_out_date || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/accommodation/:accomId — 특정 숙소 삭제
router.delete('/:accomId', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId, accomId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    const accom = await req.db.query('SELECT name FROM accommodations WHERE id = $1 AND trip_id = $2', [accomId, tripId]);
    if (accom.rows.length === 0) {
      return res.status(404).json({ message: '숙소를 찾을 수 없습니다' });
    }

    await req.db.query('DELETE FROM accommodations WHERE id = $1 AND trip_id = $2', [accomId, tripId]);

    // 관련 경비 삭제
    const expTitle = `숙소: ${accom.rows[0].name}`;
    await req.db.query(
      `DELETE FROM expenses WHERE trip_id = $1 AND category = 'accommodation' AND title = $2`,
      [tripId, expTitle]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/accommodation — 전체 숙소 삭제
router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const { id: tripId } = req.params;
    const check = await verifyTripOwner(req.db, tripId, req.user.id);
    if (check.err) return res.status(check.err).json({ message: check.msg });

    await req.db.query('DELETE FROM accommodations WHERE trip_id = $1', [tripId]);
    await req.db.query(
      `DELETE FROM expenses WHERE trip_id = $1 AND category = 'accommodation' AND title LIKE '숙소:%'`,
      [tripId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
