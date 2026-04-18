-- 장소별 메모 엔트리 (1:N, 순차 기록)
CREATE TABLE place_memo_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  memo VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_place_memo_entries_place ON place_memo_entries (place_id, created_at);
