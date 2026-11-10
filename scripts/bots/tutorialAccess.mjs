// Presentation race fixture only; real support completion is verified by tutorial.mjs.
// Never force a HUD refresh after the model changes lessons.
import {drive,SKIP_WELCOME} from './chrome.mjs';
const expected=process.argv[2]??'fixed';
const base=process.argv[3]??'http://127.0.0.1:5308/simulator/';
const rows=await drive(base+'?scenario=tutorial&packs=none&quality=low',[
 ...SKIP_WELCOME,
 {eval:`(()=>{const s=window.__sandbox,T=s.sim.tutorial.constructor;s.sim.tutorial=T.restore({...s.sim.tutorial.snapshot(),stage:'dropIn',reviewedSkills:true,visits:{outreach:5,dropIn:4}});s.sim.tutorialInspectCamp();s.sim.clockMinutes=30*60+43;s.syncEvents();const row=document.querySelector('#services-management [data-tutorial-service=clubHr]');if(row.dataset.tutorialLocked!=='true')throw Error('Fixture did not start with locked club');s.sim.tutorial.served('dropIn');s.sim.tutorialInspectCamp();return {stage:s.sim.tutorial.stage,clock:s.sim.clockMinutes}})()`},
 {cdp:'Emulation.setDeviceMetricsOverride',params:{width:1438,height:900,deviceScaleFactor:1,mobile:false}},{wait:500},
 {eval:`(()=>{const row=document.querySelector('#services-management [data-tutorial-service=clubHr]'),g=document.querySelector('.tutorial-guide');return {stage:g.dataset.stage,clubLocked:row.dataset.tutorialLocked,clubDisabled:row.querySelector('button').disabled,clock:document.querySelector('.clock').textContent,area:document.getElementById('hud').dataset.tutorialStress,missionVisible:!g.hidden,paused:document.querySelector('.time-pause').dataset.paused}})()`}
],{size:'1440x900',diagnostics:true,log:()=>{}});
const r=rows.at(-1);console.log(JSON.stringify(rows));
if(r.stage!=='nightlife')throw Error('New objective not presented');
if(expected==='baseline'){if(r.clubLocked!=='true')throw Error('Baseline did not reproduce')}else if(r.clubLocked!=='false'||r.clubDisabled||r.area!=='true'||!r.clock.includes('16:00'))throw Error('Club objective published before its controls and clock');
