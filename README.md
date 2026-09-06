# Customer Data Workbench · V2.5

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **API Key나 서버 업로드 없이 브라우저에서 검증·정리·규칙 검사·컬럼 표준화·파일 간 변경 비교·재출력**하는 local-first 업무 자동화 도구입니다.

> 저장소 이름은 기존 Git 이력을 보존하기 위해 `customer-map-planner`를 유지합니다. 핵심 제품은 지도 기능이 아니라 API-free data workflow입니다.

## V2.5 핵심

V2.4 Column Mapping에 이어 두 시점의 Excel/CSV 데이터를 Key 기준으로 비교하는 **Data Compare Workspace**를 추가했습니다.

```text
이전 파일                현재 파일
2026-08.xlsx             2026-09.xlsx
        \                  /
         \                /
          Key column 선택
                ↓
        ADDED / REMOVED
       CHANGED / UNCHANGED
                ↓
       변경 컬럼 상세 확인
                ↓
        CSV / XLSX report
```

### Main Data Workbench

- XLSX / XLS / CSV import
- 브라우저 메모리 처리
- 빈 값 / 이메일 / 전화번호 / 완전 중복 자동 탐지
- 공백 / 이메일 / 전화번호 정규화
- 중복 제거
- Undo / Redo
- 반복 변환 Recipe 저장·재실행
- Validation Report CSV
- 사용자 Rule Builder
- `required / email / number / enum` validation rules
- rule localStorage 저장 및 재검증
- spreadsheet formula injection을 고려한 safe CSV/XLSX export

### Column Mapping Workspace

- XLSX / XLS / CSV 입력
- 원본 컬럼 → 표준 컬럼 매핑 규칙 구성
- 동일 source/target 충돌 차단
- 기존 untouched column 이름 충돌 차단
- 양방향 컬럼 swap 지원
- 적용 전 매핑 검증
- 결과 미리보기
- CSV / XLSX export
- 별도 `mapping.html` production entry

### Data Compare Workspace

- 이전/현재 XLSX, XLS, CSV 두 파일 입력
- 공통 Key 컬럼 기준 비교
- `ADDED / REMOVED / CHANGED / UNCHANGED` 분류
- 변경된 컬럼과 이전/현재 값 상세 표시
- 빈 Key 차단
- 중복 Key 차단
- 한쪽 파일에 Key 컬럼이 없으면 비교 차단
- spreadsheet-safe 변경 Report CSV/XLSX export
- 별도 `compare.html` production entry

메인 Workbench에서 **Column Mapping Workspace**와 **Data Compare Workspace**로 바로 이동할 수 있습니다.

## Why this matters

실제 Excel 자동화 외주는 단순 정리뿐 아니라 **전월 대비 변경, ERP 업로드 전 검증, 고객 DB 변경 확인, 가격표/재고 변경 확인** 같은 비교 업무가 반복됩니다. V2.5는 이 과정을 서버 업로드 없이 브라우저 안에서 재현합니다.

## Tech stack

- TypeScript
- Vite multi-page build
- SheetJS
- Browser File API
- localStorage
- Vitest
- GitHub Actions / GitHub Pages

## Run / verification

```bash
npm install
npm test
npm run build
npm run dev
```

개발 서버:

- `/` — Customer Data Workbench
- `/mapping.html` — Column Mapping Workspace
- `/compare.html` — Data Compare Workspace

CI는 data/mapping/rule/report/compare 엔진의 Vitest 전체 테스트와 TypeScript type-check, Vite production multi-page build를 수행합니다.

## Client-facing value

- Excel/CSV 반복 업무 브라우저 자동화
- ERP/CRM import 전 품질 검증
- 고객사별 컬럼명을 내부 표준 스키마로 변환
- 회사별 필수값·형식·허용값 규칙 적용
- 전월/이번달, 구시스템/신시스템 데이터 변경 비교
- 변경 내역을 검수용 CSV/XLSX로 납품
- 민감 데이터의 서버 업로드를 피하는 local-first workflow

## Next major version

V3에서는 Multi-file Batch, Workflow Preset, Migration Mode를 결합해 반복 데이터 업무를 하나의 재사용 가능한 workflow로 확장합니다.
