const express = require('express');
const crypto = require('crypto');
const { requireAuth, requireTripOwner } = require('../middleware/auth');

const router = express.Router();

// 국가 코드 → 현지 통화 매핑
const COUNTRY_CURRENCY_MAP = {
  JP: 'JPY', FR: 'EUR', TH: 'THB', US: 'USD', KR: 'KRW',
  IT: 'EUR', ES: 'EUR', GB: 'GBP', DE: 'EUR', CN: 'CNY',
  VN: 'VND', AU: 'AUD',
};

// GET /api/trips — 내 여행 목록
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await req.db.query(
      `SELECT t.*,
        COALESCE(pc.cnt, 0) AS place_count,
        COALESCE(ec.total_krw, 0) AS total_expense_krw
       FROM trips t
       LEFT JOIN (
         SELECT trip_id, COUNT(*) AS cnt FROM places GROUP BY trip_id
       ) pc ON pc.trip_id = t.id
       LEFT JOIN (
         SELECT trip_id, SUM(amount * exchange_rate) AS total_krw FROM expenses GROUP BY trip_id
       ) ec ON ec.trip_id = t.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );

    // 각 여행별 현지 통화 합계 계산
    const trips = result.rows;
    if (trips.length > 0) {
      const tripIds = trips.map(t => t.id);
      const localResult = await req.db.query(
        `SELECT trip_id, currency, SUM(amount) AS total_amount
         FROM expenses
         WHERE trip_id = ANY($1) AND currency != 'KRW'
         GROUP BY trip_id, currency`,
        [tripIds]
      );

      // 여행별로 가장 큰 비-KRW 통화 합계 찾기
      const localMap = {};
      localResult.rows.forEach(row => {
        const key = row.trip_id;
        const amount = Number(row.total_amount);
        if (!localMap[key] || amount > localMap[key].amount) {
          localMap[key] = { amount, currency: row.currency };
        }
      });

      trips.forEach(trip => {
        const localCurrency = COUNTRY_CURRENCY_MAP[trip.country_code] || null;
        if (localCurrency && localCurrency !== 'KRW') {
          // 해당 여행의 현지 통화 경비 합산
          const localExpenses = localResult.rows.filter(
            r => r.trip_id === trip.id && r.currency === localCurrency
          );
          trip.total_expense_local = localExpenses.length > 0
            ? Math.round(Number(localExpenses[0].total_amount))
            : 0;
          trip.local_currency = localCurrency;
        } else {
          trip.total_expense_local = 0;
          trip.local_currency = null;
        }
      });
    }

    res.json(trips);
  } catch (err) {
    next(err);
  }
});

// POST /api/trips — 여행 생성
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, country, country_code, start_date, end_date } = req.body;
    if (!title || !country || !country_code || !start_date || !end_date) {
      return res.status(400).json({ message: '필수 항목을 모두 입력해주세요' });
    }
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ message: '시작일은 종료일보다 빨라야 합니다' });
    }

    const result = await req.db.query(
      `INSERT INTO trips (user_id, title, country, country_code, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, title, country, country_code, start_date, end_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/trips/:id — 여행 상세
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await req.db.query(
      `SELECT t.*,
        COALESCE(pc.cnt, 0) AS place_count,
        COALESCE(ec.total_krw, 0) AS total_expense_krw
       FROM trips t
       LEFT JOIN (
         SELECT trip_id, COUNT(*) AS cnt FROM places GROUP BY trip_id
       ) pc ON pc.trip_id = t.id
       LEFT JOIN (
         SELECT trip_id, SUM(amount * exchange_rate) AS total_krw FROM expenses GROUP BY trip_id
       ) ec ON ec.trip_id = t.id
       WHERE t.id = $1 AND t.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '여행을 찾을 수 없습니다' });
    }

    const trip = result.rows[0];
    const localCurrency = COUNTRY_CURRENCY_MAP[trip.country_code] || null;
    if (localCurrency && localCurrency !== 'KRW') {
      const localResult = await req.db.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_local
         FROM expenses
         WHERE trip_id = $1 AND currency = $2`,
        [trip.id, localCurrency]
      );
      trip.total_expense_local = Math.round(Number(localResult.rows[0].total_local));
      trip.local_currency = localCurrency;
    } else {
      trip.total_expense_local = 0;
      trip.local_currency = null;
    }

    res.json(trip);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trips/:id — 여행 수정
router.put('/:id', requireAuth, requireTripOwner, async (req, res, next) => {
  try {
    const { title, country, country_code, start_date, end_date, status } = req.body;

    // status만 변경하는 경우 (schedule complete 등)
    if (status && !title) {
      const result = await req.db.query(
        `UPDATE trips SET status=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *`,
        [status, req.params.id, req.user.id]
      );
      return res.json(result.rows[0]);
    }

    if (!title || !country || !country_code || !start_date || !end_date) {
      return res.status(400).json({ message: '필수 항목을 모두 입력해주세요' });
    }
    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ message: '시작일은 종료일보다 빨라야 합니다' });
    }

    const result = await req.db.query(
      `UPDATE trips SET title=$1, country=$2, country_code=$3, start_date=$4, end_date=$5, status=COALESCE($8, status), updated_at=NOW()
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, country, country_code, start_date, end_date, req.params.id, req.user.id, status || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id — 여행 삭제
router.delete('/:id', requireAuth, requireTripOwner, async (req, res, next) => {
  try {
    await req.db.query('DELETE FROM trips WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/trips/:id/share — 공유 링크 생성 (멱등)
router.post('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const tripResult = await req.db.query('SELECT * FROM trips WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (tripResult.rows.length === 0) return res.status(404).json({ message: '여행을 찾을 수 없습니다' });

    const trip = tripResult.rows[0];
    if (trip.share_token) return res.json({ shareToken: trip.share_token });

    const shareToken = crypto.randomBytes(32).toString('hex');
    await req.db.query('UPDATE trips SET share_token=$1, updated_at=NOW() WHERE id=$2', [shareToken, req.params.id]);
    res.status(201).json({ shareToken });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trips/:id/share — 공유 링크 비활성화
router.delete('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const result = await req.db.query(
      'UPDATE trips SET share_token=NULL, updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: '여행을 찾을 수 없습니다' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
