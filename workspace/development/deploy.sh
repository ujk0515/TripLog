#!/bin/bash
# TripLog Frontend Deploy Script
# 로컬에서 빌드 후 오라클 서버로 업로드 (Option B)
#
# 사용법:
#   1. 같은 폴더에 .deploy.env 파일 생성 (.deploy.env.example 참고)
#   2. ./deploy.sh 실행

set -e  # 에러 발생 시 즉시 중단

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ============================================================
# Config 로드
# ============================================================
if [ -f "$SCRIPT_DIR/.deploy.env" ]; then
  set -a
  source "$SCRIPT_DIR/.deploy.env"
  set +a
else
  echo "ERROR: .deploy.env 파일이 없습니다."
  echo "  .deploy.env.example 을 참고해서 .deploy.env 를 만들어 주세요."
  exit 1
fi

: "${DEPLOY_HOST:?DEPLOY_HOST 가 .deploy.env 에 설정되지 않음}"
: "${DEPLOY_USER:?DEPLOY_USER 가 .deploy.env 에 설정되지 않음}"
: "${DEPLOY_KEY:?DEPLOY_KEY 가 .deploy.env 에 설정되지 않음}"
: "${DEPLOY_PATH:=/var/www/triplog}"

# ~ 확장
DEPLOY_KEY="${DEPLOY_KEY/#\~/$HOME}"

if [ ! -f "$DEPLOY_KEY" ]; then
  echo "ERROR: SSH 키 파일을 찾을 수 없음: $DEPLOY_KEY"
  exit 1
fi

# ============================================================
# 빌드
# ============================================================
echo "==> [1/4] 의존성 설치 확인..."
if [ ! -d "node_modules" ]; then
  npm install
fi

echo "==> [2/4] 빌드 중..."
rm -rf dist
npm run build

if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
  echo "ERROR: 빌드 실패 - dist/ 가 비어있거나 없음"
  exit 1
fi

echo "  빌드 완료: $(du -sh dist | cut -f1)"

# ============================================================
# 업로드
# ============================================================
echo "==> [3/4] 서버 디렉토리 준비: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
ssh -i "$DEPLOY_KEY" -o StrictHostKeyChecking=accept-new "${DEPLOY_USER}@${DEPLOY_HOST}" "
  sudo mkdir -p ${DEPLOY_PATH} &&
  sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${DEPLOY_PATH}
"

echo "==> [4/4] 파일 업로드 중 (변경분만 전송)..."
rsync -avz --delete \
  -e "ssh -i $DEPLOY_KEY" \
  dist/ \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo ""
echo "배포 완료"
echo "  경로: ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
echo "  확인: http://${DEPLOY_HOST}/"
