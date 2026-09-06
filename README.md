# Customer Data Workbench · V3

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **API Key나 서버 업로드 없이 브라우저에서 검증·정리·표준화·비교하고, 여러 파일에 동일 workflow를 일괄 적용해 migration 결과까지 만드는 local-first 업무 자동화 도구**입니다.

> 저장소 이름은 기존 Git 이력을 보존하기 위해 `customer-map-planner`를 유지합니다. 현재 제품의 중심은 지도 기능이 아니라 브라우저 기반 data workflow입니다.

## V3 핵심

V2.5의 단일 파일 정리·Column Mapping·Data Compare를 유지하면서, V3에서는 **Workflow Preset + Multi-file Batch + Migration Mode**를 추가했습니다.

```text
Column Mapping
      +
Cleaning Operations
      +
Validation Rules
      +
Target Schema
      ↓
 Workflow Preset
      ↓
A.xlsx  B.csv  C.xlsx  D.csv
        ↓
 파일별 독립 Batch 처리
        ↓
SUCCESS / VALIDATION_FAILED / ERROR
        ↓
Migration Report CSV
        +
정상 결과 Combined XLSX
```

한 파일의 파싱·구조·검증 오류가 다른 파일의 처리를 중단시키지 않습니다. 각 파일은 독립 결과로 남고, 성공한 데이터만 선택적으로 통합 산출물에 포함합니다.

## 4개의 production workspace

### 1. Main Data Workbench · `/`

- XLSX / XLS / CSV import
- 모든 데이터 브라우저 메모리 처리
- 빈 값 / 이메일 / 전화번호 / 완전 중복 자동 탐지
- 공백 / 이메일 / 전화번호 정규화
- 완전 중복 제거
- Undo / Redo
- 반복 변환 Recipe 저장·재실행
- Validation Report CSV
- 사용자 Rule Builder
- `required / email / number / enum` validation rules
- rule localStorage 저장 및 재검증
- spreadsheet formula injection을 고려한 safe CSV/XLSX export

### 2. Column Mapping · `/mapping.html`

- 원본 컬럼 → 표준 컬럼 매핑
- 동일 source/target 충돌 차단
- untouched column 이름 충돌 차단
- 양방향 컬럼 swap 지원
- 적용 전 구조 검증
- 결과 미리보기
- CSV / XLSX export

예:

```text
거래처명 → company
이메일   → email
연락처   → phone
```

### 3. Data Compare · `/compare.html`

- 이전/현재 XLSX, XLS, CSV 두 파일 비교
- 공통 Key 컬럼 기준 diff
- `ADDED / REMOVED / CHANGED / UNCHANGED`
- 변경 컬럼과 before/after 값 표시
- 빈 Key / 중복 Key 차단
- Key column 불일치 차단
- spreadsheet-safe 변경 Report CSV/XLSX

### 4. Batch Migration · `/batch.html`

- 여러 XLSX / XLS / CSV 파일 동시 선택
- 동일 Workflow Preset을 파일마다 반복 적용
- 파일별 처리 진행률 표시
- 파일별 `SUCCESS / VALIDATION_FAILED / ERROR` 격리
- Migration Report CSV
- 성공 결과 Combined XLSX
- Preset JSON Export / Import
- Target Schema projection

## Workflow Preset

V3의 Preset은 단순 버튼 매크로가 아니라 데이터 이관 계약입니다.

```ts
{
  version: 1,
  name: "ERP customer migration",
  mappings: [
    { source: "거래처명", target: "company" },
    { source: "이메일", target: "email" }
  ],
  operations: ["trim", "normalize-email", "dedupe"],
  rules: [
    { column: "company", kind: "required" },
    { column: "email", kind: "email" }
  ],
  targetColumns: ["company", "email", "phone", "status"]
}
```

실행 순서는 다음과 같습니다.

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

## Preset 안전성

외부 JSON Preset을 그대로 실행하지 않습니다.

- 지원 operation allow-list 재검증
- validation rule 구조 재검증
- mapping source/target 검증
- 존재하지 않는 rule column 차단
- target schema 비어 있음 차단
- target column 정규화·중복 제거·개수 제한
- invalid preset은 파일 작업 전에 명시적 오류 처리

즉 임의 JSON이 내부 workflow 동작을 확장하거나 예상하지 않은 operation을 실행할 수 없도록 경계를 둡니다.

## Batch failure isolation

Batch는 전체 성공/전체 실패 방식이 아닙니다.

```text
A.xlsx → SUCCESS
B.xlsx → VALIDATION_FAILED
C.csv  → ERROR
D.xlsx → SUCCESS
```

B/C 때문에 A/D 결과를 잃지 않습니다. 이 방식은 월별 거래처 파일, 공급사별 가격표, 여러 지점의 Excel 취합, ERP/CRM migration처럼 입력 품질이 일정하지 않은 실제 외주 상황을 겨냥합니다.

## Local-first / data boundary

- 핵심 기능에 backend 없음
- 외부 API Key 없음
- 파일 서버 업로드 없음
- 브라우저 File API + 메모리 처리
- Recipe/Rule 등 재사용 설정만 localStorage 활용
- 내보내기 직전 spreadsheet formula injection 완화

민감한 고객/거래처 데이터를 별도 SaaS 서버로 보내지 않고도 작업 흐름을 시연할 수 있습니다.

## Tech stack

- TypeScript
- Vite multi-page build
- SheetJS
- Browser File API
- localStorage
- Vitest
- GitHub Actions
- GitHub Pages compatible static deployment

## Run / verification

```bash
npm install
npm test
npm run build
npm run dev
```

개발 서버:

- `/` — Main Data Workbench
- `/mapping.html` — Column Mapping
- `/compare.html` — Data Compare
- `/batch.html` — Batch Migration

CI는 quality/mapping/rule/report/compare/workflow 엔진의 Vitest와 TypeScript type-check, Vite production multi-page build를 수행합니다.

## Client-facing use cases

- 고객사별 Excel/CSV 반복 정리 자동화
- ERP/CRM import 전 품질 검증
- 구시스템 → 신시스템 컬럼 변환
- 업체별 서로 다른 컬럼명을 내부 표준 스키마로 통합
- 회사별 필수값·형식·허용값 규칙 적용
- 전월/이번달 데이터 변경 비교
- 여러 지점·협력사 파일 동일 규칙 일괄 처리
- migration 오류 파일만 재작업
- 검수 Report와 정상 데이터 산출물을 분리 납품

## Portfolio boundary

이 공개 프로젝트는 가상의 샘플 데이터와 독립 구현만 사용합니다. 비공개 사업 프로젝트의 코드·데이터·스키마를 가져오지 않습니다.

## V3 portfolio message

V3가 보여주려는 것은 단순 Excel 편집기가 아닙니다.

> “고객이 반복해서 받는 서로 다른 Excel/CSV를 표준화하고, 검증하고, 여러 파일에 같은 규칙을 적용해 이관 가능한 결과물과 오류 리포트로 나누는 업무 자동화 시스템을 만들 수 있습니다.”
