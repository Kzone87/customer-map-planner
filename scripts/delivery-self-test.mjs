import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const source=path.resolve('dist'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'excel-delivery-'));
try{
  fs.cpSync(source,temp,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(temp,'MANIFEST.json'),'utf8'));
  const target=manifest.files.find(entry=>entry.path.endsWith('.html'))||manifest.files[0];
  fs.appendFileSync(path.join(temp,target.path),'\n<!-- tampered -->\n');
  const result=spawnSync(process.execPath,['scripts/verify-delivery.mjs',temp],{cwd:process.cwd(),encoding:'utf8'});
  if(result.status===0)throw new Error('delivery verifier accepted a tampered artifact');
  console.log(`Tamper rejection verified for ${target.path}`);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
