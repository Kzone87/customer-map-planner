import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const load = (path: string) => readFile(new URL(path, root), 'utf8');
const pages = ['index.html', 'mapping.html', 'compare.html', 'batch.html'];

describe('paid-delivery product presentation', () => {
  it('keeps all four workspaces on the shared product-polish layer', async () => {
    for (const page of pages) {
      const html = await load(page);
      expect(html).toContain('/src/product-polish.ts');
      expect(html).not.toMatch(/체험/);
    }
  });

  it('uses example-data wording instead of demo wording', async () => {
    expect(await load('index.html')).toContain('예제 파일');
    expect(await load('mapping.html')).toContain('예제 파일 불러오기');
    expect(await load('compare.html')).toContain('예제 두 파일 비교');
    expect(await load('batch.html')).toContain('예제 3개 불러오기');
  });

  it('protects destructive restore actions with explicit confirmation', async () => {
    const polish = await load('src/product-polish.ts');
    expect(polish).toContain('window.confirm');
    expect(polish).toContain('resetButton');
    expect(polish).toContain('mappingReset');
    expect(polish).toContain('현재 적용한 정리 작업은 취소됩니다');
  });

  it('keeps Vite dist as the final Pages deployment', async () => {
    const workflow = await load('.github/workflows/deploy-pages.yml');
    expect(workflow).toContain('Wait for branch-based Pages build');
    expect(workflow).toContain('needs: [build, wait-for-branch-pages]');
    expect(workflow).toContain('Deploy Vite dist to GitHub Pages');
    expect(workflow).toContain('path: dist');
  });
});
