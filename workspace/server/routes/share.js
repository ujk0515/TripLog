const express = require('express');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// 국가 코드 → 현지 통화 매핑
const COUNTRY_CURRENCY_MAP = {
  JP: 'JPY', FR: 'EUR', TH: 'THB', US: 'USD', KR: 'KRW',
  IT: 'EUR', ES: 'EUR', GB: 'GBP', DE: 'EUR', CN: 'CNY',
  VN: 'VND', AU: 'AUD',
};

// GET /api/share/:shareToken — 공유 여행 조회 (비인증 허용)
router.get('/:shareToken', optionalAuth, async (req, res, next) => {
  try {
    const { shareToken } = req.params;

    const tripResult = await req.db.query('SELECT * FROM trips WHERE share_token=$1', [shareToken]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ message: '공유 링크를 찾을 수 없습니다' });
    }

    const trip = tripResult.rows[0];

    const placesResult = await req.db.query(
      'SELECT * FROM places WHERE trip_id=$1 ORDER BY date ASC, order_index ASC',
      [trip.id]
    );
    const expensesResult = await req.db.query(
      'SELECT * FROM expenses WHERE trip_id=$1 ORDER BY date ASC',
      [trip.id]
    );

    let viewerRole = 'guest';
    if (req.user) {
      viewerRole = req.user.id === trip.user_id ? 'owner' : 'user';
    }

    // Build days structure matching mock API format
    const places = placesResult.rows;
    const expenses = expensesResult.rows;
    const totalKRW = expenses.reduce((sum, e) => sum + Number(e.amount) * Number(e.exchange_rate || 1), 0);

    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const days = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        places: places.filter(p => p.date && p.date.toISOString ? p.date.toISOString().slice(0,10) === dateStr : String(p.date).slice(0,10) === dateStr),
      });
      cur.setDate(cur.getDate() + 1);
    }

    res.json({
      trip: {
        id: trip.id,
        title: trip.title,
        country: trip.country,
        country_code: trip.country_code,
        start_date: trip.start_date,
        end_date: trip.end_date,
        user_id: trip.user_id,
        placeCount: places.length,
        totalExpense: Math.round(totalKRW),
      },
      days,
      viewerRole,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/share/:shareToken/comments — 댓글 작성 (로그인 필요)
router.post('/:shareToken/comments', requireAuth, async (req, res, next) => {
  try {
    const { shareToken } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '댓글 내용을 입력해주세요' });
    }

    const tripResult = await req.db.query('SELECT id FROM trips WHERE share_token=$1', [shareToken]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ message: '공유 링크를 찾을 수 없습니다' });
    }

    const tripId = tripResult.rows[0].id;
    const result = await req.db.query(
      'INSERT INTO comments (trip_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [tripId, req.user.id, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/share/:shareToken/comments — 댓글 목록 (비인증 허용)
router.get('/:shareToken/comments', optionalAuth, async (req, res, next) => {
  try {
    const { shareToken } = req.params;

    const tripResult = await req.db.query('SELECT id FROM trips WHERE share_token=$1', [shareToken]);
    if (tripResult.rows.length === 0) {
      return res.status(404).json({ message: '공유 링크를 찾을 수 없습니다' });
    }

    const tripId = tripResult.rows[0].id;
    const result = await req.db.query(
      `SELECT c.id, c.content, c.created_at, u.email AS user_email
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.trip_id=$1
       ORDER BY c.created_at ASC`,
      [tripId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
