type PortableRecipe = { name: string; operations: string[] };
type PortableRule = { id: string; column: string; kind: string; parameter?: string };
export type SettingsBundle = {
  format: 'customer-data-workbench-settings';
  version: 1;
  exportedAt: string;
  recipes: PortableRecipe[];
  rules: PortableRule[];
};

const RECIPE_KEY = 'customer-data-workbench-recipes-v1';
const RULE_KEY = 'customer-data-workbench-rules-v1';
const SUPPORTED_OPERATIONS = new Set(['trim', 'email', 'phone', 'dedupe']);
const SUPPORTED_RULES = new Set(['required', 'email', 'number', 'enum']);
const MAX_SETTINGS_BYTES = 256 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonStorage(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function sanitizeRecipes(value: unknown): PortableRecipe[] {
  if (!Array.isArray(value) || value.length > 50) throw new Error('작업순서는 최대 50개까지 가져올 수 있습니다.');
  return value.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`${index + 1}번째 작업순서 형식이 올바르지 않습니다.`);
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const operations = Array.isArray(candidate.operations) ? candidate.operations : [];
    if (!name || name.length > 40) throw new Error(`${index + 1}번째 작업순서 이름을 확인해 주세요.`);
    if (!operations.length || operations.length > 20 || operations.some((item) => typeof item !== 'string' || !SUPPORTED_OPERATIONS.has(item))) {
      throw new Error(`${name} 작업순서에 지원하지 않는 정리 단계가 있습니다.`);
    }
    return { name, operations: operations as string[] };
  });
}

function sanitizeRules(value: unknown): PortableRule[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error('검사 기준은 최대 100개까지 가져올 수 있습니다.');
  return value.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`${index + 1}번째 검사 기준 형식이 올바르지 않습니다.`);
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const column = typeof candidate.column === 'string' ? candidate.column.trim() : '';
    const kind = typeof candidate.kind === 'string' ? candidate.kind : '';
    const parameter = typeof candidate.parameter === 'string' ? candidate.parameter.trim() : undefined;
    if (!id || id.length > 120 || !column || column.length > 120 || !SUPPORTED_RULES.has(kind)) {
      throw new Error(`${index + 1}번째 검사 기준을 확인해 주세요.`);
    }
    if (parameter && parameter.length > 500) throw new Error(`${column} 검사 기준 값이 너무 깁니다.`);
    if (kind === 'enum' && !parameter) throw new Error(`${column} 지정값 검사에는 허용값이 필요합니다.`);
    return { id, column, kind, ...(parameter ? { parameter } : {}) };
  });
}

export function validateSettingsBundle(value: unknown): SettingsBundle {
  if (!isRecord(value) || value.format !== 'customer-data-workbench-settings' || value.version !== 1) {
    throw new Error('Excel 정리 작업실에서 만든 설정 파일이 아니거나 지원하지 않는 버전입니다.');
  }
  return {
    format: 'customer-data-workbench-settings',
    version: 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : new Date(0).toISOString(),
    recipes: sanitizeRecipes(value.recipes),
    rules: sanitizeRules(value.rules)
  };
}

export function buildSettingsBundle(): SettingsBundle {
  return {
    format: 'customer-data-workbench-settings',
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: sanitizeRecipes(safeJsonStorage(RECIPE_KEY)),
    rules: sanitizeRules(safeJsonStorage(RULE_KEY))
  };
}

function downloadSettings(bundle: SettingsBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `excel-workbench-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setMainStatus(message: string, error = false) {
  const status = document.getElementById('status');
  if (!status) return;
  status.textContent = message;
  status.dataset.kind = error ? 'error' : 'success';
}

async function importSettings(file: File) {
  if (file.size <= 0 || file.size > MAX_SETTINGS_BYTES) throw new Error('설정 파일은 256KB 이하의 JSON 파일만 사용할 수 있습니다.');
  if (!file.name.toLowerCase().endsWith('.json')) throw new Error('JSON 설정 파일만 가져올 수 있습니다.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('설정 파일의 JSON 형식을 읽지 못했습니다.');
  }
  const bundle = validateSettingsBundle(parsed);
  localStorage.setItem(RECIPE_KEY, JSON.stringify(bundle.recipes));
  localStorage.setItem(RULE_KEY, JSON.stringify(bundle.rules));
}

function mountSettingsPortability() {
  const recipeSelect = document.getElementById('recipeSelect');
  if (!recipeSelect || document.getElementById('settingsPortability')) return;
  const inspectorBody = recipeSelect.closest('.inspector-body');
  if (!inspectorBody) return;

  const section = document.createElement('div');
  section.id = 'settingsPortability';
  section.className = 'recipe-row';
  section.setAttribute('aria-label', '작업 설정 백업과 복원');

  const description = document.createElement('p');
  description.textContent = '작업순서와 검사 기준만 JSON으로 백업합니다. Excel·CSV 데이터는 포함하지 않습니다.';

  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.id = 'exportSettingsButton';
  exportButton.textContent = '설정 내보내기';

  const importLabel = document.createElement('label');
  importLabel.className = 'file-picker';
  const importText = document.createElement('span');
  importText.textContent = '설정 가져오기';
  const importInput = document.createElement('input');
  importInput.id = 'importSettingsInput';
  importInput.type = 'file';
  importInput.accept = '.json,application/json';
  importLabel.append(importText, importInput);

  const clearButton = document.createElement('button');
  clearButton.type = 'button';
  clearButton.id = 'clearSettingsButton';
  clearButton.textContent = '저장 설정 초기화';

  exportButton.addEventListener('click', () => {
    try {
      downloadSettings(buildSettingsBundle());
      setMainStatus('작업순서와 검사 기준 설정을 JSON으로 저장했습니다.');
    } catch (error) {
      setMainStatus(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.', true);
    }
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      await importSettings(file);
      setMainStatus('설정을 가져왔습니다. 화면을 새로 불러옵니다.');
      window.setTimeout(() => location.reload(), 250);
    } catch (error) {
      setMainStatus(error instanceof Error ? error.message : '설정을 가져오지 못했습니다.', true);
      importInput.value = '';
    }
  });

  clearButton.addEventListener('click', () => {
    if (!window.confirm('현재 브라우저에 저장된 작업순서와 검사 기준을 모두 지울까요? Excel·CSV 원본 데이터에는 영향이 없습니다.')) return;
    localStorage.removeItem(RECIPE_KEY);
    localStorage.removeItem(RULE_KEY);
    setMainStatus('저장된 작업순서와 검사 기준을 초기화했습니다. 화면을 새로 불러옵니다.');
    window.setTimeout(() => location.reload(), 250);
  });

  section.append(description, exportButton, importLabel, clearButton);
  inspectorBody.appendChild(section);
}

if (typeof document !== 'undefined') mountSettingsPortability();
