// ============================================================
//  GAMESCENE — a partida: mapa, jogador, inimigos, chefe, níveis.
//  A cena é recriada por inteiro a cada partida (create), então
//  reiniciar nunca duplica árvores, pedras, inimigos ou eventos.
// ============================================================
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data = {}) {
    this.charId = CHARACTERS[data.char] ? data.char : 'vanguard';
    this.carry = data.carry || null;
    this.stageId = resolveStage(data.stage).id;
    this.stage = resolveStage(this.stageId);
    this.startStageId = this.carry?.startStageId || this.stageId;
    this.difficultyId = resolveDifficulty(data.difficulty || this.registry.get('difficulty') || 'medium').id;
    this.difficulty = resolveDifficulty(this.difficultyId);
  }

  async create() {
    this.gameReady = false;
    this.player = null;
    const initialization = Symbol('partida');
    this.initialization = initialization;
    this.events.once('shutdown', () => { if (this.initialization === initialization) this.initialization = null; });
    const q = new URLSearchParams(location.search);
    const practice = GamePortal.isAdmin || !!this.carry?.practice || ['god', 't', 'boss', 'stage'].some(key => q.has(key));
    const run = this.carry ? this.carry.run : await GamePortal.beginRun(this.charId, practice, this.difficultyId, this.stageId).catch(error => ({ error: error.message }));
    if (this.initialization !== initialization) return;
    this.runStart = Promise.resolve(run);
    this.isPractice = practice || !!run?.run_id && !run.ranked;
    if (!this.carry && run?.stage) { this.stageId = resolveStage(run.stage).id; this.stage = resolveStage(this.stageId); this.startStageId = this.stageId; }
    this.difficultyId = resolveDifficulty(run?.difficulty || this.difficultyId).id;
    this.difficulty = resolveDifficulty(this.difficultyId);
    this.buildScene(run?.settings || GamePortal.settings || {});
    this.gameReady = true;
  }

  buildScene(settings) {
    // Parâmetros de URL (para testes): ?boss=30 &god &debug &t=200 &char=mage
    const q = new URLSearchParams(location.search);
    this.godMode = q.has('god') || !!this.carry?.godMode;
    this.debug = q.has('debug');
    this.bossTime = q.has('boss') ? parseFloat(q.get('boss')) : CONFIG.bossTime;

    // Regras públicas vêm do servidor e só são aplicadas ao iniciar uma partida.
    if (Number.isFinite(settings.healthDropChance)) CONFIG.healthDropChance = settings.healthDropChance;
    if (Number.isFinite(settings.bossTime)) CONFIG.bossTime = settings.bossTime;
    if (Number.isFinite(settings.spawnBaseRate)) CONFIG.spawn.baseRate = settings.spawnBaseRate;
    if (Number.isFinite(settings.spawnGrowth)) CONFIG.spawn.growth = settings.spawnGrowth;
    if (Number.isFinite(settings.maxEnemies)) CONFIG.maxEnemies = settings.maxEnemies;
    if (!q.has('boss')) this.bossTime = CONFIG.bossTime;

    // Estado da partida (tudo reiniciado aqui)
    this.t = !this.carry && q.has('t') ? parseFloat(q.get('t')) : 0;
    this.visualTime = this.t;
    this.elapsedBefore = this.carry?.elapsed || 0;
    this.totalKills = this.carry?.kills || 0;
    this.totalDamage = this.carry?.damage || 0;
    this.stageHpMul = this.carry ? 1.8 : 1;
    this.stageSpawnMul = this.carry ? 1.15 : 1;
    this.stageDamageMul = this.carry ? 1.2 : 1;
    this.saveError = this.carry?.saveError || null;
    this.stageCleared = false;
    this.transitioning = false;
    this.runSubmission = null;
    this.ended = false;
    this.levelUpOpen = false;
    this.chestOpen = false;
    this.pendingLevels = this.carry?.pendingLevels || 0;
    this.lastOffer = [];
    this.spawningEnabled = true;
    this.bossStarted = false;
    this.boss = null;
    this.hazards = [];
    this.botInput = null;
    this.requestDash = false;
    this.tmpA = []; this.tmpB = []; this.tmpC = []; this.tmpE = [];

    this.cameras.main.setBackgroundColor('#07060a');
    this.world = this.stageId === 'forest' ? new ForestWorld(this) : new World(this);
    this.grid = new Grid(64);
    this.fx = new FX(this);

    const def = CHARACTERS[this.charId];
    this.player = new Player(this, def, CONFIG.player.start.x, CONFIG.player.start.y);
    if (this.carry) restorePlayerState(this.player, this.carry.player);
    else this.player.addPower(def.startPower);

    this.pShots = new PlayerShots(this);
    this.enemyShots = new EnemyShots(this);
    this.gems = new Gems(this);
    this.enemies = new EnemyManager(this);
    this.progression = new ProgressionSystem(this);
    this.progression.consumed = new Set(this.carry?.consumed || []);
    this.progression.completed = new Set(this.carry?.completed || []);
    this.encounters = new EncounterDirector(this);

    // Câmera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, CONFIG.world.w, CONFIG.world.h);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setZoom(1);
    cam.fadeIn(300);

    // Brasas flutuando na tela (ambiente)
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: CONFIG.width }, y: { min: 0, max: CONFIG.height }, speedY: { min: -26, max: -8 }, speedX: { min: -10, max: 10 },
      lifespan: 4500, scale: { start: 0.85, end: 0 }, alpha: { start: 0.5, end: 0 },
      tint: this.stageId === 'forest' ? [0x9dbba9, 0xe0d8b1] : [0xff8a20, 0xffd070], frequency: this.stageId === 'forest' ? 360 : 160, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(9400);

    // Controles
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,SPACE,E,ENTER');
    this.joy = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
    this.joyG = this.add.graphics().setScrollFactor(0).setDepth(99999);
    this.input.on('pointerdown', (p) => {
      if (!p.wasTouch || p.x > CONFIG.width - 145 && p.y > CONFIG.height - 240) return;
      this.joy.active = true; this.joy.id = p.id; this.joy.ox = p.x; this.joy.oy = p.y; this.joy.x = 0; this.joy.y = 0;
    });
    this.input.on('pointermove', (p) => {
      if (!this.joy.active || this.joy.id !== p.id || !p.isDown) return;
      const dx = p.x - this.joy.ox, dy = p.y - this.joy.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 60);
      this.joy.x = dx / d * k; this.joy.y = dy / d * k;
    });
    this.input.on('pointerup', p => { if (this.joy.id !== p.id) return; this.joy.active = false; this.joy.x = 0; this.joy.y = 0; });

    this.scene.launch('UI', { game: this });
    this.events.once('shutdown', () => { this.game.scene.stop('UI'); });

    this.time.delayedCall(900, () => this.announce('Fase ' + this.stage.number + ' — ' + this.stage.shortName, this.stage.color));
  }

  // ---------------------------------------------------------- utilidades usadas por poderes/inimigos
  announce(msg, color) {
    const ui = this.scene.get('UI');
    if (ui && ui.ready) ui.announce(msg, color);
  }
  dmgScale() { return (1 + (this.t / 60) * CONFIG.spawn.dmgPerMinute) * this.stageDamageMul; }
  get totalTime() { return this.elapsedBefore + this.t; }

  // Inimigos vivos dentro de um círculo (usa a grade espacial)
  queryEnemies(x, y, r, out) {
    this.grid.query(x, y, r, out);
    let n = 0;
    for (let i = 0; i < out.length; i++) if (out[i].alive) out[n++] = out[i];
    out.length = n;
    return out;
  }

  damageEnemy(e, dmg, src) {
    if (!e.alive || dmg <= 0) return;
    if (e.isBoss) {
      const before = e.hp;
      if (e.hurt(dmg)) {
        this.totalDamage += Math.max(0, before - e.hp);
        this.fx.number(e.x + rand(-30, 30), e.y - 64, Math.round(dmg), '#ffe9a0', false);
      }
      return;
    }
    const d = e.def;
    let dealt = dmg;
    // escudo: bloqueia 80% do dano que vem pela frente
    if (d.shield && src) {
      const a = Math.atan2(src.y - e.y, src.x - e.x);
      if (Math.abs(angleDiff(a, e.face)) < 1.0) {
        dealt *= 0.2;
        this.fx.burst('spark', e.x + Math.cos(e.face) * e.radius, e.y + Math.sin(e.face) * e.radius, 3);
      }
    }
    this.totalDamage += Math.max(0, Math.min(e.hp, dealt));
    e.hp -= dealt; e.flash = 0.07;
    if (src && src.knock) {
      const dx = e.x - src.x, dy = e.y - src.y, dd = Math.hypot(dx, dy) || 1;
      const kb = d.kb === undefined ? 1 : d.kb;
      e.kx += dx / dd * src.knock * kb; e.ky += dy / dd * src.knock * kb;
    }
    this.fx.number(e.x, e.y - e.radius - 6, Math.round(dealt), dealt < dmg ? '#9aa4c0' : '#ffffff', false);
    if (e.hp <= 0) this.enemies.kill(e);
  }

  explodeAt(x, y, radius, dmg, kind, knock, color) {
    this.fx.boom(x, y, radius, color || 0xff9a3a, kind || 'fire');
    const list = this.queryEnemies(x, y, radius, this.tmpE);
    for (let i = 0; i < list.length; i++) this.damageEnemy(list[i], dmg, { x, y, knock: knock || 100, kind: 'explosion' });
    if (radius > 70) this.cameras.main.shake(70, 0.0025);
    Sfx.play('boom');
  }

  // Zona de perigo telegrafada: aparece no chão, explode depois de `delay`.
  addHazard(h) {
    if (this.hazards.length > 40) return;
    h.t = 0;
    if (h.shape === 'cone') this.fx.teleCone(h.x, h.y, h.ang, h.r, h.half, h.delay, h.col);
    else this.fx.teleCircle(h.x, h.y, h.r, h.delay, h.col);
    this.hazards.push(h);
  }
  updateHazards(dt) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t += dt;
      if (h.t < h.delay) continue;
      this.hazards[i] = this.hazards[this.hazards.length - 1]; this.hazards.pop();
      const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy);
      if (h.shape === 'cone') {
        if (!p.dead && d <= h.r + p.radius && Math.abs(angleDiff(Math.atan2(dy, dx), h.ang)) <= h.half) p.takeDamage(h.dmg);
        this.fx.ring(h.x + Math.cos(h.ang) * h.r * 0.5, h.y + Math.sin(h.ang) * h.r * 0.5, 10, h.r * 0.5, 0.25, h.col, 4, 0.2);
        this.fx.burst('dark', h.x + Math.cos(h.ang) * h.r * 0.6, h.y + Math.sin(h.ang) * h.r * 0.6, 8);
      } else {
        if (!p.dead && d <= h.r + p.radius) p.takeDamage(h.dmg);
        this.fx.boom(h.x, h.y, h.r, h.col, h.kind || 'fire');
        this.cameras.main.shake(80, 0.003);
        Sfx.play('boom');
      }
    }
  }

  // ---------------------------------------------------------- níveis
  queueLevelUp() { this.pendingLevels++; }

  rollChoices() {
    const p = this.player, pool = [];
    for (const pw of p.powers) if (!pw.maxed) pool.push({ key: 'u:' + pw.def.id, type: 'upgrade', id: pw.def.id, w: 2.2 });
    if (p.powers.length < CONFIG.maxPowers) {
      for (const id in POWERS) if (POWERS[id].obtainable !== false && !p.hasPower(id) && this.progression.canOfferPower(id)) pool.push({ key: 'n:' + id, type: 'new', id, w: p.powers.length < 4 ? 3 : 1.6 });
    }
    if (p.dashLevel < 3) pool.push({ key: 'dash', type: 'dash', w: 1.8 });
    for (const ps of PASSIVES) if ((p.passives[ps.id] || 0) < CONFIG.maxPassiveLevel) pool.push({ key: 'p:' + ps.id, type: 'passive', id: ps.id, w: 1.4 });
    // o que foi oferecido e ignorado no nível anterior aparece menos
    for (const c of pool) if (this.lastOffer.indexOf(c.key) >= 0) c.w *= 0.45;

    const out = [];
    const take = (list) => {
      let total = 0; for (const c of list) total += c.w;
      let r = Math.random() * total, chosen = list[list.length - 1];
      for (const c of list) { r -= c.w; if (r <= 0) { chosen = c; break; } }
      out.push(chosen);
      pool.splice(pool.indexOf(chosen), 1);
    };
    // garante ao menos uma opção de poder (novo ou melhoria), se existir
    const powerOpts = pool.filter((c) => c.type !== 'passive');
    if (powerOpts.length) take(powerOpts);
    while (out.length < CONFIG.levelUpChoices && pool.length) take(pool);
    if (out.length < CONFIG.levelUpChoices) out.push({ key: 'heal', type: 'heal' });  // tudo no máximo: oferece cura
    this.lastOffer = out.map((c) => c.key);
    return out;
  }

  openLevelUp() {
    if (this.levelUpOpen || this.chestOpen || this.ended) return;
    const ui = this.scene.get('UI');
    if (!ui || !ui.ready) return;
    this.pendingLevels--;
    this.levelUpOpen = true;
    const choices = this.rollChoices();
    Sfx.play('levelup');
    this.scene.pause();
    ui.showLevelUp(this.player.level - this.pendingLevels, choices, (c) => {
      this.applyChoice(c);
      this.levelUpOpen = false;
      if (!GamePortal.dialogOpen) this.scene.resume();
    });
  }

  openEvolutionChest(chest) {
    const ui = this.scene.get('UI');
    if (this.ended || this.levelUpOpen || this.chestOpen || !ui?.ready) return false;
    const offers = this.progression.getOffers(chest.canEvolve !== false);
    if (!offers.length) return false;
    this.chestOpen = true;
    this.scene.pause();
    Sfx.play('levelup');
    ui.showLevelUp(this.player.level, offers, choice => {
      this.applyChoice(choice);
      this.chestOpen = false;
      if (!GamePortal.dialogOpen) this.scene.resume();
    }, { chest: true });
    return true;
  }

  applyChoice(c) {
    const p = this.player;
    if (c.type === 'upgrade' || c.type === 'new') p.addPower(c.id);
    else if (c.type === 'passive') p.addPassive(c.id);
    else if (c.type === 'dash') p.upgradeDash();
    else if (c.type === 'evolution') this.progression.applyRecipe(c.id);
    else if (c.type === 'heal') p.heal(p.maxHp * 0.4);
    this.fx.ring(p.x, p.y, 10, 130, 0.5, 0xffe070, 4, 0.15);
    this.fx.burst('gold', p.x, p.y, 16);
  }

  // ---------------------------------------------------------- chefe
  startBossFight() {
    if (this.bossStarted || this.ended) return;
    this.bossStarted = true;
    this.spawningEnabled = false;
    const A = CONFIG.arena;
    for (const e of this.enemies.pool) if (e.alive) this.fx.burst('dark', e.x, e.y, 5);
    this.enemies.killAllSilently();
    this.enemyShots.clear();
    this.hazards.length = 0; this.fx.ground.length = 0;
    this.gems.magnetAll();
    this.cameras.main.flash(500, 120, 0, 20);
    this.world.arenaLock = true;
    this.world.showBarrier();
    const p = this.player;
    p.x = A.x; p.y = A.y + 360;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
    this.boss = this.stageId === 'forest' ? new ForestBoss(this, A.x, A.y - 170) : new Boss(this, A.x, A.y - 170);
    this.cameras.main.zoomTo(0.85, 1400);
    this.announce(this.stage.bossName + ' desperta!', this.stage.color);
  }

  onBossDefeated() {
    if (this.ended) return;
    if (this.stage.next) {
      if (this.stageCleared) return;
      this.stageCleared = true;
      this.enemyShots.clear(); this.hazards.length = 0;
      this.gems.magnetAll();
      this.world.openCastleGate();
      this.cameras.main.zoomTo(1, 1000);
      this.announce('O portão foi aberto! Siga os lampiões ao norte.', 0xffdc9c);
      Sfx.play('levelup');
      return;
    }
    this.ended = true;
    this.gems.magnetAll();
    Sfx.play('win');
    this.time.delayedCall(900, () => this.showEnd(true));
  }

  nearCastleGate() {
    const gate = this.world?.gate;
    return this.stageId === 'forest' && gate && Math.hypot(this.player.x - gate.x, this.player.y - gate.y) <= 150;
  }

  async enterCastle() {
    const ui = this.scene.get('UI');
    if (!this.gameReady || !this.scene.isActive() || this.ended || this.transitioning || !this.stageCleared || !this.world.gateOpen || !this.nearCastleGate() || this.levelUpOpen || this.chestOpen || ui?.paused || GamePortal.dialogOpen) return false;
    this.transitioning = true;
    const initialization = this.initialization;
    const carry = {
      player: capturePlayerState(this.player), elapsed: this.totalTime,
      kills: this.totalKills, damage: this.totalDamage, pendingLevels: this.pendingLevels,
      consumed: [...this.progression.consumed], completed: [...this.progression.completed],
      startStageId: this.startStageId, practice: this.isPractice, godMode: this.godMode,
      saveError: this.saveError, run: await this.runStart,
    };
    try {
      if (carry.run?.run_id && !carry.saveError) await GamePortal.advanceRun(carry.run.run_id);
    } catch (error) {
      carry.practice = true;
      carry.saveError = 'A passagem não foi registrada no servidor. Esta campanha segue fora do ranking.';
      GamePortal.notice(carry.saveError);
    }
    if (this.initialization !== initialization || this.ended) return false;
    this.scene.restart({ char: this.charId, difficulty: this.difficultyId, stage: 'castle', carry });
    return true;
  }

  onPlayerDeath() {
    if (this.ended) return;
    this.ended = true;
    const p = this.player;
    p.sprite.anims.stop(); p.sprite.clearTint();
    this.fx.burst('blood', p.x, p.y, 18);
    this.tweens.add({ targets: p.sprite, angle: 90, alpha: 0.35, y: p.y + 8, duration: 700, ease: 'Quad.easeOut' });
    this.cameras.main.shake(300, 0.01);
    Sfx.play('lose');
    this.time.delayedCall(1300, () => this.showEnd(false));
  }

  get points() {
    const base = this.totalKills * 100 + Math.floor(this.totalDamage) * 2 + Math.floor(this.totalTime) * 10 + (this.stageId === 'castle' && this.boss && !this.boss.alive ? 5000 : 0);
    return Math.floor(base * this.difficulty.scoreMul);
  }

  submitResult(win) {
    if (this.runSubmission) return this.runSubmission;
    if (this.saveError) return this.runSubmission = Promise.resolve({ error: this.saveError });
    const stats = { kills: this.totalKills, damage: this.totalDamage, duration: this.totalTime, hero: this.charId, level: this.player.level, victory: win };
    this.runSubmission = Promise.resolve(this.runStart).then(run => {
      if (run?.error) return { error: run.error };
      if (!run?.run_id) return { saved: false, ranked: false };
      return GamePortal.finishRun({ run_id: run.run_id, ...stats });
    }).catch(error => ({ error: 'Não foi possível salvar o resultado: ' + error.message }));
    return this.runSubmission;
  }

  showEnd(win) {
    const submission = this.submitResult(win);
    this.scene.launch('End', {
      win, time: this.totalTime, stage: this.stageId, startStage: this.startStageId, level: this.player.level, kills: this.totalKills, damage: this.totalDamage, points: this.points, practice: this.isPractice, submission, char: this.charId, difficulty: this.difficultyId,
      powers: this.player.powers.map((w) => ({ icon: w.def.icon, name: w.def.name, level: w.level })),
    });
    this.scene.pause();
  }

  // ---------------------------------------------------------- entrada
  readInput() {
    if (this.botInput) return this.botInput;
    const K = this.keys;
    let x = 0, y = 0;
    if (K.A.isDown || K.LEFT.isDown) x -= 1;
    if (K.D.isDown || K.RIGHT.isDown) x += 1;
    if (K.W.isDown || K.UP.isDown) y -= 1;
    if (K.S.isDown || K.DOWN.isDown) y += 1;
    if (this.joy.active) { x += this.joy.x; y += this.joy.y; }
    const dash = Phaser.Input.Keyboard.JustDown(K.SHIFT) || Phaser.Input.Keyboard.JustDown(K.SPACE) || this.requestDash;
    this.requestDash = false;
    const interact = Phaser.Input.Keyboard.JustDown(K.E) || Phaser.Input.Keyboard.JustDown(K.ENTER);
    return { x, y, dash, interact };
  }

  // ---------------------------------------------------------- loop principal
  update(time, delta) {
    if (!this.gameReady || this.transitioning) return;
    const dt = Math.min(delta / 1000, 0.05);
    this.visualTime += dt;
    this.drawJoystick();
    if (this.ended) { this.fx.update(dt); this.world.update(dt, this.visualTime); return; }
    const input = this.readInput();
    if (input.interact) { this.enterCastle(); if (this.transitioning) return; }
    // A travessia segura após o chefe não gera pontuação de sobrevivência.
    if (!this.stageCleared) this.t += dt;

    // Grade espacial com todos os alvos (inimigos + chefe)
    this.grid.clear();
    for (const e of this.enemies.pool) if (e.alive) this.grid.insert(e);
    if (this.boss && this.boss.alive) this.grid.insert(this.boss);

    this.player.update(dt, input, this.world);
    this.enemies.update(dt);
    this.encounters.update(dt);
    if (this.boss) this.boss.update(dt);
    this.pShots.update(dt);
    this.enemyShots.update(dt);
    this.gems.update(dt);
    this.updateHazards(dt);
    this.fx.update(dt);
    this.world.update(dt, this.visualTime);

    if (!this.bossStarted && this.t >= this.bossTime) this.startBossFight();
    this.progression.update(dt);
    if (this.pendingLevels > 0 && !this.player.dead && !this.ended) this.openLevelUp();
  }

  drawJoystick() {
    const g = this.joyG;
    g.clear();
    if (!this.joy.active) return;
    g.lineStyle(3, 0xffffff, 0.35); g.strokeCircle(this.joy.ox, this.joy.oy, 60);
    g.fillStyle(0xffffff, 0.3); g.fillCircle(this.joy.ox + this.joy.x * 60, this.joy.oy + this.joy.y * 60, 24);
  }
}
