#!/bin/bash
# DB 비밀번호 재설정 + .env 동기화
set -e

cd ~/TripLog/workspace/server

read -s -p "새 DB 비밀번호: " PW
echo

if [[ -z "$PW" ]]; then
    echo "비밀번호가 비어 있습니다."
    exit 1
fi

if [[ "$PW" == *"'"* ]]; then
    echo "비밀번호에 작은따옴표(')는 사용할 수 없습니다."
    exit 1
fi

echo "==> PostgreSQL 비밀번호 변경..."
sudo -u postgres psql -c "ALTER USER triplog_user WITH PASSWORD '${PW}';"

echo "==> .env 파일 업데이트..."
export NEW_PW="$PW"
python3 <<'PYEOF'
import os, re
pw = os.environ['NEW_PW']
with open('.env') as f:
    content = f.read()
content = re.sub(
    r'^DATABASE_URL=.*',
    'DATABASE_URL=postgresql://triplog_user:' + pw + '@localhost:5432/triplog',
    content,
    flags=re.M
)
content = re.sub(
    r'^DB_PASSWORD=.*',
    'DB_PASSWORD=' + pw,
    content,
    flags=re.M
)
with open('.env', 'w') as f:
    f.write(content)
PYEOF

unset PW NEW_PW
chmod 600 .env

echo "==> Node 서버 재시작..."
pm2 restart triplog-api

echo ""
echo "done"
