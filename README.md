# Customer Data Workbench

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV로 관리하던 고객·거래처 데이터를 **서버 업로드나 API Key 없이 브라우저에서 검증, 정리, 중복 제거, 반복 변환하고 다시 내보내는 업무 자동화 도구**입니다.

> 저장소 이름은 기존 Git 이력을 보존하기 위해 `customer-map-planner`를 유지하지만, V2부터 핵심 제품은 지도 도구가 아니라 **local-first customer data workflow**입니다.

## Why this exists

실무의 Excel 데이터는 단순히 파일을 읽는 것으로 끝나지 않습니다.

- 공백과 대소문자가 섞인 값
- 전화번호 형식 불일치
- 잘못된 이메일
- 완전 중복 행
- 매달 반복되는 동일한 정리 작업
- 정리 후 다시 Excel로 전달해야 하는 흐름

이 프로젝트는 그런 반복 업무를 별도 서버 구축 없이 처리하는 공개 포트폴리오 사례입니다.

## Key features

- XLSX / XLS / CSV import
- 모든 데이터는 브라우저 메모리에서 처리
- 데이터 행·컬럼·품질 문제 자동 프로파일링
- 빈 값 / 이메일 / 전화번호 / 완전 중복 탐지
- 전체 컬럼 통합 검색
- 공백 정규화
- 이메일 소문자 정규화
- 한국 전화번호 형식 정리
- 완전 중복 행 제거
- Undo / Redo / 원본 복원
- 반복 작업 순서를 Recipe로 `localStorage`에 저장하고 재실행
- CSV / XLSX export
- 50행 단위 미리보기 pagination

## No API key / no backend

핵심 기능에는 외부 API, 지도 API, 로그인, 서버 DB가 필요하지 않습니다.

```text
Excel / CSV
    ↓
Browser
    ├─ Parse
    ├─ Profile
    ├─ Validate
    ├─ Search
    ├─ Transform
    ├─ Undo / Redo
    ├─ Recipe
    └─ Export
```

업로드한 파일은 애플리케이션 서버로 전송하지 않습니다. 공개 데모에서도 실제 업무 데이터 대신 샘플 데이터를 사용하는 것을 권장합니다.

## Tech stack

- TypeScript
- Vite
- SheetJS (`xlsx`)
- Browser File API
- localStorage
- Vitest
- GitHub Actions
- GitHub Pages compatible build

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm run dev
```

Production verification:

```bash
npm test
npm run build
```

## Test coverage

현재 자동화 테스트는 다음 핵심 규칙을 검증합니다.

- 품질 프로파일이 중복/잘못된 이메일/빈 값을 탐지하는지
- 완전 중복 제거가 결정적으로 동작하는지
- 공백 정규화가 문자열만 변경하는지
- 이메일 컬럼 정규화
- 대표적인 국내 전화번호 형식 변환

## Client-facing value

이 프로젝트가 증명하는 외주 범위:

- 기존 Excel 업무를 브라우저 업무 도구로 전환
- 외부 서버 없이 동작하는 저비용 내부 도구 설계
- 입력 데이터 품질 검사와 정규화
- 반복 업무 자동화 Recipe
- 원본 보존과 Undo/Redo를 고려한 안전한 데이터 변환
- 결과 파일 재생성 및 인수인계 가능한 테스트/CI

### 확장 가능한 외주 유형

- 거래처/고객 명단 정리
- ERP/CRM 업로드 전 데이터 검증
- 상품/재고/주문 데이터 정규화
- Excel 병합·변환·중복 제거 도구
- 관리자 시스템용 import 전처리기
- 데이터 migration 사전 점검 도구

## Architecture

```text
src/main.ts
  ├─ 화면 상태
  ├─ History / Recipe
  └─ UI rendering
       ↓
src/data.ts
  ├─ File parsing
  ├─ Data profiling
  ├─ Validation
  ├─ Transformation
  └─ Export
```

지도 기능을 중심으로 했던 초기 버전은 외부 지도 API 의존성과 사용 진입장벽이 있었습니다. V2에서는 공개 포트폴리오의 목적을 다시 정의하고, 더 넓은 기업 업무에 재사용할 수 있도록 **API-free data workbench**로 전환했습니다.

## Portfolio policy

이 저장소는 공개 포트폴리오 전용 프로젝트이며 실제 고객사 데이터, 비공개 프로젝트 코드 또는 사업 진행 중인 내부 정보를 포함하지 않습니다.
