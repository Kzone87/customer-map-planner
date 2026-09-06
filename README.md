# Excel 정리 작업실 · Customer Data Workbench V3

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **서버 업로드 없이 브라우저에서 검증·정리·표준화·비교하고, 여러 파일에 같은 작업 규칙을 적용해 결과물과 오류 리포트로 나누는 local-first 데이터 업무 도구**입니다.

**Live:** https://kzone87.github.io/customer-map-planner/

> 저장소 이름 `customer-map-planner`는 기존 Git 이력을 보존하기 위해 유지합니다. 현재 공개 제품의 중심은 지도 기능이 아니라 Excel/CSV data workflow입니다.

## 4개의 작업 화면

### 1. 한 파일 정리 · `/`
- XLSX / XLS / CSV import
- 빈 값 / 이메일 / 전화번호 / 완전 중복 탐지
- 공백 / 이메일 / 전화번호 정규화
- 중복 행 제거
- Undo / Redo
- 작업순서 저장·재실행
- 사용자 Validation Rule Builder
- CSV / XLSX export

### 2. 항목 이름 맞추기 · `/mapping.html`
- 원본 컬럼 → 표준 컬럼 매핑
- source/target 충돌 차단
- 양방향 컬럼 swap
- 적용 전 구조 검증
- 결과 미리보기
- CSV / XLSX export

### 3. 두 파일 비교 · `/compare.html`
- 이전/현재 XLSX, XLS, CSV 비교
- 공통 Key 기준 diff
- ADDED / REMOVED / CHANGED / UNCHANGED
- 변경 컬럼과 before/after 값 표시
- 빈 Key / 중복 Key 차단
- 결과 CSV / XLSX export

### 4. 여러 파일 정리 · `/batch.html`
- 여러 파일 동시 선택
- 같은 정리 규칙 반복 적용
- 파일별 처리 진행률
- SUCCESS / VALIDATION_FAILED / ERROR 격리
- 정상 결과 Combined XLSX
- 처리 결과 CSV

## Workflow 계약

```text
Input rows
   ↓
Column Mapping
   ↓
Cleaning Operations
   ↓
Validation Rules
   ↓
Target Schema Projection
   ↓
Spreadsheet-safe Output
```

한 파일의 오류가 다른 파일의 처리를 중단시키지 않습니다.

```text
A.xlsx → SUCCESS
B.xlsx → VALIDATION_FAILED
C.csv  → ERROR
D.xlsx → SUCCESS
```

이 구조는 월별 거래처 파일, 공급사 가격표, 여러 지점의 Excel 취합, ERP/CRM import 전 데이터 검수처럼 입력 품질이 일정하지 않은 실제 업무를 겨냥합니다.

## Local-first data boundary

- 핵심 기능에 backend 없음
- 외부 API Key 없음
- 파일 서버 업로드 없음
- Browser File API + 메모리 처리
- 재사용 설정만 localStorage 사용
- spreadsheet formula injection을 고려한 export

민감한 거래처·고객 데이터를 별도 SaaS 서버에 올리지 않고도 작업할 수 있는 방향으로 설계했습니다.

## Tech stack

- TypeScript
- Vite multi-page build
- SheetJS
- Browser File API
- localStorage
- Vitest
- GitHub Actions
- GitHub Pages

## Verification

```bash
npm install
npm test
npm run build
npm run dev
```

CI에서는 데이터 처리, mapping, validation rule, report, compare, workflow, UI quality 테스트와 strict TypeScript type-check, Vite production build를 실행합니다.

## Client-facing use cases

- 고객사별 Excel/CSV 반복 정리 자동화
- ERP/CRM import 전 품질 검증
- 업체별 다른 컬럼명을 내부 표준으로 변환
- 전월/이번달 데이터 변경 비교
- 여러 지점·협력사 파일 동일 규칙 일괄 처리
- 오류 파일만 분리해 재작업
- 검수 Report와 정상 산출물을 분리

## Portfolio boundary

이 공개 프로젝트는 포트폴리오용 예제 데이터와 독립 구현만 사용합니다. 비공개 고객 데이터·사업 코드·스키마를 가져오지 않습니다.
