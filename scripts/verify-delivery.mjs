import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=path.resolve(process.argv[2]||'dist'),manifestPath=path.join(root,'MANIFEST.json');
if(!fs.existsSync(manifestPath))throw new Error(`MANIFEST.json not found: ${manifestPath}`);
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest?.schemaVersion!==1||manifest?.product!=='Excel Workbench'||!Array.isArray(manifest.files)||!manifest.files.length)throw new Error('invalid Excel Workbench manifest');
for(const entry of manifest.files){
  const file=path.resolve(root,String(entry.path||'')),rel=path.relative(root,file);
  if(!entry.path||rel.startsWith('..')||path.isAbsolute(rel))throw new Error(`unsafe manifest path: ${entry.path}`);
  if(!fs.existsSync(file))throw new Error(`delivery file missing: ${entry.path}`);
  const data=fs.readFileSync(file),digest=createHash('sha256').update(data).digest('hex');
  if(data.length!==Number(entry.bytes))throw new Error(`delivery size mismatch: ${entry.path}`);
  if(digest!==entry.sha256)throw new Error(`delivery checksum mismatch: ${entry.path}`);
}
console.log(`Excel Workbench delivery verified: ${manifest.files.length} files`);
