import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { drive } from './chrome.mjs';
const source=ts.transpileModule(readFileSync(new URL('../../src/ui/keyboard.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/keyboard.js'?'text/javascript':'text/html');res.end(req.url==='/keyboard.js'?source:`<!doctype html><button id="action" onclick="clicks++">Action</button><input id="text"><div id="edit" contenteditable="true"></div><script type="module">import{bindPauseShortcut}from'/keyboard.js';window.toggles=0;window.clicks=0;bindPauseShortcut(()=>toggles++);</script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const key=(type,extra={})=>({cdp:'Input.dispatchKeyEvent',params:{type,key:' ',code:'Space',windowsVirtualKeyCode:32,...extra}});
const check=(expression)=>({eval:`if(!(${expression}))throw Error(${JSON.stringify(expression)});true`});
try{
 const results=await drive(`http://127.0.0.1:${server.address().port}`, [
 {eval:`(async()=>{for(let n=0;typeof window.toggles!=='number'&&n<100;n++)await new Promise(r=>setTimeout(r,50));if(typeof window.toggles!=='number')throw Error('Module did not load');document.querySelector('#action').focus();return true})()`},key('rawKeyDown'),key('rawKeyDown',{autoRepeat:true}),key('keyUp'),check('toggles===1&&clicks===0'),
 key('rawKeyDown'),key('keyUp'),check('toggles===2&&clicks===0'),
 {eval:`document.querySelector('#text').focus();true`},key('keyDown',{text:' '}),key('keyUp'),check(`toggles===2&&document.querySelector('#text').value===' '`),
 {eval:`document.querySelector('#edit').focus();true`},key('keyDown',{text:' '}),key('keyUp'),check(`toggles===2&&document.querySelector('#edit').textContent.length>0`),
 {eval:`document.querySelector('#action').focus();true`},key('rawKeyDown',{modifiers:2}),key('keyUp',{modifiers:2}),check('toggles===2&&clicks===0'),
 ...['keyDown','keyUp'].map(type=>({cdp:'Input.dispatchKeyEvent',params:{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:type==='keyDown'?'\r':undefined}})),check('toggles===2&&clicks===1')
 ],{settle:100,log:()=>{}});
 assert(results.every(Boolean));console.log('PASS: Space only pauses/resumes; holds, focused buttons, typing, modifiers and Enter verified with native Chrome input');
}finally{server.close();}
