# Customer Map Planner

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel에 관리하던 거래처 목록을 검색·선택하고, 주소를 Kakao Maps 좌표로 변환한 뒤 가까운 거래처를 자동 클러스터링해 A4 가로 지도로 출력하는 브라우저 기반 업무 도구입니다.

**Live Demo:** https://kzone87.github.io/customer-map-planner/

## Why I built it

현장 방문이나 거래처 관리를 위해 Excel 주소 목록을 지도에 옮길 때 반복적인 주소 검색, 근접 거래처 확인, 라벨 정리와 인쇄 준비가 필요했습니다. 이 프로젝트는 그 흐름을 하나의 로컬 브라우저 작업공간으로 줄이기 위해 만들었습니다.

## Product workflow

1. Excel 또는 내장 샘플 거래처 로드
2. 이름/주소로 검색하고 지도 표시 대상을 선택
3. Kakao JavaScript 키로 지도 연결
4. 선택 주소를 제한된 batch로 지오코딩
5. 실패 주소는 별도 목록에서 수정 후 재시도
6. 100m~10km 사이의 거리 기준으로 connected-distance clustering
7. 라벨 충돌을 줄여 지도 위에 자동 배치
8. 기준점과 전체 거래처를 한 화면에 맞춤
9. 선택 목록을 Excel로 다시 내보내거나 A4 가로 인쇄

## First-run demo

실제 Excel이 없어도 다음 흐름을 확인할 수 있습니다.

- **샘플 불러오기** → 실제 서울 주소 6건 로드 및 자동 선택
- **샘플 Excel** → 입력 형식 예제 파일 생성
- 검색 / 전체 선택 / 선택 제거
- 클러스터 거리 변경
- 선택 목록 Excel export

지도 표시에는 Kakao Developers에서 발급한 JavaScript 키가 필요합니다. 앱 키는 저장하지 않으며 현재 브라우저 페이지에서만 사용합니다.

## Usability features

- 현재 데이터 수 / 선택 수 / 지도 표시 수 / 실패 수를 상단에서 즉시 확인
- 거래처명뿐 아니라 **주소까지 검색**
- 검색 결과에서 이미 선택된 항목을 시각적으로 구분
- 다건 선택 후 지도 갱신을 debounce해 불필요한 반복 처리 감소
- 지오코딩을 5건 단위 batch로 처리하고 진행률 표시
- 실패 주소를 별도 패널에서 직접 수정하고 개별/전체 재시도
- 기준 주소 제거, 전체 보기, 지도 새로고침 제공
- 브라우저 크기 변경 시 Kakao map relayout + 라벨 재배치
- 화면은 반응형, 인쇄 시에는 A4 landscape 고정
- 클러스터 거리만 localStorage에 저장하고 고객 데이터/API key는 저장하지 않음

## Engineering highlights

- **Excel validation**: 첫 시트의 `거래처명`, `주소` 필수 컬럼을 확인하고 빈 행/완전 중복을 제거합니다.
- **Connected-distance clustering**: 첫 지점만 기준으로 삼지 않고 threshold 안에서 이어지는 전체 연결요소를 하나의 그룹으로 계산합니다.
- **Validated threshold**: 클러스터 거리를 100m~10km 범위로 정규화합니다.
- **In-memory geocoding cache**: 같은 주소를 다시 조회하지 않아 선택/거리 변경 시 API 호출을 줄입니다.
- **Bounded batch geocoding**: 대량 선택을 한 번에 `Promise.all`로 던지지 않고 작은 batch로 나눠 처리합니다.
- **Recoverable failures**: 실패 주소를 단순 카운트로 끝내지 않고 수정→재시도 흐름으로 복구할 수 있습니다.
- **Label collision reduction**: 마커와 기존 라벨 충돌을 검사해 후보 좌표를 탐색합니다.
- **Canvas + DOM rendering**: 연결선은 Canvas, 라벨은 DOM으로 분리해 가독성과 인쇄 품질을 조정합니다.
- **Safer DOM handling**: 고객 데이터는 `textContent`로 렌더링합니다.
- **No embedded credentials**: 실제 Kakao 키를 저장소에 커밋하지 않습니다.
- **Regression CI**: Haversine 거리, threshold 정규화, client identity/search, clustering을 Node test runner로 검증합니다.

## Project structure

```text
.
├── .github/workflows/ci.yml
├── test/geo.test.js
├── index.html
├── styles.css
├── geo.js       # distance / search / identity / clustering pure utilities
├── app.js       # Excel / Kakao Maps / batch geocoding / recovery / print workflow
└── README.md
```

## Excel format

첫 번째 시트에 다음 컬럼이 필요합니다.

| 거래처명 | 주소 |
| --- | --- |
| 샘플 거래처 A | 서울특별시 중구 세종대로 110 |
| 샘플 거래처 B | 서울특별시 종로구 종로 1 |

추가 컬럼은 무시됩니다. 화면의 **샘플 Excel** 버튼으로 동일한 형식의 파일을 바로 만들 수 있습니다.

## Run locally

```bash
python -m http.server 8080
```

브라우저에서 `http://localhost:8080`을 연 뒤 Kakao Developers JavaScript 키를 입력합니다.

테스트:

```bash
node --check geo.js
node --check app.js
node --test
```

## Kakao key security

Kakao Maps JavaScript SDK의 앱 키는 브라우저 클라이언트에서 사용되므로 네트워크 요청에서 확인될 수 있습니다. 서버 비밀키처럼 숨기는 방식이 아니라 **Kakao Developers에서 허용 도메인을 제한**해야 합니다. 이 저장소는 실제 키를 저장하거나 localStorage에 보관하지 않습니다.

## Privacy boundary

- Excel 파일은 서버로 업로드하지 않습니다.
- 거래처명/주소는 브라우저 메모리에서만 관리합니다.
- 지오코딩을 위해 선택된 주소만 Kakao Maps API로 전송됩니다.
- 브라우저 새로고침 시 거래처 작업 데이터와 geocoding cache는 사라집니다.
- localStorage에는 비민감 설정인 클러스터 거리만 저장합니다.

## Current limitations

- Kakao Maps API quota/정책에 따라 매우 큰 데이터셋의 처리량은 제한될 수 있습니다.
- 검색 목록은 브라우저 UI 성능을 위해 최대 200건까지 렌더링합니다.
- geocoding cache는 탭의 메모리에만 유지됩니다.
- 라벨 배치는 휴리스틱 방식이라 극단적으로 조밀한 지점에서는 일부 겹침이 남을 수 있습니다.
- route optimization이나 실제 도로 이동시간 계산은 범위에 포함하지 않습니다. 이 도구의 목적은 **거래처 분포 파악과 인쇄용 지도 생성**입니다.
