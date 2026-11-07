// Page-side rendered copy audit through real navigation, guide, styles and translations.
async () => {
 const [{TutorialGuide},{tutorialNavigation,tutorialBriefing},{TutorialProgress},{loadCatalogue}]=await Promise.all([import('/src/ui/tutorialGuide.ts'),import('/src/ui/tutorialNavigation.ts'),import('/src/game/tutorial.ts'),import('/src/i18n/index.ts')]);
 await loadCatalogue();
 const host=document.createElement('div'),dock=document.createElement('div');document.body.append(host,dock);
 host.style.cssText='position:fixed;inset:0;z-index:1000;pointer-events:none';dock.style.cssText='position:fixed;top:90px;right:16px;width:calc(100% - 32px);max-width:420px;z-index:1000';
 let plan=null;const guide=new TutorialGuide(host,{instruction:()=>plan?.instruction??'',chapter:()=>tutorialBriefing(plan),continueCity:()=>{}},dock);
 const context={patrolAway:false,patrolReady:true,canAffordPatrol:true,placing:false,placementReady:false,manuallyPaused:false,selectedCamp:false,selectedService:null,servicesOpen:false,running:()=>false,needsStaff:()=>false};
 const cases=[['meet',{}],['patrol',{}],['patrol',{running:()=>true}],['patrol',{running:()=>true,selectedCamp:true}],['patrol',{running:()=>true,canAffordPatrol:false}],['patrol',{running:()=>true,patrolReady:false}],['patrol',{patrolAway:true}],['outreach',{reviewedSkills:false}]];
 for(const [stage,id] of [['patrol','footPatrol'],['outreach','outreach'],['dropIn','dropIn'],['nightlife','clubHr']]) for(const extra of [{},{servicesOpen:true},{selectedService:id},{placing:true},{placing:true,placementReady:true},{running:()=>true},{running:()=>true,manuallyPaused:true},{running:()=>true,needsStaff:()=>true}])cases.push([stage,{reviewedSkills:true,...extra}]);
 cases.push(['night',{running:()=>true}],['night',{running:id=>id!=='dropIn'}],['night',{running:()=>true,needsStaff:()=>true}],['complete',{}]);
 const tasks=new Set(),results=[];
 const visible=e=>!!e.getClientRects().length;
 for(const [stage,overrides] of cases){
  const progress=TutorialProgress.restore({version:1,stage,reviewedSkills:overrides.reviewedSkills??true});
  plan=tutorialNavigation(progress,{...context,...overrides});const briefing=tutorialBriefing(plan);tasks.add(briefing.id);guide.set(progress);
  if(guide.root.dataset.collapsed==='true')guide.root.querySelector('.tutorial-toggle').click();
  const explanation=guide.root.querySelector('.tutorial-context'),hint=guide.root.querySelector('.tutorial-instruction');
  if(!visible(explanation)||explanation.textContent!==briefing.context||visible(hint))throw Error('Briefing repeats or loses task '+stage+':'+briefing.id);
  const paragraphs=[...guide.root.querySelectorAll(':scope > p')].filter(visible).map(p=>p.textContent.trim()).filter(Boolean);
  if(new Set(paragraphs).size!==paragraphs.length)throw Error('Repeated visible copy '+briefing.id);
  guide.root.querySelector('.tutorial-minimize').click();
  if(visible(explanation)||!visible(hint)||(hint.textContent!==(plan?.instruction??'')))throw Error('Dock loses current control '+briefing.id);
  results.push({stage,task:briefing.id,explanation:briefing.context,hint:hint.textContent});
 }
 if(tasks.size!==15)throw Error('Missing task paths '+JSON.stringify([...tasks]));
 guide.root.querySelector('.tutorial-toggle').click();
 return {size:[innerWidth,innerHeight],tasks:[...tasks],cases:results,errors:window.__qaErrors??[]};
}
