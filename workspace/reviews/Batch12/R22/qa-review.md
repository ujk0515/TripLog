# Batch12/R22 QA Review — 장소 상세 페이지

- 검토일: 2026-04-17
- screen_id: `place_detail`
- 검토 기준: spec_place_detail.md (기획서 정본), wf_place_detail (구조 정본), desc_place_detail (동작 정본), design_place_detail (시각 정본), developer-review.md

---

## 1. Penpot Board 존재 여부

| Board | board_id | 존재 여부 | 비고 |
|-------|----------|-----------|------|
| wf_place_detail | 79dff928-1716-8020-8007-e2ec1ed1745c | 존재 | 시각 확인 완료 |
| desc_place_detail | 79dff928-1716-8020-8007-e2ecc5e23cbd | 존재 | 시각 확인 완료 |
| design_place_detail | 79dff928-1716-8020-8007-e2f276600bbb | 존재 | 시각 확인 완료 |

3개 Board 모두 존재. 상태별(메모 없음, 방문 시간 미입력) 전용 디자인 Board는 없으나, desc_place_detail 10번 블록에 상태 분기 동작이 텍스트로 정의되어 있으므로 구조 기준은 충족.

---

## 2. 기획서 완성도 검토

### 2.1 누락된 화면/상태/variant

| 항목 | 평가 | 근거 |
|------|------|------|
| 로딩 상태 (데이터 로드 중) | **누락** | 기획서 4. 상태 정의에 loading 상태가 없음. 4개 API 호출이 필요한데 로딩 중 화면 정의가 없음 |
| 에러 상태 (API 실패) | **누락** | 장소/여행/숙소/메모 API 중 하나라도 실패 시 화면 동작 미정의 |
| 메모 없음 전용 디자인 | 텍스트 정의 있음 | desc_place_detail No.8 "메모 없을 때: 목록 영역 미표시" 명시. design 보드는 메모 있음 상태만 표현. 정의는 충분하나 개발 시 시각 레퍼런스 없음 |
| 방문 시간 미입력 전용 디자인 | 텍스트 정의 있음 | desc_place_detail No.7 "미입력 시 빈값 표시" 명시. 동일 이슈 |
| 숙소 In == Out 마커 1개 | 기획서 정의 있음 | 기획서 3-3 "In == Out이면 마커 1개". 단, 이 상태의 design 레퍼런스 없음 |

### 2.2 모호한 요구사항

| 항목 | 이슈 | 기준 정본 |
|------|------|-----------|
| 뒤로가기 동작 | 기획서 3-1: "여행 상세(`/trip/:id`) 화면으로 이동"으로 명시. developer-review 4.10에서 `goBack()` 대신 `navigate(/trip/${tripId})`를 권고하며 이유 설명. 기획서 기준 명확하나, MapView 마커 팝업 경로로 진입 시 `/trip/:id`가 히스토리에 없을 수 있는 경우에 대한 언급 없음 | 기획서 3-1 |
| 거리/시간 초기 로드 | 기획서 3-4, wf_place_detail No.5에 "직선 거리 기준 표시"로 명시. 그러나 지도 렌더링 전 거리/시간 표기 가능 여부 불명확. MapView의 `onRouteInfo` 콜백 의존이 확실한지 정의 없음 | 기획서 3-4 |
| 메모 저장 버튼 비활성 조건 | desc_place_detail No.10 "빈 입력 시 저장 불가(버튼비활성)" 명시. 기획서 3-5에는 버튼 비활성 조건이 없음 — desc와 기획서 간 내용 불일치 (desc가 더 구체적) | 기획서 3-5 vs desc_place_detail No.10 |
| 메모 저장 성공/실패 피드백 | 저장 후 입력 필드 초기화는 명시. 저장 실패 시 피드백(토스트/에러 메시지) 정의 없음 | 기획서 3-5 |
| 메모 삭제 확인 | day_memo_entries에는 삭제 시 확인 팝업 없음. place_memo도 동일한지 명시 없음 | 기획서 3-5 |

### 2.3 API/DB 관련 불일치 (developer-review 기반)

| 항목 | 이슈 | 심각도 |
|------|------|--------|
| DELETE 응답 코드 | 기획서: `204 No Content`. 기존 day_memo DELETE: `200 { ok: true }`. 불일치 존재 (developer-review 3.3) | Minor |
| 인덱스 누락 | 기획서 DDL에 `(place_id, created_at)` 복합 인덱스 미포함 (developer-review 2.4 권장) | Minor |

---

## 3. developer 기술 검토와 기획서 간 불일치 확인

developer-review.md에서 도출된 기획서 대비 불일치:

| No | 항목 | developer 검토 내용 | 기획서 기준 | QA 판단 |
|----|------|---------------------|-------------|---------|
| 1 | DELETE 응답 코드 | 기존 패턴은 `200 { ok: true }`. 기획서는 `204 No Content` | 기획서 6절 | 불일치 — 기획서 우선. 단, 프로젝트 일관성 문제이므로 팀 합의 필요. Minor. |
| 2 | 뒤로가기 구현 | `goBack()` vs `navigate(/trip/${tripId})`. developer는 navigate 권장 | 기획서 3-1 "여행 상세로 이동" | 기획서 명시 기준으로 `navigate` 사용이 맞음. 이슈 아님 (developer가 이미 정합 방향 제시) |
| 3 | 메모 스타일 차이 | design_place_detail은 파란 원형 뱃지, #F8FAFC 배경, 휴지통 이모지. day_memo는 텍스트 넘버링, 배경 없음, "x" 버튼 | design_place_detail | 기획서 3-5 "day_memo_entries와 동일한 구조를 따름"이 구조(데이터 모델)를 가리키는지 시각 스타일까지 포함하는지 모호. design_place_detail을 시각 정본으로 보면 차이 처리 필요. developer-review 4.8이 이미 파악 및 대응 방안 제시. |
| 4 | 깃발 마커 구현 | MarkerVariant prop 추가 방식 | 기획서 3-3, design_place_detail | 기획서 정의 및 design 일치. 구현 방안은 적절. |
| 5 | 거리/시간 괄호 | 기존 TripDetailPage: `(거리: 약 Nkm / 시간: 약 Nm)`. PlaceDetailPage: 괄호 없이 | 기획서 3-2 "괄호 없이 표기" | 기획서 명시 기준. 기존 TripDetailPage를 바꾸는 게 아니므로 회귀 아님. |

---

## 4. 테스트 관점 리스크

| No | 리스크 | 설명 | 우선순위 |
|----|--------|------|---------|
| T1 | 라우트 순서 충돌 | `/place/new`와 `/place/:placeId`가 같은 segment 수. `placeNewMatch`를 반드시 `placeDetailMatch` 앞에 배치해야 함 | P0 |
| T2 | 4개 API 동시 로딩 | trip, places, accommodations, memos 4개 API 중 1개라도 지연/실패 시 화면 깨짐 가능 | P1 |
| T3 | 넘버링 정합성 | 장소 추가/삭제/순서 변경 직후 상세 진입 시 넘버링이 최신인지 확인 필요 | P1 |
| T4 | 메모 50자 경계 | 프론트 maxLength + 서버 VARCHAR(50) 이중 검증. 50자 정확히/51자 시나리오 필요 | P1 |
| T5 | 공유 사용자 메모 API 호출 | 기획서 비범위: 소유자만 메모 작성 가능. requireAuth + verifyTripOwner로 차단되는지 확인 | P1 |
| T6 | 숙소 In == Out 마커 | 숙소 체크인/체크아웃 날짜가 동일할 때 마커가 1개인지 확인 | P2 |
| T7 | 지도 없이 장소 표시 불가 | 기획서 비범위에 "지도 없이 장소 상세 표시" 명시. 지도 컴포넌트 렌더링 실패 시 fallback 없음 | P2 |
| T8 | Day N 계산 경계 | start_date == place.date (Day 1), 마지막 날 등 경계 케이스 | P2 |

---

## 5. Penpot 근거 요약

| 확인 항목 | 확인 결과 |
|-----------|-----------|
| wf_place_detail | 정상 — 상단바(뒤로가기+타이틀+연필)/장소명/주소(줄바꿈)/방문일자/거리시간/지도(In Out 목적지 마커)/방문시간/메모목록(넘버링+삭제)/입력필드/저장버튼 전체 표시. 기획서 3-2~3-5 모든 요소 커버. |
| desc_place_detail | 정상 — 10개 번호 블록 전체 표시. 메타 헤더(화면ID/화면명/화면경로) 포함. desc No.10에 "빈 입력 시 저장 불가" 명시 (기획서 미포함 내용). |
| design_place_detail | 정상 — 딥블루 상단바(#1E3A5F)/장소명/주소/방문일자(파란 아이콘)/거리시간/지도(파란 배경+In Out 목적지깃발)/방문시간/메모(파란원형뱃지+#F8FAFC배경+휴지통)/입력필드/저장버튼 전체 표현. |

---

## 6. 종합 평가

- 기획서 완성도: **양호** — 주요 화면/컴포넌트/API 정의 충분. 로딩/에러 상태 미정의가 유일한 구조적 누락.
- wf/desc/design Board: **모두 존재**, 기획서와 정합성 확인.
- developer-review 대비: DELETE 204 vs 200 불일치 1건(Minor), 인덱스 누락 1건(Minor) 외 기획-구현 방향 정합.
- TC 작성 진행 가능.
