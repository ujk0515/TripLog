-- 일자별 메모 엔트리 (1:N, 순차 기록)
CREATE TABLE day_memo_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  memo VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_day_memo_entries_trip_date ON day_memo_entries (trip_id, date, created_at);
