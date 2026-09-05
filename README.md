# Customer Map Planner

Excel에 관리하던 거래처 목록을 검색해 지도에 표시하고, 가까운 거래처를 자동으로 묶어 A4 가로 지도로 출력하는 브라우저 기반 업무 도구입니다.

**Live Demo:** https://kzone87.github.io/geocoding/

> Repository name is still `geocoding` for history compatibility. The portfolio-facing project name is **Customer Map Planner**.

## Why I built it

현장 방문이나 거래처 관리를 위해 Excel 주소 목록을 지도에 옮길 때 반복적인 주소 검색과 수동 라벨 배치가 필요했습니다. 이 프로젝트는 그 과정을 한 화면에서 처리하기 위해 만들었습니다.

## Core workflow

1. Kakao JavaScript 키 입력
2. 선택적으로 기준 주소 입력
3. `거래처명`, `주소` 컬럼이 있는 Excel 파일 로드
4. 거래처 검색 및 지도 표시 대상 선택
5. 주소를 좌표로 변환
6. 1km 기준으로 근접 거래처 클러스터링
7. 라벨 겹침을 줄여 자동 배치하고 연결선 렌더링
8. A4 가로 레이아웃으로 인쇄

## Engineering highlights

- **Excel validation**: 필수 컬럼을 확인하고 빈 데이터와 완전 중복 데이터를 제외합니다.
- **Geocoding failure handling**: 주소 변환 실패 건수를 사용자에게 표시합니다.
- **Connected-distance clustering**: 특정 기준점 하나만 비교하지 않고, 1km 이내로 연결되는 지점을 탐색해 그룹화합니다.
- **Label collision reduction**: 지도 마커와 기존 라벨의 충돌을 검사하며 라벨 위치를 탐색합니다.
- **Canvas + DOM rendering**: 연결선은 Canvas, 텍스트 라벨은 DOM으로 분리해 인쇄 가독성을 확보했습니다.
- **Safer DOM handling**: 거래처명과 주소를 `innerHTML`로 삽입하지 않고 `textContent` 기반으로 렌더링합니다.
- **No embedded credentials**: Kakao JavaScript 키와 기준 주소는 저장소에 저장하지 않습니다.
- **Regression CI**: Node 내장 테스트 러너로 거리 계산과 클러스터링을 검증하고, GitHub Actions에서 JavaScript 문법 검사와 테스트를 실행합니다.
- **GitHub Pages**: `main` 반영 시 정적 데모를 자동 빌드·배포합니다.

## Project structure

```text
.
├── .github/workflows/ci.yml  # syntax + regression CI
├── test/geo.test.js          # distance / clustering tests
├── index.html                # UI structure
├── styles.css                # screen + A4 print styles
├── geo.js                    # distance and clustering utilities
├── app.js                    # Excel, Kakao Maps, UI and label placement workflow
└── README.md
```

## Excel format

첫 번째 시트에 다음 컬럼이 필요합니다.

| 거래처명 | 주소 |
| --- | --- |
| 샘플 거래처 A | 서울특별시 중구 세종대로 110 |
| 샘플 거래처 B | 서울특별시 종로구 종로 1 |

추가 컬럼은 있어도 무시됩니다.

## Run locally

정적 파일을 HTTP 서버로 제공한 뒤 브라우저에서 접속합니다.

```bash
python -m http.server 8080
```

그 다음 `http://localhost:8080`을 열고 Kakao Developers에서 발급받은 **JavaScript 키**를 입력합니다.

테스트:

```bash
node --test
```

## Kakao key security

Kakao Maps JavaScript SDK의 앱 키는 브라우저에서 사용되는 클라이언트 키이므로 네트워크 요청에서 확인될 수 있습니다. 따라서 비밀값처럼 서버에 숨기는 방식이 아니라, **Kakao Developers에서 허용 도메인을 제한하는 방식**으로 보호해야 합니다. 이 저장소에는 실제 키를 커밋하지 않습니다.

## Current limitations

- 대량 주소를 한 번에 선택하면 Kakao 지오코딩 호출량의 영향을 받을 수 있습니다.
- 클러스터 기준은 현재 1km 고정입니다.
- 라벨 배치는 휴리스틱 탐색 방식이므로 매우 조밀한 지역에서는 완벽한 배치를 보장하지 않습니다.
- Excel 데이터는 브라우저 메모리에서만 처리하며 서버에 저장하지 않습니다.

## Next improvements

- 클러스터 거리 UI 설정
- 지오코딩 결과 캐시
- 실패 주소 재시도/수정 UI
- CSV 지원
