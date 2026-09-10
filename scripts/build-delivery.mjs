import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=path.resolve('dist');
if(!fs.existsSync(root))throw new Error('dist directory not found; run npm run build first');
const manifestPath=path.join(root,'MANIFEST.json');
fs.rmSync(manifestPath,{force:true});

function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const full=path.join(dir,entry.name);return entry.isDirectory()?files(full):[full]})}
const entries=files(root).sort().map(file=>{const data=fs.readFileSync(file);return {path:path.relative(root,file).replaceAll('\\','/'),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}});
const manifest={schemaVersion:1,product:'Excel Workbench',deliveryType:'static-local-first',sourceCommit:process.env.GITHUB_SHA||'local-build',builtAt:new Date().toISOString(),files:entries};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(`Excel Workbench delivery manifest: ${entries.length} files`);
