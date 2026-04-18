# Batch12/R22 Developer Tech Review - 장소 상세 페이지

> 검토일: 2026-04-17
> 검토 기준: spec_place_detail.md, wf_place_detail, desc_place_detail, design_place_detail, project-config.md, 기존 서버/프론트 코드

---

## 1. 선행 조건 확인

| 항목 | 상태 | 근거 |
|------|------|------|
| planner claim | complete | planner.claim.json: completion_state=complete, wf/desc 생성 완료 |
| designer claim | complete | designer.claim.json: completion_state=complete, developer_ready=Y |
| design_place_detail 보드 | 존재 확인 | board_id: 79dff928-1716-8020-8007-e2f276600bbb, export_shape 시각 확인 완료 |
| workboard designer_status | todo (미갱신) | claim 파일이 정본. claim에서 complete + developer_ready=Y이므로 개발 진행 가능 |

결론: 선행 조건 충족. 개발 진행 가능.

---

## 2. DB 설계 검토 - place_memo_entries

### 2.1 기획서 DDL

```sql
CREATE TABLE place_memo_entries (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id    UUID        NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  memo        VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);
```

### 2.2 기존 패턴과의 비교

| 항목 | day_memo_entries (기존) | place_memo_entries (신규) | 평가 |
|------|------------------------|--------------------------|------|
| PK | UUID gen_random_uuid() | UUID gen_random_uuid() | 동일 |
| FK 참조 | trips(id) ON DELETE CASCADE | places(id) ON DELETE CASCADE | 적절 - places가 trips CASCADE이므로 여행 삭제시 연쇄 삭제됨 |
| FK 대상 | trip_id + date (복합 식별) | place_id (단일 FK) | 적절 - 장소 1:N 메모이므로 place_id만으로 충분 |
| memo 타입 | VARCHAR(50) NOT NULL | VARCHAR(50) NOT NULL | 동일 |
| 정렬 기준 | created_at | created_at | 동일 |

### 2.3 판단

**적절하다.** 기존 day_memo_entries와 구조적 일관성이 있다. CASCADE 체인이 trips -> places -> place_memo_entries로 이어지므로 여행/장소 삭제 시 메모도 자동 정리된다.

### 2.4 인덱스 권장

```sql
CREATE INDEX idx_place_memo_entries_place_id ON place_memo_entries (place_id, created_at);
```

day_memo_entries에 `idx_day_memo_entries_trip_date`가 있는 것처럼, place_memo_entries에도 place_id 기반 조회 인덱스를 추가해야 한다. 기획서에 인덱스가 명시되지 않았으나 조회 성능 기준으로 필수.

### 2.5 마이그레이션

파일명: `004_place_memo_entries.sql` (기존 003까지 존재)

---

## 3. API 설계 검토

### 3.1 엔드포인트 설계

| 메서드 | 경로 | 기획서 정의 | 평가 |
|--------|------|------------|------|
| GET | /trips/:id/places/:placeId/memos | 메모 목록 조회 | 적절 |
| POST | /trips/:id/places/:placeId/memos | 메모 추가 (50자 제한) | 적절 |
| DELETE | /trips/:id/places/:placeId/memos/:memoId | 메모 삭제 | 적절 |

### 3.2 기존 패턴과의 비교

기존 day_memo API (`/trips/:id/days/:date/memos`)와 구조가 동일하다.

| 항목 | day_memo API | place_memo API | 평가 |
|------|-------------|---------------|------|
| 인증 | requireAuth | requireAuth | 동일 |
| 소유권 검증 | verifyTripOwner(tripId, userId) | verifyTripOwner(tripId, userId) | 동일 패턴 재사용 가능 |
| POST 검증 | memo 빈값 체크 + 50자 제한 | memo 빈값 체크 + 50자 제한 | 동일 |
| DELETE 응답 | 200 { ok: true } | 기획서는 204 No Content | 불일치 - 아래 참고 |

### 3.3 불일치 사항

**DELETE 응답 코드**: 기획서는 `204 No Content`를 명시하지만, 기존 day_memo DELETE는 `200 { ok: true }`를 반환한다. 일관성을 위해 기존 패턴(200 + JSON body)을 따르는 것을 권장한다. 프론트엔드에서 204를 처리해도 되지만, 프로젝트 전체에서 DELETE 응답이 혼재하면 유지보수 비용이 증가한다.

### 3.4 place 소유권 검증 추가 고려

현재 places 라우트의 verifyTripOwner는 tripId로만 검증한다. place_memo API에서는 추가로 placeId가 해당 tripId에 속하는지 검증해야 한다. 기존 places PUT/DELETE에서도 `WHERE id=$1 AND trip_id=$2` 패턴으로 이중 검증하고 있으므로, 같은 패턴을 적용하면 된다.

### 3.5 라우트 마운팅

현재 서버 index.js에서 places는 `/api/trips/:id/places`로 마운트된다. place_memo는 places 라우터 내부에서 `/:placeId/memos` 서브라우트로 추가하거나, 별도 라우트 파일로 분리하여 `/api/trips/:id/places/:placeId/memos`로 마운트할 수 있다.

권장: places.js 내부에 추가. 이유:
- 파일이 152줄로 소규모
- verifyTripOwner 헬퍼를 공유
- 기존 day_memo도 days.js 내부에 있음

### 3.6 구현 난이도

**낮음.** 기존 day_memo_entries API (days.js 95-145행)를 그대로 참조하여 place_id 기반으로 변환하면 된다. 예상 추가 코드: 약 50줄.

---

## 4. 프론트엔드 검토 - PlaceDetailPage.jsx

### 4.1 라우팅 등록

현재 App.jsx의 라우트 매칭 순서:

```
placeNewMatch:  /trip/:tripId/day/:date/place/new
placeEditMatch: /trip/:tripId/day/:date/place/:placeId/edit
```

신규 추가 필요:
```
placeDetailMatch: /trip/:tripId/day/:date/place/:placeId
```

**주의: 매칭 순서가 중요하다.** matchRoute는 path segment 수가 같아야 매칭되므로:
- `/trip/:tripId/day/:date/place/new` (6 segments) != `/trip/:tripId/day/:date/place/:placeId` (6 segments)
  - "new"와 ":placeId"는 같은 위치이므로, `placeNewMatch`를 `placeDetailMatch`보다 먼저 검사해야 `/place/new`가 `placeId = "new"`로 잘못 매칭되지 않는다.
- `/trip/:tripId/day/:date/place/:placeId/edit` (7 segments) != 6 segments이므로 충돌 없음.

현재 코드에서 `placeNewMatch`가 `placeEditMatch`보다 먼저 검사되므로, `placeDetailMatch`를 `placeEditMatch` 뒤, `tripDetailMatch` 앞에 추가하면 된다.

구체적 순서:
1. placeNewMatch (6 seg, "new" 리터럴)
2. placeEditMatch (7 seg)
3. placeDetailMatch (6 seg, ":placeId" 와일드카드) -- 신규
4. ...나머지

### 4.2 데이터 의존성

PlaceDetailPage가 렌더링에 필요한 데이터:

| 데이터 | 출처 | API 호출 |
|--------|------|----------|
| 장소 정보 (name, lat, lng, visit_time, memo, order_index, date) | GET /trips/:id/places?date=:date | 기존 API |
| 여행 정보 (start_date, 넘버링 계산용) | GET /trips/:id | 기존 API |
| 숙소 정보 (In/Out 마커용) | GET /trips/:id/accommodations | 기존 API |
| 장소 메모 목록 | GET /trips/:id/places/:placeId/memos | 신규 API |

### 4.3 넘버링 계산

기획서: "순서 번호는 해당 날의 일정 순서" (order_index 기반).
현재 TripDetailPage에서 dayPlaces를 `order_index`로 정렬한 후 `map((place, idx) => idx + 1)` 로 넘버링한다.

PlaceDetailPage에서도 동일 로직이 필요하다:
1. 해당 날짜의 모든 장소를 조회
2. order_index로 정렬
3. 현재 placeId의 인덱스 + 1 = 넘버링

### 4.4 Day N 계산

기획서: "Day N은 여행 시작일 기준 계산"
```
dayN = (Date.parse(place.date) - Date.parse(trip.start_date)) / 86400000 + 1
```

기존 코드에서 TripDetailPage의 Day 탭이 이 계산을 사용한다.

### 4.5 지도 (MapView) 연동

기획서/디자인에서 지도는 **항시 노출**이다 (TripDetailPage의 토글과 다름).

MapView 컴포넌트는 현재 다음 props를 받는다:
```
places, accommodation, dayAccommodations, onRouteInfo, onPlaceClick
```

PlaceDetailPage에서는:
- `places`: 해당 장소 1개만 전달 (배열)
- `dayAccommodations`: getDayAccommodations로 In/Out 계산
- `onRouteInfo`: 거리/시간 표시용
- `onPlaceClick`: 불필요 (이미 상세 페이지에 있으므로)

### 4.6 깃발 마커 variant 추가

기획서: "목적지 마커: 깃발 모양"
디자인: marker_dest에 깃발 이모지 + 빨간색 라벨

현재 MapView의 장소 마커는 **번호 원형 마커**(검정 배경 + 흰색 숫자)이다. 기획서는 PlaceDetailPage 지도에서 목적지를 **깃발 마커**로 표시하라고 한다.

구현 방안:
1. MapView에 `markerVariant` prop 추가 (예: `'number'` | `'flag'`)
2. `'flag'`일 때 기존 번호 아이콘 대신 깃발 아이콘 사용
3. PlaceDetailPage에서만 `markerVariant="flag"` 전달

또는 더 단순하게:
- PlaceDetailPage 전용으로 MapView를 사용할 때 places 배열에 커스텀 속성을 추가하여 MapView 내부에서 분기

권장: prop 방식. 기존 MapView 사용처(TripDetailPage, ScheduleCreatePage, PlaceAddPage)에 영향 없음.

### 4.7 거리/시간 표시

기획서: "거리: 약 Nkm / 시간: 약 N분" (괄호 없이 표기)
현재 TripDetailPage: `(거리: 약 ${d} / 시간: 약 ${t})` -- 괄호 있음

PlaceDetailPage에서는 기획서 스펙대로 괄호 없이 표시해야 한다. 이것은 TripDetailPage의 기존 동작을 변경하라는 의미가 아니므로, PlaceDetailPage 내부에서 별도 포맷 함수를 사용하면 된다.

### 4.8 메모 섹션

day_memo_entries와 "동일한 구조를 따름"이므로, TripDetailPage의 메모 렌더링 로직을 그대로 참조하되 API 경로만 변경:
- 조회: `/trips/:id/places/:placeId/memos`
- 추가: POST 동일 경로
- 삭제: DELETE `/trips/:id/places/:placeId/memos/:memoId`

디자인 차이점 (design_place_detail 기준):
- 메모 넘버링: 파란 원형 뱃지(`#2563EB` 배경, 흰색 숫자)
- 메모 배경: `#F8FAFC` (기존 day_memo는 배경 없음)
- 삭제 아이콘: 휴지통 이모지 (기존 day_memo는 X 텍스트)
- 저장 버튼: `#1E3A5F` 배경, 12px radius (기존은 `#333333`)

이 차이는 PlaceDetailPage 전용 CSS 클래스로 처리해야 한다.

### 4.9 편집 전환

연필 아이콘 클릭 -> `/trip/:id/day/:date/place/:placeId/edit` (기존 PlaceAddPage가 edit 모드로 처리)

기존 PlaceAddPage는 이미 `placeEditMatch`를 인식하여 edit 모드로 동작한다. 별도 코드 변경 불필요.

### 4.10 뒤로가기

기획서: "여행 상세(/trip/:id) 화면으로 이동"
구현: `navigate(`/trip/${tripId}`)` 또는 `goBack()`

goBack()은 브라우저 히스토리 기반이므로 진입 경로에 따라 다른 곳으로 갈 수 있다. 기획서가 명시적으로 여행 상세로 이동을 요구하므로, `navigate(`/trip/${tripId}`)` 를 사용하는 것이 안전하다.

---

## 5. TripDetailPage 장소 클릭 -> 상세 진입

### 5.1 현재 동작

TripDetailPage 장소 목록의 각 카드에는 "수정" 버튼과 "삭제" 버튼이 있다.
- 수정: `navigate(`/trip/${tripId}/day/${selectedDay}/place/${place.id}/edit`)`
- 삭제: 모달 확인 후 DELETE API

MapView 마커 팝업의 "상세보기":
- `onPlaceClick: (p) => navigate(`/trip/${tripId}/day/${selectedDay}/place/${p.id}/edit`)`
- 현재는 edit 페이지로 직접 이동

### 5.2 변경 필요

기획서에 따르면:
1. **장소 목록 행 클릭** -> 장소 상세(`/trip/:id/day/:date/place/:placeId`) 진입
2. **MapView 마커 "상세보기"** -> 장소 상세 진입
3. 장소 상세에서 연필 아이콘 -> 수정 페이지 진입

변경 범위:
- 장소 카드 전체를 클릭 가능하게 변경 (현재는 수정/삭제 버튼만 클릭 가능)
- 또는 장소명/주소 영역 클릭 시 상세 진입, 수정/삭제 버튼은 유지
- MapView onPlaceClick 경로를 edit에서 상세로 변경

권장: 장소 카드 전체를 onClick으로 상세 진입, 수정/삭제 버튼은 stopPropagation으로 기존 동작 유지. 이렇게 하면 기존 수정/삭제 기능이 그대로 유지되면서 새 상세 페이지 진입 경로가 추가된다.

### 5.3 기존 동작 영향

| 영향 대상 | 변경 내용 | 위험도 |
|-----------|----------|--------|
| TripDetailPage 장소 카드 | onClick 추가, 수정/삭제 버튼 stopPropagation | 낮음 |
| MapView onPlaceClick | 경로 변경 (edit -> 상세) | 낮음 |
| PlaceAddPage (edit 모드) | 변경 없음 (라우트 그대로) | 없음 |

---

## 6. design_place_detail 디자인 토큰 정리

Penpot export_shape에서 추출한 디자인 값:

### 6.1 색상 토큰

| 요소 | 색상 | 용도 |
|------|------|------|
| topbar_bg | #1E3A5F | 상단바 배경 (기존 topbar와 동일) |
| btn_back / btn_edit | #FFFFFF 15% opacity | 상단바 버튼 배경 |
| icon_back / icon_edit / topbar_title | #FFFFFF | 상단바 아이콘/텍스트 |
| place_name | #1E293B | 장소명 |
| place_address | #475569 | 주소 |
| visit_date | #2563EB | 방문 일자 |
| date_icon_bg | #2563EB 10% opacity | 날짜 아이콘 배경 |
| dist_time | #64748B | 거리/시간 |
| map_container bg | #E8F0FE | 지도 컨테이너 배경 |
| marker_in_label | #2563EB | In 라벨 |
| marker_out_label / marker_dest_label | #EF4444 | Out/목적지 라벨 |
| dividers | #E2E8F0 | 구분선 |
| section labels | #94A3B8 | 섹션 라벨 (방문 시간, 메모) |
| visit_time_value | #1E293B | 방문 시간 값 |
| memo_item_bg | #F8FAFC | 메모 항목 배경 |
| memo_badge | #2563EB | 메모 넘버링 뱃지 |
| memo_num | #FFFFFF | 뱃지 숫자 |
| memo_text | #334155 | 메모 텍스트 |
| memo_input bg | #F8FAFC | 입력 필드 배경 |
| memo_input placeholder | #94A3B8 | placeholder |
| btn_save | #1E3A5F | 저장 버튼 |
| btn_save_label | #FFFFFF | 저장 버튼 텍스트 |

### 6.2 사이즈 토큰

| 요소 | 값 | 비고 |
|------|-----|------|
| 상단바 높이 | 56px | 기존 topbar와 동일 |
| 지도 컨테이너 | 358 x 200px | radius: 12px |
| 메모 뱃지 | 22 x 22px | radius: 999 (원형) |
| 메모 항목 배경 | 358 x 40px | radius: 8px |
| 메모 입력 필드 | 358 x 48px | radius: 10px |
| 저장 버튼 | 80 x 40px | radius: 12px |
| 뒤로가기/편집 버튼 | 32 x 32px | radius: 999 (원형) |

### 6.3 기존 토큰과의 차이

| 항목 | 기존 (day_memo in TripDetailPage) | 신규 (design_place_detail) |
|------|----------------------------------|---------------------------|
| 메모 넘버링 | 텍스트 "1." (회색) | 파란 원형 뱃지 + 흰 숫자 |
| 메모 삭제 | "x" 텍스트 버튼 | 휴지통 이모지 |
| 메모 항목 배경 | 없음 (border-bottom) | #F8FAFC rounded rect |
| 저장 버튼 색상 | #333333 | #1E3A5F |
| 입력 필드 | 기본 textarea | #F8FAFC 배경 + 10px radius |

이 차이는 PlaceDetailPage 전용 CSS 클래스 세트로 처리한다. 기존 day-memo 스타일을 변경하지 않는다.

---

## 7. 파일 구조 계획

### 7.1 서버

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| workspace/server/migrations/004_place_memo_entries.sql | 신규 | CREATE TABLE + INDEX |
| workspace/server/schema.sql | 수정 | place_memo_entries 테이블 + 인덱스 추가 |
| workspace/server/routes/places.js | 수정 | GET/POST/DELETE memo 엔드포인트 추가 (~50줄) |

### 7.2 프론트엔드

| 파일 | 변경 유형 | 내용 |
|------|----------|------|
| workspace/development/src/pages/PlaceDetailPage.jsx | 신규 | 장소 상세 페이지 컴포넌트 |
| workspace/development/src/styles/place-detail.css | 신규 | 장소 상세 전용 스타일 |
| workspace/development/src/App.jsx | 수정 | import + 라우트 매칭 추가 |
| workspace/development/src/pages/TripDetailPage.jsx | 수정 | 장소 카드 onClick 상세 진입 + MapView onPlaceClick 경로 변경 |
| workspace/development/src/components/MapView.jsx | 수정 | 깃발 마커 variant prop 추가 |

### 7.3 분리 원칙 준수

- PlaceDetailPage.jsx: 화면 조립 + API 호출 + 상태 관리
- place-detail.css: 스타일 분리 (design_place_detail 토큰 기반)
- MapView.jsx: 깃발 variant는 기존 코드에 조건부 분기로 추가 (별도 파일 불필요)
- 메모 CRUD 로직이 TripDetailPage와 유사하므로, 향후 커스텀 훅으로 추출할 수 있으나 현 시점에서는 PlaceDetailPage 내부에 구현해도 구조적으로 적절

---

## 8. 기술적 이슈 및 리스크

### 8.1 낮은 리스크

| 항목 | 설명 | 대응 |
|------|------|------|
| 라우트 순서 충돌 | `/place/new`와 `/place/:placeId` 매칭 충돌 가능 | placeNewMatch를 placeDetailMatch 앞에 배치 |
| 지도 항시 노출 | TripDetailPage는 토글이지만 PlaceDetailPage는 항시 노출 | MapView에 토글 불필요, 항상 렌더링 |
| 메모 50자 제한 | 프론트 maxLength + 서버 VARCHAR(50) 이중 검증 | 기존 day_memo와 동일 패턴 |

### 8.2 중간 리스크

| 항목 | 설명 | 대응 |
|------|------|------|
| 데이터 로드 순서 | 4개 API를 호출해야 함 (trip, places, accommodations, memos) | 기존 TripDetailPage 패턴 참조: 순차 호출 (refresh race condition 방지) |
| 넘버링 정합성 | 장소 추가/삭제/순서변경 후 상세 진입 시 넘버링이 최신이어야 함 | 매 진입 시 places 전체 조회 + 정렬로 계산 |

### 8.3 고려 사항

| 항목 | 설명 |
|------|------|
| 깃발 마커 디자인 | design_place_detail에서 목적지 마커가 깃발 이모지 + 빨간색 라벨로 표현됨. Leaflet divIcon에 깃발 아이콘을 적용해야 함 |
| 주소 줄바꿈 | 기획서: "전체 노출, 줄바꿈 처리, ellipsis 금지, overflow 금지". CSS word-break + overflow-wrap으로 처리 |
| 공유 사용자 메모 | 기획서 비범위: "공유받은 사람의 메모 작성은 소유자만". 현재 requireAuth + verifyTripOwner로 이미 보장됨 |

---

## 9. 종합 판단

### 9.1 실현 가능성: 가능

- DB 변경: 단순 테이블 추가. 기존 패턴 100% 재사용.
- API 추가: 기존 day_memo API 복사 + FK 변경. 50줄 수준.
- 프론트 신규 페이지: TripDetailPage + PlaceAddPage의 기존 패턴 조합. 중간 규모.
- 기존 코드 수정: App.jsx 라우트 추가, TripDetailPage onClick 추가, MapView prop 추가. 소규모.

### 9.2 예상 작업량

| 영역 | 예상 규모 |
|------|---------|
| 서버 (migration + routes) | 소규모 (~70줄) |
| PlaceDetailPage.jsx | 중규모 (~200-250줄) |
| place-detail.css | 소규모 (~80-100줄) |
| App.jsx 수정 | 최소 (~10줄) |
| TripDetailPage.jsx 수정 | 최소 (~15줄) |
| MapView.jsx 수정 | 최소 (~20줄) |

### 9.3 주요 권장 사항

1. DELETE 응답: 기존 패턴(200 + JSON)을 따르고 기획서 204와의 차이를 문서화
2. 인덱스: place_memo_entries에 (place_id, created_at) 복합 인덱스 추가
3. 라우트 순서: placeNewMatch > placeEditMatch > placeDetailMatch 순서 유지
4. 깃발 마커: MapView에 markerVariant prop으로 확장, 기존 사용처 기본값 'number'
5. 메모 스타일: place-detail.css에 전용 클래스, 기존 day-memo 스타일 변경 금지
