// Same seeded city/weather, actual audio channels, isolated cues and complete output chain.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,extname} from 'node:path';
import ts from 'typescript';
import {build} from 'vite';
import {drive} from './chrome.mjs';
const out='/tmp/hrp-click-audio-qa';mkdirSync(out,{recursive:true});
const source=new URL('../../src/audio/',import.meta.url).pathname;
writeFileSync(`${out}/entry.ts`,['cues','ambience','life','noise','recordings','settings'].map(name=>`export * from ${JSON.stringify(source+name+'.ts')};`).join('\n'));
await build({configFile:false,publicDir:false,build:{lib:{entry:`${out}/entry.ts`,formats:['es'],fileName:()=> 'audio.js'},outDir:`${out}/bundle`,emptyOutDir:true,minify:false}});
const baseline=ts.transpileModule(readFileSync(new URL('./fixtures/click-cues-v511.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const html=`<!doctype html><title>Click audio comparison</title><script type="module">
import * as audio from '/audio.js';import {playCue as before} from '/baseline.js';
window.audioCheck=async()=>{
 const decoder=new OfflineAudioContext(2,44100,44100), recordings=await audio.loadRecordings(decoder);
 if(!recordings.cues.tap||!recordings.city)throw Error('Recorded click/city unavailable');
 async function render(play,cue,recorded,full=false,level=1){
  const ctx=new OfflineAudioContext(2,44100*4,44100),random=audio.audioRandom(0x50da),noise=audio.makeNoise(ctx,random);
  const master=ctx.createGain();master.gain.value=.45**2;
  const floor=ctx.createBiquadFilter();floor.type='highpass';floor.frequency.value=70;
  const makeup=ctx.createGain();makeup.gain.value=2;
  const limit=ctx.createDynamicsCompressor();limit.threshold.value=-14;limit.knee.value=6;limit.ratio.value=8;limit.attack.value=.004;limit.release.value=.25;
  master.connect(floor).connect(makeup).connect(limit).connect(ctx.destination);
  const bus=Object.fromEntries(audio.CHANNELS.map(c=>{const g=ctx.createGain();g.gain.value=2*(audio.PRESETS.standard[c]/100)**2;if(['city','traffic','people'].includes(c)){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=16000;f.Q.value=.5;g.connect(f).connect(master);}else g.connect(master);return[c,g]}));
  const places={clubDoor:{x:8,z:4},park:{x:-10,z:5},riverX:-20,railZ:20,festival:{x:20,z:5},stadium:{x:25,z:20},camps:[{x:-8,z:-4}],bars:{x:5,z:7}};
  const view={x:0,z:0,rightX:1,rightZ:0,half:35};
  const mood={busy:.6,night:.7,club:.4,clubPan:.2,close:.5,rain:.2,level};
  const state={clock:1200,night:.7,busy:.6,season:'autumn',snow:0,rain:.2,festival:.3,match:.5,venues:.6,camp:.4,rave:null,police:[],vehicles:[],train:null,heli:null};
  const amb=full?new audio.Ambience(ctx,bus,noise,random,()=>true):null;if(amb)amb.useRecording(recordings.city);
  const life=full?new audio.CityLife(ctx,bus,()=>true,noise,random,places):null;
  for(let t=0;t<4;t+=.25)ctx.suspend(t).then(()=>{if(amb)amb.set(mood,.25,true,1);if(life)life.update(state,view,.25,level,true,1);if(t===.5||t===1.5||t===2.5)play(ctx,bus.ui,noise.white,cue,random,recorded?recordings.cues[cue]:undefined);ctx.resume()});
  const buf=await ctx.startRendering();let square=0,peak=0;for(let c=0;c<2;c++)for(const v of buf.getChannelData(c)){square+=v*v;peak=Math.max(peak,Math.abs(v));}return {rms:Math.sqrt(square/(buf.length*2)),peak};
 }
 const rows=[];
 for(const recorded of [false,true])for(const cue of ['tap','confirm','warn']){const a=await render(before,cue,recorded),b=await render(audio.playCue,cue,recorded);const ratio=b.rms/a.rms;if(Math.abs(ratio-(cue==='tap'?.5:1))>.0001)throw Error('Cue gain ratio '+cue+': '+ratio);rows.push({cue,recorded,ratio,before:a,after:b})}
 for(const level of [.5,1]){const a=await render(before,'tap',true,true,level),b=await render(audio.playCue,'tap',true,true,level);if(!Number.isFinite(b.rms)||b.peak>=.99)throw Error('Full mix invalid/clipping');rows.push({fullMix:true,seed:0x50da,rain:.2,level,before:a,after:b})}
 return rows;
};window.audioReady=true;
</script>`;
const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;if(p==='/'){res.setHeader('Content-Type','text/html');res.end(html)}else if(p==='/baseline.js'){res.setHeader('Content-Type','text/javascript');res.end(baseline)}else{try{res.setHeader('Content-Type',extname(p)==='.js'?'text/javascript':extname(p)==='.wav'?'audio/wav':'audio/mpeg');res.end(readFileSync(join(out,'bundle',p)))}catch{res.writeHead(404);res.end()}}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{const [rows]=await drive(`http://127.0.0.1:${server.address().port}/`,[{eval:`(async()=>{for(let i=0;i<100&&!window.audioReady;i++)await new Promise(r=>setTimeout(r,50));if(!window.audioReady)throw Error('Audio fixture unavailable');return audioCheck()})()`}],{settle:500,log:()=>{}});assert(rows.length===8);writeFileSync(`${out}/result.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(rows));console.log('Recorded/generated clicks measure 50% amplitude; confirmation/warnings unchanged; seeded full mixes valid without clipping');}finally{server.close()}
