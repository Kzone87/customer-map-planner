# Customer Data Workbench · V2.3

![CI](https://github.com/Kzone87/customer-map-planner/actions/workflows/ci.yml/badge.svg)

Excel/CSV 데이터를 **API Key나 서버 업로드 없이 브라우저에서 검증·정리·규칙 검사·검수 리포트·재출력**하는 local-first 업무 자동화 도구입니다.

> 저장소 이름은 기존 Git 이력을 보존하기 위해 `customer-map-planner`를 유지합니다. 핵심 제품은 지도 기능이 아니라 API-free data workflow입니다.

## V2.3 핵심

V2.2의 자동 품질 탐지에 더해 사용자가 실제 업무 규칙을 직접 정의할 수 있습니다.

```text
Excel / CSV
   ↓
Automatic quality profile
   +
User validation rules
   ├─ required
   ├─ email
   ├─ number
   └─ enum allow-list
   ↓
Rule violations
   ↓
Clean / Recipe / Report / Export
```

- XLSX / XLS / CSV import
- 브라우저 메모리 처리
- 빈 값 / 이메일 / 전화번호 / 완전 중복 자동 탐지
- 공백/이메일/전화번호 정규화 + 중복 제거
- Undo / Redo
- 반복 변환 Recipe 저장·재실행
- Validation Report CSV
- 사용자 Rule Builder
- 규칙별 위반 행/컬럼/현재값 표시
- 규칙 localStorage 저장
- 파일 변경 시 존재하는 컬럼과 허용 rule type을 다시 검증
- spreadsheet formula injection을 고려한 safe CSV/XLSX export

## Rule Builder

현재 지원 규칙:

| Rule | 동작 |
| --- | --- |
| `required` | 빈 값 차단 |
| `email` | 값이 있을 때 이메일 형식 검사 |
| `number` | 숫자/쉼표 포함 숫자 형식 검사 |
| `enum` | 쉼표로 지정한 허용값 목록 검사 |

저장된 브라우저 데이터는 신뢰하지 않고, rule type과 현재 파일의 column 존재 여부를 매번 검증합니다.

## Tech stack

- TypeScript
- Vite
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

자동화 테스트는 데이터 품질, normalization, Recipe allow-list, spreadsheet-safe export, validation report와 V2.3 rule engine/sanitization을 검증합니다.

## Client-facing value

- Excel/CSV 업무를 브라우저 내부 도구로 전환
- ERP/CRM import 전 검증
- 회사별 필수값/허용값 규칙 구성
- 반복 정리 Recipe
- 원본 보존과 Undo/Redo
- 오류 검수 리포트 전달
- 서버비용/API Key 없이 배포 가능한 내부 업무도구

## Next

V2.4에서는 서로 다른 고객사 Excel 컬럼을 표준 컬럼으로 바꾸는 **Column Mapping**을 추가합니다.

## Portfolio policy

공개 포트폴리오용 샘플만 사용하며 비공개 사업 프로젝트 코드·데이터·구조는 포함하지 않습니다.
