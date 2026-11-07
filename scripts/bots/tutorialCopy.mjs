// Real rendered tutorial copy in all supported languages, including recovery paths.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {drive,call} from './chrome.mjs';
const base=process.argv[2]??'http://127.0.0.1:5217/',out=process.argv[3]??'/tmp/hrp-tutorial-copy';mkdirSync(out,{recursive:true});
const results=[];
for(const lang of ['en','pl','es','pt','uk']){
 const url=new URL(base);url.search=`?menu=1&lang=${lang}`;
 const rows=await drive(url.href,[call('./tutorialCopy.js'),{shot:`${lang}-desktop.png`},{cdp:'Emulation.setDeviceMetricsOverride',params:{width:393,height:852,deviceScaleFactor:1,mobile:true}},call('./tutorialCopy.js'),{shot:`${lang}-phone.png`}],{out,size:'1440x900',diagnostics:true,log:()=>{}});
 for(const r of rows){assert.equal(r.tasks.length,15);assert.deepEqual(r.errors,[]);results.push({lang,...r});}
 console.log(lang+': all 15 tasks, normal/recovery/control states, expanded explanation and collapsed hint passed on desktop/phone');
}
writeFileSync(out+'/report.json',JSON.stringify(results,null,2));
