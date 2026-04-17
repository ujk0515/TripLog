#!/bin/bash
# DB 마이그레이션 실행 스크립트
# migrations/ 안의 .sql 파일을 순서대로 적용
# 이미 적용된 것은 schema_migrations 테이블로 추적해서 스킵
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"

DB_NAME="${DB_NAME:-triplog}"

# 마이그레이션 추적 테이블 보장 (postgres 유저로)
sudo -u postgres psql -d "$DB_NAME" -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);
" > /dev/null

applied=0
skipped=0

for file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  version=$(basename "$file" .sql)

  # 이미 적용됐는지 확인
  already=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT 1 FROM schema_migrations WHERE version = '$version';")

  if [[ "$already" == "1" ]]; then
    echo "  [skip] $version (적용됨)"
    skipped=$((skipped+1))
    continue
  fi

  echo "  [run]  $version"
  sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$file"
  sudo -u postgres psql -d "$DB_NAME" -c "INSERT INTO schema_migrations (version) VALUES ('$version');" > /dev/null
  applied=$((applied+1))
done

echo ""
echo "마이그레이션 완료: 적용 $applied 건, 스킵 $skipped 건"

# 앱 DB 유저에게 모든 테이블 권한 부여
APP_USER="${DB_APP_USER:-triplog_user}"
if [[ $applied -gt 0 ]]; then
  echo ""
  echo "==> $APP_USER 에게 테이블 권한 부여 중..."
  sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $APP_USER;" > /dev/null
  sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $APP_USER;" > /dev/null
  echo "  권한 부여 완료"
fi
