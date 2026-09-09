# Excel 정리 작업실 · Customer Data Workbench V3.1

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **서버 업로드 없이 브라우저에서 검증·정리·표준화·비교하고, 여러 파일에 같은 작업 규칙을 적용해 결과물과 오류 리포트로 나누는 local-first 데이터 업무 도구**입니다.

**Live:** https://kzone87.github.io/customer-map-planner/

> 저장소 이름 `customer-map-planner`는 기존 Git 이력을 보존하기 위해 유지합니다. 현재 공개 제품의 중심은 지도 기능이 아니라 Excel/CSV data workflow입니다.

## 4개의 작업 화면

### 1. 한 파일 정리 · `/`
- XLSX / XLS / CSV import
- 여러 데이터 시트가 있으면 처리할 시트 명시적 선택
- 빈 값 / 이메일 / 전화번호 / 완전 중복 탐지
- 공백 / 이메일 / 전화번호 정규화
- 중복 행 제거
- Undo / Redo
- 작업순서 저장·재실행
- 사용자 Validation Rule Builder
- 작업순서 + 검사 기준 JSON 백업/복원
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

## Workbook import safety

사용자 파일은 신뢰하지 않는 입력으로 취급합니다.

- 허용 형식: `.xlsx`, `.xls`, `.csv`
- 파일당 최대 20 MB
- 데이터 시트 최대 50개
- 선택 시트당 최대 100,000행
- 최대 300개 항목
- 최대 5,000,000 셀
- 다중 시트 통합문서는 첫 시트를 임의로 사용하지 않고 사용자가 직접 선택
- 공백 정규화 후 같은 머리글이 중복되면 임의 변경하지 않고 차단
- 손상/비정상 파일은 사용자 오류 상태로 처리

CSV는 UTF-8을 권장합니다.

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
- 파일 행 데이터는 localStorage에 저장하지 않음
- 재사용 설정만 localStorage 사용
- 작업순서와 검사 기준은 versioned JSON으로 백업/복원 가능
- settings JSON에는 Excel/CSV 데이터 행이 포함되지 않음
- spreadsheet formula injection을 고려한 export

민감한 거래처·고객 데이터를 별도 SaaS 서버에 올리지 않고도 작업할 수 있는 방향으로 설계했습니다.

## Output boundary

Excel Workbench는 **표 데이터 업무도구**이며 원본 Excel 서식을 그대로 보존하는 편집기가 아닙니다.

정리 결과는 새 CSV/XLSX 파일로 생성됩니다. 원본의 셀 스타일, 차트, 이미지, 매크로, 주석, 병합 레이아웃 등 workbook presentation을 보존하는 것은 제품 계약 범위가 아닙니다.

## Tech stack

- TypeScript
- Vite multi-page build
- SheetJS CE 0.20.3 official distribution
- Browser File API
- localStorage
- Vitest
- GitHub Actions
- GitHub Pages

## Verification

```bash
npm install
npm run audit
npm test
npm run build
```

CI에서는 dependency audit, 데이터 처리, import guardrail, mapping, validation rule, settings portability, report, compare, workflow, UI quality 테스트와 strict TypeScript type-check, Vite production build를 실행합니다.

별도 `Excel Workbench live QA`는 실제 Chrome에서 다음을 검증합니다.

- 4개 화면 × 1440 / 768 / 390
- console / page / request / HTTP 오류
- horizontal overflow
- 실제 CSV upload → 정리 → XLSX download
- 실제 multi-sheet XLSX upload → 시트 선택
- 실제 legacy XLS 한글 데이터 import
- mapping / compare / batch download
- settings JSON export → clear → import → restore
- main 배포에서는 same-SHA GitHub Pages 완료 후 실제 production URL 재검증

## Delivery

실제 정적 배포와 Acceptance 기준은 [`DELIVERY_RUNBOOK.md`](./DELIVERY_RUNBOOK.md), 보안 경계는 [`SECURITY.md`](./SECURITY.md)를 따릅니다.

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
