import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/deploy-pages.yml',import.meta.url),'utf8');
const liveQa=readFileSync(new URL('../.github/workflows/excel-live-qa.yml',import.meta.url),'utf8');

describe('GitHub Pages commercial deployment contract',()=>{
  it('waits for the branch Pages job to finish before publishing verified Vite dist',()=>{
    expect(workflow).toContain('for attempt in $(seq 1 90)');
    expect(workflow).toContain('status="${state%%|*}"');
    expect(workflow).toContain('if [ "$status" = "completed" ]');
    expect(workflow).not.toContain('if [ -z "$status" ] ||');
    expect(workflow).toContain('npm run build:delivery');
    expect(workflow).toContain('path: dist');
    expect(workflow).toContain('Deploy Vite dist to GitHub Pages');
  });

  it('production Chrome QA waits for deploy-pages rather than raw branch Pages',()=>{
    expect(liveQa).toContain('select(.name == "deploy-pages")');
    expect(liveQa).not.toContain('select(.name == "pages build and deployment")');
    expect(liveQa).toContain('EXCEL_BASE_URL');
    expect(liveQa).toContain('https://kzone87.github.io/customer-map-planner/');
  });
});
