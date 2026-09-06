import { describe, expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const pages = [
  { path: 'index.html', sample: 'id="sampleButton"', script: '/src/main.ts' },
  { path: 'mapping.html', sample: 'id="mappingSample"', script: '/src/mapping-main.ts' },
  { path: 'compare.html', sample: 'id="compare-sample"', script: '/src/compare-main.ts' },
  { path: 'batch.html', sample: 'id="sampleBatch"', script: '/src/batch-main.ts' }
];

describe('customer-facing workbench quality', () => {
  test('all four workspaces share navigation and can be tried without a user file', async () => {
    for (const page of pages) {
      const html = await load(page.path);
      expect(html).toContain('href="./"');
      expect(html).toContain('href="./mapping.html"');
      expect(html).toContain('href="./compare.html"');
      expect(html).toContain('href="./batch.html"');
      expect(html).toContain(page.sample);
      expect(html).toContain(page.script);
      expect(html).not.toMatch(/<textarea[^>]*json|JSON\s*(입력|규칙|설정)/i);
    }
  });

  test('shared stylesheet is a foundation rather than the retired card-heavy layout', async () => {
    const css = await load('src/product-ui.css');
    expect(css).not.toContain('.workbench-sidebar');
    expect(css).not.toContain('.quality-grid');
    expect(css).not.toMatch(/font-size:(?:8|9|9\.5|10)px/);
    expect(css).toContain('body .excel-app .data-grid-wrap td{font-size:13px!important}');
    expect(css).toContain('body .mapping-shell .mapping-table td{font-size:13px!important}');
    expect(css).toContain('body .compare-shell .diff-table td{font-size:13px!important}');
    expect(css).toContain('body .batch-shell .batch-result-table td{font-size:13px!important}');
  });

  test('page-specific styles keep the data surfaces large and scrollable', async () => {
    const mainCss = await load('src/styles.css');
    const mappingCss = await load('src/mapping.css');
    const compareCss = await load('src/compare.css');
    const batchCss = await load('src/batch.css');
    expect(mainCss).toMatch(/\.data-grid-wrap\.table-wrap\{[^}]*overflow:auto/);
    expect(mainCss).toMatch(/\.data-grid-wrap th,\.data-grid-wrap td\{[^}]*font-size:12px/);
    expect(mappingCss).toMatch(/\.mapping-table\{[^}]*overflow:auto/);
    expect(mappingCss).toMatch(/\.mapping-table th,\.mapping-table td\{[^}]*font-size:12px/);
    expect(compareCss).toMatch(/\.diff-table\.table-wrap\{[^}]*overflow:auto/);
    expect(compareCss).toMatch(/\.diff-table th,\.diff-table td\{[^}]*font-size:12px/);
    expect(batchCss).toMatch(/\.batch-result-table \.table-wrap\{[^}]*overflow:auto/);
    expect(batchCss).toMatch(/\.batch-result-table th,\.batch-result-table td\{[^}]*font-size:12px/);
  });

  test('Pages deployment always builds Vite dist and places it after the branch Pages run', async () => {
    const workflow = await load('.github/workflows/deploy-pages.yml');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('path: dist');
    expect(workflow).toContain('wait-for-branch-pages');
    expect(workflow).toContain('actions/deploy-pages@v4');
  });
});
