-- TripLog Database Schema
-- PostgreSQL

-- ============================================================
-- Tables (dependency order)
-- ============================================================

-- 사용자
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 여행
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  country_code CHAR(2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  share_token VARCHAR(64) UNIQUE,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 일별 메모
CREATE TABLE day_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  memo TEXT,
  UNIQUE(trip_id, date)
);

-- 장소
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL,
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  visit_time TIME,
  memo TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 경비
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'KRW',
  exchange_rate DECIMAL(12, 6) DEFAULT 1,
  category VARCHAR(50) NOT NULL,
  date DATE,
  rate_fetched_at TIMESTAMP NULL,  -- 환율 조회 시각 (Frankfurter API). NULL이면 수동 입력 또는 기존 데이터
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration (기존 DB에 적용 시):
-- ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rate_fetched_at TIMESTAMP NULL;

-- 댓글
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 숙소 (여행 1건당 복수 숙소 허용 — UNIQUE(trip_id) 없음)
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  lat DECIMAL(10, 7),
  lng DECIMAL(10, 7),
  guest_count INTEGER DEFAULT 1,
  price_per_person DECIMAL(12, 2) DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'KRW',
  exchange_rate DECIMAL(12, 6) DEFAULT 1,
  check_in_date DATE,
  check_out_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Migration (기존 DB 적용):
-- ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_in_date DATE;
-- ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_out_date DATE;
-- ALTER TABLE accommodations DROP CONSTRAINT IF EXISTS accommodations_trip_id_key;

-- Refresh Token
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 비밀번호 재설정 인증코드
CREATE TABLE password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 장소별 메모
CREATE TABLE place_memo_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  memo VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_places_trip_date ON places(trip_id, date);
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_comments_trip_id ON comments(trip_id);
CREATE INDEX idx_accommodations_trip_id ON accommodations(trip_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_reset_codes_email ON password_reset_codes(email);
CREATE INDEX idx_place_memo_entries_place ON place_memo_entries(place_id, created_at);
