const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'triplog-access-secret';

/**
 * Required auth middleware: returns 401 if no valid token
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증이 필요합니다' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: '유효하지 않은 토큰입니다' });
  }
}

/**
 * Optional auth middleware: attaches user if token present, continues otherwise
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = { id: decoded.userId, email: decoded.email };
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Trip ownership middleware: checks if the authenticated user owns the trip
 */
async function requireTripOwner(req, res, next) {
  const tripId = req.params.id || req.params.tripId;
  if (!tripId) return res.status(400).json({ message: 'Trip ID required' });

  try {
    const result = await req.db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '여행을 찾을 수 없습니다' });
    }
    if (result.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ message: '권한이 없습니다' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, optionalAuth, requireTripOwner };
