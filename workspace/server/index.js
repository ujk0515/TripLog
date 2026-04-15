require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const placeRoutes = require('./routes/places');
const expenseRoutes = require('./routes/expenses');
const shareRoutes = require('./routes/share');
const dayRoutes = require('./routes/days');
const accommodationRoutes = require('./routes/accommodation');
const ratesRoutes = require('./routes/rates');
const searchRoutes = require('./routes/search');

// ============================================================
// Database Pool
// ============================================================
// PostgreSQL DATE 타입이 로컬 타임존으로 변환되는 문제 방지
// pg 모듈의 DATE 파서를 UTC 문자열 그대로 반환하도록 오버라이드
const pg = require('pg');
pg.types.setTypeParser(1082, val => val); // DATE → 'YYYY-MM-DD' 문자열 그대로

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Make pool available globally
const app = express();

// ============================================================
// Static files
// ============================================================
app.use('/public', express.static(path.join(__dirname, 'public')));

// ============================================================
// OG meta tag route (must be before API routes)
// ============================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

app.get('/share/:shareToken', async (req, res) => {
  try {
    const { shareToken } = req.params;
    const result = await pool.query(
      `SELECT t.title, t.country, t.country_code, t.start_date, t.end_date
       FROM trips t WHERE t.share_token = $1`,
      [shareToken]
    );

    if (result.rows.length === 0) {
      return res.status(404).send('Not found');
    }

    const trip = result.rows[0];
    const ogTitle = escapeHtml(trip.title);
    const ogDescription = escapeHtml(
      trip.country
        ? `${trip.country} | ${trip.start_date} ~ ${trip.end_date}`
        : `${trip.start_date} ~ ${trip.end_date}`
    );
    const ogUrl = `${req.protocol}://${req.get('host')}/share/${shareToken}`;
    const ogImage = `${req.protocol}://${req.get('host')}/public/og-share.png`;
    const frontendOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080';
    const appUrl = `${frontendOrigin}/#/share/${shareToken}`;

    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${ogUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TripLog" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta http-equiv="refresh" content="0;url=${appUrl}" />
  <title>${ogTitle} - TripLog</title>
</head>
<body>
  <p>Redirecting to TripLog...</p>
</body>
</html>`);
  } catch (err) {
    console.error('OG route error:', err);
    res.status(500).send('Server error');
  }
});

// ============================================================
// Middleware
// ============================================================
app.use(cors({
  origin: function(origin, callback) {
    // 개발 환경: localhost 및 로컬 네트워크 IP 허용
    if (!origin || origin.startsWith('http://localhost') || origin.match(/^http:\/\/192\.168\.\d+\.\d+/)) {
      callback(null, true);
    } else {
      callback(null, process.env.CORS_ORIGIN || 'http://localhost:8080');
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Attach db pool to request
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// ============================================================
// Routes
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/trips/:id/places', placeRoutes);
app.use('/api/trips/:id/expenses', expenseRoutes);
app.use('/api/trips/:id/days', dayRoutes);
app.use('/api/trips/:id/accommodations', accommodationRoutes);
app.use('/api/rates', ratesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/share', shareRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// Error handler
// ============================================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// ============================================================
// Start
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TripLog server running on port ${PORT}`);
});

module.exports = app;
