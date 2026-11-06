const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MURALHA_TEST_URL;
if(!base)throw Error('Use browser_accounts.py --journey-regressions');
const blankProgress={castle_unlocked:false,forest_clears:0,castle_clears:0};
const blankStats={runs:0,victories:0,kills:0,damage:0,points:0,best_points:0};
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const failures=[],errors=[];let checks=0;
  const check=(ok,msg)=>{checks++;if(!ok)failures.push(msg);console.log((ok?'OK: ':'FAIL: ')+msg);};
  try{
    const p=await b.newPage({viewport:{width:1280,height:720}});p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/?char=mage&god&nointro&stage=castle');
    await p.waitForFunction(()=>window.GAME?.scene.getScene('Game')?.gameReady);
    await p.evaluate(()=>GAME.scene.getScene('Game').onBossDefeated());
    await p.waitForFunction(()=>!!GAME.scene.getScene('Game').finale);
    await p.keyboard.press('g');
    check(!await p.evaluate(()=>GamePortal.dialogOpen),'Grimório não cobre a cutscene pelo atalho G');
    if(await p.evaluate(()=>GamePortal.dialogOpen))await p.keyboard.press('Escape');
    const speed=await p.evaluate(()=>{const g=GAME.scene.getScene('Game'),t=g.totalTime,before=g.finale.elapsed;g.update(0,1000);return {elapsed:g.finale.elapsed-before,time:g.totalTime===t};});
    check(speed.elapsed>=.99&&speed.time,'Cutscene usa tempo real com FPS baixo e não gera tempo de partida');

    const a=await b.newPage();a.on('pageerror',e=>errors.push(e.message));
    let current={user:{id:701,username:'RevisionTester',role:'player'},csrf:'revision-csrf',
      settings:{healthDropChance:.05,bossTime:900,spawnBaseRate:1.1,spawnGrowth:.0115,maxEnemies:240},
      progress:{...blankProgress},stats:{...blankStats}};
    let holdNext=false,captured,release;
    await a.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/api/session'){
        const data=structuredClone(current);
        if(holdNext){holdNext=false;captured();await new Promise(resolve=>{release=resolve;});}
        return route.fulfill({json:data});
      }
      if(path==='/api/runs/advance')current.progress={castle_unlocked:true,forest_clears:1,castle_clears:0};
      if(path==='/api/runs/finish')current.stats={runs:1,victories:1,kills:12,damage:450,points:8000,best_points:8000};
      return route.fulfill({json:{saved:true,ranked:true,run_id:'fixture',stage:'castle',progress:current.progress,stats:current.stats}});
    });
    await a.goto(base+'/?nointro');
    await a.waitForFunction(()=>GamePortal.user?.username==='RevisionTester');
    for(const endpoint of ['advance','finish']){
      holdNext=true;const arrived=new Promise(resolve=>{captured=resolve;});
      await a.evaluate(()=>window.dispatchEvent(new Event('focus')));await arrived;
      await a.evaluate(endpoint=>endpoint==='advance'?GamePortal.advanceRun('fixture'):GamePortal.finishRun({run_id:'fixture'}),endpoint);
      const response=a.waitForResponse(r=>new URL(r.url()).pathname==='/api/session');release();await(await response).finished();
      await a.evaluate(()=>new Promise(requestAnimationFrame));
      const state=await a.evaluate(()=>({progress:GamePortal.getProgress(),stats:GamePortal.stats,csrf:GamePortal.csrf}));
      check(state.progress.castle_unlocked&&state.progress.forest_clears===1&&state.csrf==='revision-csrf'&&(endpoint!=='finish'||state.stats.kills===12),
        'Sessão atrasada não regride perfil após '+endpoint);
    }
    if(errors.length)failures.push(...errors);
    if(failures.length)throw Error(failures.join('\n'));
    console.log(JSON.stringify({ok:true,checks,pageErrors:errors.length}));
  }finally{await b.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
