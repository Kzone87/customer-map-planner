# Customer Data Workbench · V2.4

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **API Key나 서버 업로드 없이 브라우저에서 검증·정리·규칙 검사·컬럼 표준화·재출력**하는 local-first 업무 자동화 도구입니다.

> 저장소 이름은 기존 Git 이력을 보존하기 위해 `customer-map-planner`를 유지합니다. 핵심 제품은 지도 기능이 아니라 API-free data workflow입니다.

## V2.4 핵심

V2.3 Rule Builder에 이어, 서로 다른 고객사·부서·시스템의 Excel 컬럼을 하나의 표준 스키마로 바꾸는 **Column Mapping Workspace**를 추가했습니다.

```text
업체 A: 거래처명 / 담당 / 연락처
업체 B: 회사명   / 담당자 / 전화
업체 C: customer / owner / phone
                 ↓
        Column Mapping Workspace
                 ↓
      company / contact / phone
                 ↓
        CSV / XLSX safe export
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
- 동일 source 중복 매핑 차단
- 동일 target 충돌 차단
- 기존 untouched column과의 이름 충돌 차단
- 양방향 컬럼 swap 지원
- 적용 전 매핑 검증
- 최대 50행 결과 미리보기
- 원본 복원
- CSV / XLSX export
- 별도 `mapping.html` production entry

메인 Workbench 상단의 **Column Mapping Workspace** 버튼으로 이동할 수 있습니다.

## Why this matters

실제 Excel 자동화 외주는 파일마다 컬럼명이 다르기 때문에 단순 import만으로 끝나지 않습니다. V2.4는 입력 파일의 구조가 달라도 사용자가 매핑 규칙을 정의해 **표준 내부 데이터 구조로 정규화한 뒤 검증·가공 단계로 넘길 수 있는 기반**을 보여줍니다.

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

CI는 mapping engine 테스트를 포함한 Vitest 전체 테스트와 TypeScript type-check, Vite production build를 수행합니다.

## Client-facing value

- Excel/CSV 반복 업무 브라우저 자동화
- ERP/CRM import 전 품질 검증
- 고객사별 컬럼명을 내부 표준 스키마로 변환
- 회사별 필수값·형식·허용값 규칙 적용
- 민감 데이터의 서버 업로드를 피하는 local-first workflow
- 검수 결과와 정리 결과를 CSV/XLSX로 납품

## Roadmap

- Mapping preset 저장/불러오기
- Mapping + Rule + Recipe를 하나의 workflow preset으로 결합
- 표준 스키마 template import/export
- 대용량 파일 chunk 처리
