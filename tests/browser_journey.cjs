// Integração da jornada; somente o banco temporário do runner é alterado.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const base=process.env.MURALHA_TEST_URL;
if(!base||!process.env.MURALHA_TEST_DATA_DIR)throw Error('Use browser_accounts.py --journey');
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const out='/tmp/muralha-jornada';fs.mkdirSync(out,{recursive:true});
const ready=(page,stage)=>page.waitForFunction(stage=>window.GAME?.scene.isActive('Game')&&GAME.scene.getScene('Game').gameReady&&GAME.scene.getScene('Game').stageId===stage,stage);
const ageRun=run=>execFileSync('python3',['-c',
  'import sqlite3,sys,time; db=sqlite3.connect(sys.argv[1]); db.execute("UPDATE runs SET started_at=? WHERE id=?",(time.time()-905,sys.argv[2])); db.commit(); db.close()',
  process.env.MURALHA_TEST_DATA_DIR+'/jogo.sqlite3',run]);
async function startMenu(page){
  await page.goto(base+'/?nointro');
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Continuar como convidado'}).click();
  await page.evaluate(()=>GAME.scene.getScene('Menu').go());
  await page.waitForFunction(()=>GAME.scene.isActive('Select'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>GAME.scene.isActive('StageSelect'));
  await page.waitForFunction(()=>!GAME.scene.getScene('StageSelect').cameras.main.fadeEffect.isRunning);
}
async function auth(page,name,register){
  await page.evaluate(()=>GamePortal.openLogin());
  const dialog=page.getByRole('dialog');
  if(register)await dialog.locator('.portal-switches button').nth(1).click();
  await dialog.getByLabel('Nome de usuário',{exact:true}).fill(name);
  await dialog.getByLabel('Senha',{exact:true}).fill('Jornada!2026');
  await dialog.locator('form button[type=submit]').click();
  await page.waitForFunction(name=>GamePortal.user?.username===name,name);
  await dialog.waitFor({state:'detached'});
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,
    args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
  page.setDefaultTimeout(25000);
  const errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  const check=s=>{checks.push(s);console.log('OK: '+s);};
  try{
    await startMenu(page);
    assert(await page.evaluate(()=>GamePortal.canPlayStage('forest')&&!GamePortal.canPlayStage('castle')&&!GamePortal.canPlayStage('soon')),'Bloqueio inicial incorreto');
    await page.keyboard.press('2');
    assert(await page.evaluate(()=>GAME.scene.isActive('StageSelect')),'Fase bloqueada iniciou por teclado');
    await page.keyboard.press('3');
    assert(await page.evaluate(()=>GAME.scene.isActive('StageSelect')),'Em breve iniciou como fase real');
    await page.screenshot({path:out+'/selecao-bloqueada.png'});
    await page.keyboard.press('1');
    await page.waitForFunction(()=>GAME.scene.isActive('Difficulty'));
    await page.waitForFunction(()=>!GAME.scene.getScene('Difficulty').cameras.main.fadeEffect.isRunning);
    await page.keyboard.press('1');await ready(page,'forest');
    check('herói → fase → dificuldade; castelo bloqueado e teaser desabilitado');

    await require('./gates_checks.cjs')(page);
    check('fachada física contém jogador, dash e flancos; porta é a única passagem');
    await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game');g.godMode=true;g.spawningEnabled=false;
      const frost=g.player.addPower('frost');frost.levelUp();g.player.dashLevel=2;
      g.t=900;g.startBossFight();g.boss.invuln=false;g.damageEnemy(g.boss,g.boss.hp+1,null);
    });
    await page.waitForFunction(()=>GAME.scene.getScene('Game').stageCleared);
    await page.evaluate(async()=>{
      const g=GAME.scene.getScene('Game');g.player.x=g.world.gate.x;g.player.y=g.world.gate.y+70;await g.enterCastle();
    });
    await ready(page,'castle');
    assert(await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game');return g.world.entry&&Math.abs(g.player.y-g.world.entry.endY)<3&&g.player.hasPower('frost')?.level===2&&g.player.dashLevel===2&&GamePortal.canPlayStage('castle');
    }),'Chegada não saiu pela porta ou perdeu build/desbloqueio');
    await page.screenshot({path:out+'/entrada-castelo.png'});
    check('atravessar a porta libera castelo e chegada animada sai da porta interna');

    await page.evaluate(()=>{const g=GAME.scene.getScene('Game');g.godMode=false;g.player.invuln=0;g.player.takeDamage(g.player.maxHp+1);});
    await page.waitForFunction(()=>GAME.scene.isActive('End'));
    await page.keyboard.press('Enter');await ready(page,'castle');
    assert(await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game');return g.startStageId==='castle'&&g.totalKills===0&&g.totalDamage===0&&g.totalTime<3&&g.player.hp===g.player.maxHp&&g.player.hasPower('frost')?.level===2;
    }),'Morte voltou à floresta, perdeu checkpoint ou reutilizou pontuação');
    check('morte reinicia fase atual com build de entrada e estatísticas de nova partida');

    await page.evaluate(()=>{const g=GAME.scene.getScene('Game');g.godMode=true;g.t=900;g.startBossFight();g.boss.invuln=false;g.damageEnemy(g.boss,g.boss.hp+1,null);});
    await page.waitForFunction(()=>!!GAME.scene.getScene('Game').finale);
    assert(!await page.evaluate(()=>GAME.scene.isActive('End')),'Tela final apareceu antes da cutscene');
    await page.waitForFunction(()=>GAME.scene.getScene('Game').finale.elapsed>=6.7);
    await require('./finale_checks.cjs')(page);
    assert(await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game'),time=g.totalTime;g.onBossDefeated();
      return g.finale.opening>0&&g.totalTime===time&&g.ended;
    }),'Piso não abriu sobre a lava ou cutscene duplicou');
    await page.screenshot({path:out+'/arena-aberta.png'});
    await page.waitForFunction(()=>GAME.scene.getScene('Game').finale.elapsed>=8.8);
    assert(await page.evaluate(()=>GAME.scene.getScene('Game').player.sprite.scaleX<.7),'Herói não está caindo no abismo');
    await page.screenshot({path:out+'/queda.png'});
    await page.waitForFunction(()=>GAME.scene.isActive('End'));
    assert(await page.evaluate(()=>GAME.scene.getScene('End').d.win),'Queda foi registrada como derrota');
    await page.keyboard.press('Enter');await ready(page,'castle');
    assert(await page.evaluate(()=>GAME.scene.isVisible('UI')),'HUD permaneceu escondido depois da cutscene');
    check('chefe final → rachaduras → lava → queda → fim, com vitória e execução única');

    const account=await context.newPage();account.on('pageerror',e=>errors.push(e.message));account.setDefaultTimeout(25000);
    await account.goto(base+'/?nointro');
    await account.getByRole('dialog').getByRole('button',{name:'Continuar como convidado'}).click();
    await auth(account,'GuardiaoDaPorta',true);
    assert(!await account.evaluate(()=>GamePortal.canPlayStage('castle')),'Progresso guest contaminou conta nova');
    await account.evaluate(()=>GAME.scene.start('Game',{char:'ranger',stage:'forest',difficulty:'medium'}));
    await ready(account,'forest');
    const run=await account.evaluate(async()=>(await GAME.scene.getScene('Game').runStart).run_id);ageRun(run);
    await account.evaluate(async()=>{
      const g=GAME.scene.getScene('Game');g.spawningEnabled=false;g.t=900;g.stageCleared=true;g.world.openCastleGate();
      g.player.x=g.world.gate.x;g.player.y=g.world.gate.y+70;await g.enterCastle();
    });
    await ready(account,'castle');await account.reload();
    await account.waitForFunction(()=>GamePortal.user?.username==='GuardiaoDaPorta'&&GamePortal.canPlayStage('castle'));
    await account.evaluate(()=>GAME.scene.start('StageSelect',{char:'ranger'}));
    await account.waitForFunction(()=>GAME.scene.isActive('StageSelect'));
    await account.waitForFunction(()=>!GAME.scene.getScene('StageSelect').cameras.main.fadeEffect.isRunning);
    await account.screenshot({path:out+'/selecao-liberada.png'});
    await account.keyboard.press('2');await account.waitForFunction(()=>GAME.scene.isActive('Difficulty'));
    await account.waitForFunction(()=>!GAME.scene.getScene('Difficulty').cameras.main.fadeEffect.isRunning);
    await account.keyboard.press('1');await ready(account,'castle');
    await account.evaluate(()=>{
      const g=GAME.scene.getScene('Game');g.spawningEnabled=false;
      const e=g.enemies.spawn('skel_warrior',g.player.x+80,g.player.y,1);g.damageEnemy(e,100,null);g.player.invuln=0;g.player.takeDamage(g.player.maxHp+1);
    });
    await account.waitForFunction(()=>GAME.scene.isActive('End'));
    const saved=await account.evaluate(()=>GAME.scene.getScene('Game').runSubmission);
    assert(saved.saved&&saved.ranked,'Estatísticas reais da conta não salvas');
    await account.reload();await account.waitForFunction(()=>GamePortal.stats?.kills>=1&&GamePortal.canPlayStage('castle'));
    await account.evaluate(()=>GamePortal.openLogin());
    await account.getByRole('dialog').waitFor();await account.screenshot({path:out+'/perfil.png'});
    check('conta guarda fase e estatísticas no servidor após recarregar; acesso direto ao castelo liberado');
    assert(!errors.length,errors.join('; '));
    console.log(JSON.stringify({ok:true,checks:checks.length,pageErrors:errors.length,artifacts:out}));
  }catch(e){await page.screenshot({path:out+'/falha.png'}).catch(()=>{});console.error('PAGE ERRORS',errors);throw e;}
  finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
