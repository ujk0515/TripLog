const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { sendVerificationCode } = require('../utils/mailer');

const router = express.Router();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'triplog-access-secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'triplog-refresh-secret';
const RESET_SECRET = process.env.JWT_RESET_SECRET || 'triplog-reset-secret';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '30d';

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다' });
    }

    // Check duplicate email
    const existing = await req.db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: '이미 사용 중인 이메일입니다' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await req.db.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );
    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Store refresh token (30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await req.db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    res.status(201).json({
      user: { id: user.id, email: user.email },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요' });
    }

    const result = await req.db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 일치하지 않습니다' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await req.db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    res.json({
      user: { id: user.id, email: user.email },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    // Invalidate all refresh tokens for this user
    await req.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user.id]);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    const result = await req.db.query(
      'SELECT rt.*, u.email FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = $1 AND rt.expires_at > NOW()',
      [refreshToken]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: '유효하지 않은 토큰입니다' });
    }

    const row = result.rows[0];
    const user = { id: row.user_id, email: row.email };

    // Delete old token
    await req.db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await req.db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, newRefreshToken, expiresAt]
    );

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });
    res.json({
      accessToken: newAccessToken,
    });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Password Reset Flow
// ============================================================

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: '이메일을 입력해주세요.' });
    }

    // Check if email exists
    const userResult = await req.db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: '가입 이력이 없는 이메일입니다.' });
    }

    const userId = userResult.rows[0].id;

    // Generate 6-digit random code
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');

    // Store in password_reset_codes (expires in 2 minutes)
    await req.db.query(
      `INSERT INTO password_reset_codes (user_id, email, code, expires_at)
       VALUES ($1, $2, $3, NOW() + INTERVAL '2 minutes')`,
      [userId, email, code]
    );

    // Send email via nodemailer
    await sendVerificationCode(email, code);

    res.json({ message: '인증코드가 발송되었습니다.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-code
router.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: '이메일과 인증코드를 입력해주세요.' });
    }

    // Find valid, unused code
    const result = await req.db.query(
      `SELECT id, user_id FROM password_reset_codes
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: '인증코드가 올바르지 않습니다.' });
    }

    const row = result.rows[0];

    // Mark as used
    await req.db.query('UPDATE password_reset_codes SET used = TRUE WHERE id = $1', [row.id]);

    // Generate a short-lived reset token (JWT, 5 minutes)
    const resetToken = jwt.sign(
      { userId: row.user_id, email, purpose: 'password-reset' },
      RESET_SECRET,
      { expiresIn: '5m' }
    );

    res.json({ resetToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: '필수 항목이 누락되었습니다.' });
    }

    // Validate newPassword length
    if (newPassword.length < 8) {
      return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, RESET_SECRET);
    } catch (err) {
      return res.status(400).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
    }

    if (decoded.email !== email || decoded.purpose !== 'password-reset') {
      return res.status(400).json({ message: '유효하지 않은 토큰입니다.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user password
    await req.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, decoded.userId]);

    // Invalidate all refresh tokens for this user (force logout of all sessions)
    await req.db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [decoded.userId]);

    res.json({ message: '비밀번호가 정상적으로 변경되었습니다.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
