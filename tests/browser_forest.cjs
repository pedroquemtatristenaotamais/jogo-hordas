const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const assert = (ok, message) => { if (!ok) throw Error(message); };
const base = process.env.MURALHA_TEST_URL;
if (!base) throw Error('Execute browser_accounts.py --forest');
const artifacts = '/tmp/muralha-floresta'; fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(20000);
  const errors = [], checks = [];
  page.on('pageerror', e => errors.push(e.message));
  const check = s => { checks.push(s); console.log('OK: ' + s); };
  const ready = (p, stage) => p.waitForFunction(id => window.GAME?.scene.getScene('Game')?.gameReady && GAME.scene.isActive('Game') && GAME.scene.getScene('Game').stageId === id, stage);
  async function view(x, y, name) {
    await page.evaluate(({ x, y }) => {
      const g = GAME.scene.getScene('Game'); g.player.x = x; g.player.y = y;
      g.world.constrain(g.player); g.player.sprite.setPosition(g.player.x, g.player.y);
      g.cameras.main.stopFollow(); g.cameras.main.centerOn(x, y);
    }, { x, y });
    await page.waitForFunction(pos => {
      const c = GAME.scene.getScene('Game').cameras.main;
      return Math.abs(c.midPoint.x - pos.x) < 5 && Math.abs(c.midPoint.y - pos.y) < 5 && !c.fadeEffect.isRunning;
    }, { x, y });
    await page.screenshot({ path: artifacts + '/' + name + '.png' });
  }
  try {
    await page.goto(base + '/?char=mage&god&nointro');
    await ready(page, 'forest');
    assert(await page.evaluate(() => {
      const g = GAME.scene.getScene('Game'); g.spawningEnabled = false; Sfx.muted = true;
      return g.world instanceof ForestWorld && g.bossTime === 900 && !g.world.gateOpen && g.world.lights.length > 15;
    }), 'A floresta não é o início com iluminação e portão selado');
    await view(2000, 3000, 'inicio');
    check('floresta é a primeira fase noturna, com fontes de luz e portão selado');

    await page.evaluate(() => {
      const g = GAME.scene.getScene('Game'), w = g.world, p = g.player;
      for (const point of [{x:-500,y:2000},{x:4500,y:2000},{x:2000,y:-500},{x:2000,y:4500}]) {
        const e = { ...point, radius:p.radius }; w.constrain(e);
        if (e.x < w.B+p.radius-.01 || e.x > w.W-w.B-p.radius+.01 || e.y < w.B+p.radius-.01 || e.y > w.H-w.B-p.radius+.01) throw Error('Árvores de borda não contêm o jogador');
      }
      if (g.children.list.some(o => o.type === 'TileSprite' && ['ground','wall','path'].includes(o.texture?.key))) throw Error('Piso ou muralha do castelo na floresta');
      for (const point of w.pathBranches[0].points) {
        const walker={x:point.x,y:point.y,radius:p.radius};w.constrain(walker);
        if(Math.hypot(walker.x-point.x,walker.y-point.y)>1) throw Error('Trilha principal bloqueada');
      }
      for(const body of w.decorativeBodies) if(body.sprite.type!=='Image' || body.sprite.body || body.sprite.input) throw Error('Aldeão decorativo tem comportamento/colisão');
      for (let t=0;t<900;t+=30) for(let n=0;n<10;n++) if(!FOREST_ENEMY_IDS.includes(g.enemies.pickType(t))) throw Error('Horda do castelo vazou para floresta');
      p.x=w.gate.x; p.y=w.gate.y+80; w.constrain(p);
    });
    assert(!await page.evaluate(() => GAME.scene.getScene('Game').enterCastle()), 'Entrou antes de derrotar o guardião');
    await view(2000, 650, 'portao-selado');
    check('árvores contêm o mapa, ondas são próprias e porta não permite pular o chefe');

    await page.evaluate(() => {
      const g=GAME.scene.getScene('Game'), m=g.enemies, p=g.player;
      const added=['forest_boar','forest_snake','forest_raven','forest_sentinel'];
      const selected=new Set();
      for(let i=0;i<3000;i++) selected.add(m.pickType(850));
      for(const id of added) {
        if(!selected.has(id)) throw Error('Nova criatura não aparece nas hordas: '+id);
        if(STAGES.castle.enemyIds.includes(id)) throw Error('Criatura da mata vazou para o castelo: '+id);
        if(!g.textures.exists('e_'+id) || g.anims.get('walk_e_'+id)?.frames.length!==4) throw Error('Arte/animação ausente: '+id);
      }
      m.killAllSilently(); g.grid.clear(); g.enemyShots.clear();
      p.x=2000;p.y=2000;g.spawningEnabled=true;
      const spawn=id=>m.spawn(id,p.x-200,p.y,1);
      const boar=spawn('forest_boar');boar.chargeCd=0;
      m.ai(boar,.05,p,1);
      if(boar.state!=='windup') throw Error('Javali investe sem preparação');
      m.ai(boar,.9,p,1);
      const x=boar.x;m.ai(boar,.15,p,1);
      if(boar.state!=='charge' || boar.x-x<20) throw Error('Javali não completa a investida');
      m.kill(boar,true);
      const snake=spawn('forest_snake');snake.atkCd=0;
      m.ai(snake,.05,p,1);
      const venom=g.enemyShots.items.filter(s=>s.live);
      if(venom.length!==1 || venom[0].slow<=0 || venom[0].dmg<=0) throw Error('Serpente não cospe veneno com lentidão');
      m.ai(snake,.1,p,1);
      if(g.enemyShots.items.filter(s=>s.live).length!==1) throw Error('Serpente ignora cadência');
      m.kill(snake,true);g.enemyShots.clear();
      const raven=spawn('forest_raven');raven.atkCd=0;
      m.ai(raven,.05,p,1);
      const feathers=g.enemyShots.items.filter(s=>s.live);
      if(feathers.length!==3 || new Set(feathers.map(s=>Math.round(Math.atan2(s.vy,s.vx)*100))).size!==3) throw Error('Corvo não dispara leque de penas');
      m.kill(raven,true);g.enemyShots.clear();
      const sentinel=spawn('forest_sentinel');sentinel.x=p.x-80;sentinel.atkCd=0;
      const before=g.hazards.length;m.ai(sentinel,.05,p,1);
      const sweep=g.hazards[before];
      if(sentinel.state!=='cast' || sweep?.shape!=='cone' || sweep.delay<.7) throw Error('Sentinela não anuncia o golpe de espinhos');
      g.updateHazards(2);m.kill(sentinel,true);
      g.spawningEnabled=false;
    });
    check('quatro novas criaturas aparecem só na floresta, com animação e ataques próprios');

    const miniIds = await page.evaluate(() => {
      const g = GAME.scene.getScene('Game'), ids=[];
      g.spawningEnabled=true;
      for(const t of [300,600]) {
        g.t=t; g.encounters.update(0);
        const e=g.encounters.active.find(e=>e.miniIndex===t/300);
        if(!e) throw Error('Miniboss da floresta ausente');
        ids.push(e.id);
        const level=g.player.level, xp=g.player.xp;
        g.enemies.kill(e);
        if(g.player.level===level && g.player.xp<=xp) throw Error('Sem XP ao matar miniboss da floresta');
        g.pendingLevels=0;
      }
      g.enemies.killAllSilently(); g.spawningEnabled=false;
      g.progression.destroy(); for(const s of g.gems.items) if(s.live) {s.live=false;s.setVisible(false);}
      return ids;
    });
    assert(miniIds.join(',') === 'forest_matriarch,forest_huntsman', 'Minibosses não são exclusivos da floresta');
    check('minibosses próprios aos cinco/dez minutos concedem XP e baú');

    await page.evaluate(() => {
      const g=GAME.scene.getScene('Game'),p=g.player;
      for(const w of p.powers) w.destroy(); p.powers=[];
      for(const id of ['blades','orbs']) {const w=p.addPower(id);while(!w.maxed) w.levelUp();}
      if(!g.progression.applyRecipe('celestial_ring')) throw Error('Não preparou união');
      const frost=p.addPower('frost'); frost.levelUp();
      p.addPassive('speed');p.addPassive('maxHp');p.mods.damage=1.7;
      p.level=12;p.xp=11;p.xpNext=CONFIG.xpNeeded(12);p.dashLevel=3;p.enableSmokeDash();
      g.totalKills=37;g.totalDamage=1523.5;g.pendingLevels=0;
      g.t=900;g.startBossFight();
      if(!(g.boss instanceof ForestBoss) || g.boss.data.name===BOSS.name || !g.world.arenaLock) throw Error('Guardião ou arena da floresta incorreto');
      g.boss.invuln=false;g.damageEnemy(g.boss,g.boss.hp+1,null);
    });
    await page.waitForFunction(() => GAME.scene.getScene('Game').stageCleared);
    assert(await page.evaluate(() => {
      const g=GAME.scene.getScene('Game');
      return !g.ended && !GAME.scene.isActive('End') && !g.world.arenaLock && g.world.gateOpen && !g.world.barrierActive && !g.world.barrierProps.length && !g.world.barrierLights.length;
    }), 'Vitória da floresta encerrou campanha ou prendeu jogador');
    await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game'),before={time:g.totalTime,points:g.points,y:g.player.y};
      g.botInput={x:0,y:-1,dash:false};
      for(let frame=0;frame<200;frame++)g.update(frame*50,50);
      g.botInput=null;
      if(Math.abs(g.player.y-before.y)<1)throw Error('Caminhada após limpar floresta foi bloqueada');
      if(g.totalTime!==before.time || g.points!==before.points)throw Error('Caminhada segura gera tempo/pontos ilimitados');
    });
    await view(2000, 650, 'portao-aberto');
    await page.evaluate(() => {
      const g=GAME.scene.getScene('Game'); g.player.x=g.world.gate.x;g.player.y=g.world.gate.y+80;g.world.constrain(g.player);
    });
    await page.keyboard.press('e');
    await ready(page,'castle');
    assert(await page.evaluate(() => {
      const g=GAME.scene.getScene('Game'),p=g.player;
      return g.startStageId==='forest' && g.world instanceof World && !(g.world instanceof ForestWorld)
        && g.totalTime>=900 && g.t<3 && g.totalKills===37 && g.totalDamage>1523
        && p.level===12 && p.xp===11 && p.passives.speed===1 && p.passives.maxHp===1
        && p.mods.damage===1.7 && p.hp===p.maxHp && p.dashLevel===3 && p.dashSmoke
        && p.hasPower('celestial_ring') && p.hasPower('frost').level===2
        && g.progression.completed.has('celestial_ring') && !g.progression.canOfferPower('blades') && !g.progression.canOfferPower('orbs')
        && p.hasPower('celestial_ring').state.sprites.length===8 && !g.stageCleared;
    }), 'Transferência perdeu progressão, estatísticas, tempo ou ingredientes consumidos');
    await view(2000,3000,'castelo-fase2');
    check('matar o chefe abre a passagem; E entra no castelo com build, uniões, XP e estatísticas preservados');

    await page.evaluate(() => {
      const g=GAME.scene.getScene('Game');
      for(let t=0;t<900;t+=60) for(let i=0;i<10;i++) if(ENEMIES[g.enemies.pickType(t)].stage==='forest') throw Error('Criatura da floresta no diretor do castelo');
      g.t=900;g.startBossFight();
      if(g.boss instanceof ForestBoss || g.boss.data.name!==BOSS.name) throw Error('Chefe final errado');
      g.boss.invuln=false;g.damageEnemy(g.boss,g.boss.hp+1,null);
    });
    await page.waitForFunction(() => GAME.scene.isActive('End'));
    assert(await page.evaluate(() => {
      const d=GAME.scene.getScene('End').d; return d.win && d.time>=1800 && d.stage==='castle' && d.startStage==='forest';
    }), 'Campanha não terminou após chefe da segunda fase');
    await page.screenshot({path:artifacts+'/vitoria-campanha.png'});
    await page.keyboard.press('Enter'); await ready(page,'forest');
    assert(await page.evaluate(() => GAME.scene.getScene('Game').player.level===1), 'Recomeço não limpou a campanha');
    check('Cavaleiro Sombrio encerra a campanha; jogar novamente retorna à floresta com reinício limpo');

    const stress=await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game'),p=g.player;
      for(const w of p.powers)w.destroy();p.powers=[];
      for(const id of ['soulblade','tempest','inferno','blizzard','celestial_ring','singularity'])p.addPower(id);
      g.openLevelUp=function(){this.pendingLevels--;this.applyChoice(this.rollChoices()[0]);};
      g.openEvolutionChest=function(chest){this.applyChoice(this.progression.getOffers(chest.canEvolve)[0]);return true;};
      g.spawningEnabled=true;g.botInput={x:0,y:0,dash:false};
      const seen=new Set();let peak=0;const begin=performance.now();
      for(let frame=0;frame<18002&&!g.bossStarted;frame++){
        g.botInput.x=Math.cos(frame/400);g.botInput.y=Math.sin(frame/400);g.botInput.dash=frame%40===0;
        g.update(frame*50,50);peak=Math.max(peak,g.enemies.alive);
        if(frame%20===0)for(const e of g.enemies.pool)if(e.alive&&FOREST_ENEMY_IDS.includes(e.id))seen.add(e.id);
        if(g.enemies.alive>240||g.hazards.length>41)throw Error('Orçamento excedido na floresta');
      }
      delete g.openLevelUp;delete g.openEvolutionChest;g.botInput=null;
      if(!g.bossStarted||!(g.boss instanceof ForestBoss)||g.encounters.spawned.filter(Boolean).length!==2||seen.size!==12)throw Error('Encontros ou variedade incompleta na simulação: '+[...seen].join(','));
      p.gainXp(1000000);if(p.level!==100)throw Error('Campanha ultrapassa nível suportado');
      g.pendingLevels=0;
      return {seconds:g.t,peak,types:seen.size,milliseconds:Math.round(performance.now()-begin)};
    });
    console.log(JSON.stringify(stress));
    check('15 minutos simulados: doze criaturas, dois minis, chefe próprio e pools limitados');

    // Mesma partida autenticada entre fases; sem esperar quinze minutos em tempo real.
    await page.evaluate(() => GamePortal.openLogin());
    const dialog=page.getByRole('dialog');
    await dialog.locator('.portal-switches button').nth(1).click();
    await dialog.getByLabel('Nome de usuário',{exact:true}).fill('TrilhaNoturna');
    await dialog.getByLabel('Senha',{exact:true}).fill('TrilhaNoturna!2026');
    await dialog.locator('form button[type=submit]').click();
    await page.waitForFunction(() => GamePortal.user?.username==='TrilhaNoturna');
    await dialog.waitFor({state:'detached'});
    let starts=0, advances=0;
    page.on('request',r=>{if(r.url().endsWith('/api/runs/start')) starts++; if(r.url().endsWith('/api/runs/advance')) advances++;});
    await page.evaluate(()=>GAME.scene.getScene('Game').scene.restart({char:'mage',stage:'forest'}));
    await ready(page,'forest');
    const runId=await page.evaluate(async()=> (await GAME.scene.getScene('Game').runStart).run_id);
    assert(runId,'Não iniciou partida autenticada');
    await page.evaluate(async()=>{
      const g=GAME.scene.getScene('Game');g.spawningEnabled=false;g.pendingLevels=0;g.t=900;g.stageCleared=true;g.world.openCastleGate();
      g.player.x=g.world.gate.x;g.player.y=g.world.gate.y+80;g.world.constrain(g.player);
      const first=g.enterCastle(), duplicate=g.enterCastle();
      if(await duplicate) throw Error('Entrada duplicada foi aceita');await first;
    });
    await ready(page,'castle');
    assert(await page.evaluate(async id=>(await GAME.scene.getScene('Game').runStart).run_id===id,runId),'Passagem criou outra partida');
    assert(starts===1 && advances===1,'Requisições duplicadas ou novo início na segunda fase');
    check('passagem autenticada mantém runId, valida servidor e ignora entrada duplicada');

    await page.evaluate(()=>GAME.scene.getScene('Game').scene.restart({char:'mage',stage:'forest'}));
    await ready(page,'forest');
    await page.route('**/api/runs/advance',route=>route.abort());
    await page.evaluate(async()=>{
      const g=GAME.scene.getScene('Game');g.spawningEnabled=false;g.t=900;g.stageCleared=true;g.world.openCastleGate();
      g.player.x=g.world.gate.x;g.player.y=g.world.gate.y+80;await g.enterCastle();
    });
    await ready(page,'castle');
    assert(await page.evaluate(()=>{
      const g=GAME.scene.getScene('Game');return g.saveError && g.isPractice;
    }),'Falha de rede perdeu campanha ou deixou resultado classificado');
    check('falha de rede permite continuar e identifica campanha sem registro no ranking');
    assert(!errors.length,errors.join('; '));
    console.log(JSON.stringify({ok:true,checks:checks.length,pageErrors:errors.length,artifacts}));
  } catch(e) {
    await page.screenshot({path:artifacts+'/falha.png'}).catch(()=>{});
    console.error('PAGE ERRORS',errors);throw e;
  } finally {await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
