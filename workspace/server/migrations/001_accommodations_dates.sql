-- 001_accommodations_dates.sql
-- 숙소 테이블에 체크인/체크아웃 날짜 컬럼 추가, 단일 숙소 제약 제거
-- 2026-04-15

ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_in_date DATE;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_out_date DATE;
ALTER TABLE accommodations DROP CONSTRAINT IF EXISTS accommodations_trip_id_key;
