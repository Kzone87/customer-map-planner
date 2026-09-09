import './settings-portability';

const replacements: Array<[RegExp, string]> = [
  [/샘플/g, '예제'],
  [/바로 체험/g, '바로 확인'],
  [/체험/g, '확인']
];

function polishText(value: string): string {
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

const watchedIds = [
  'status',
  'sourceName',
  'mappingSource',
  'mappingStatus',
  'before-meta',
  'after-meta',
  'status-message',
  'batchStatus'
];

function polishElement(element: HTMLElement | null) {
  if (!element || !element.textContent) return;
  const next = polishText(element.textContent);
  if (next !== element.textContent) element.textContent = next;
}

for (const id of watchedIds) {
  const element = document.getElementById(id);
  if (!element) continue;
  polishElement(element);
  const observer = new MutationObserver(() => polishElement(element));
  observer.observe(element, { childList: true, characterData: true, subtree: true });
}

const confirmations: Record<string, string> = {
  resetButton: '처음 불러온 파일 상태로 되돌릴까요? 현재 적용한 정리 작업은 취소됩니다.',
  mappingReset: '항목 이름 변경을 원본 상태로 되돌릴까요?'
};

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const button = target.closest('button');
  if (!(button instanceof HTMLButtonElement)) return;
  const message = confirmations[button.id];
  if (!message || window.confirm(message)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, { capture: true });
