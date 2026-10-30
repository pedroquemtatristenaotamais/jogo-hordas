// ============================================================
//  PLAYER — movimento, atributos, vida, XP e poderes adquiridos.
// ============================================================
class Player {
  constructor(scene, charDef, x, y) {
    this.scene = scene;
    this.def = charDef;
    this.x = x; this.y = y;
    this.radius = CONFIG.player.radius;

    this.shadow = scene.add.image(x, y + 20, 'shadow').setAlpha(0.8);
    this.sprite = scene.add.sprite(x, y, 'c_' + charDef.id, 0);
    this.sprite.play('walk_' + charDef.id);
    this.sprite.anims.pause();

    // Atributos
    this.maxHp = charDef.hp;
    this.hp = this.maxHp;
    this.baseSpeed = charDef.speed;
    this.mods = { damage: 1, speed: 1, rate: 1, range: 1, area: 1 };
    this.level = 1;
    this.xp = 0;
    this.xpNext = CONFIG.xpNeeded(1);
    this.invuln = 0;
    this.flash = 0;
    this.pulse = 0;
    this.dead = false;

    this.powers = [];          // instâncias de PowerInstance
    this.passives = {};        // id -> nível
    this.aim = { x: 1, y: 0 }; // última direção de movimento
    this.moving = false;
    this.kills = 0;
  }

  get speed() { return this.baseSpeed * this.mods.speed; }

  update(dt, input, world) {
    if (this.dead) return;
    let vx = input.x, vy = input.y;
    const len = Math.hypot(vx, vy);
    this.moving = len > 0.05;
    if (this.moving) {
      vx /= len; vy /= len;
      this.aim.x = vx; this.aim.y = vy;
      this.x += vx * this.speed * dt;
      this.y += vy * this.speed * dt;
      if (Math.abs(vx) > 0.1) this.sprite.setFlipX(vx < 0);
      if (!this.sprite.anims.isPlaying) this.sprite.anims.resume();
    } else if (this.sprite.anims.isPlaying) {
      this.sprite.anims.pause(); this.sprite.setFrame(0);
    }
    world.constrain(this);

    this.invuln -= dt;
    this.flash -= dt;
    this.sprite.setPosition(this.x, this.y);
    this.sprite.setDepth(this.y + 20);
    this.pulse = Math.max(0, this.pulse - dt * 0.9);
    this.sprite.setScale(1 + this.pulse, 1 - this.pulse * 0.6);
    this.shadow.setPosition(this.x, this.y + 20).setDepth(this.y - 1);
    // Pisca quando invulnerável / flash vermelho ao levar dano
    if (this.flash > 0) this.sprite.setTintFill(0xff4040);
    else { this.sprite.clearTint(); }
    this.sprite.setAlpha(this.invuln > 0 ? (Math.floor(this.invuln * 20) % 2 ? 0.4 : 1) : 1);

    for (const p of this.powers) p.update(dt);
  }

  takeDamage(n) {
    if (this.dead || this.invuln > 0) return false;
    if (this.scene.godMode) return false;
    this.hp -= n;
    this.invuln = CONFIG.player.invuln;
    this.flash = 0.12;
    this.scene.fx.number(this.x, this.y - 30, Math.round(n), '#ff6a6a', true);
    this.scene.fx.burst('blood', this.x, this.y, 8);
    this.scene.cameras.main.shake(110, 0.004);
    Sfx.play('hurt');
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.scene.onPlayerDeath(); }
    return true;
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.scene.fx.number(this.x, this.y - 30, '+' + Math.round(n), '#7aff9a', false);
  }

  gainXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = CONFIG.xpNeeded(this.level);
      this.scene.queueLevelUp();
    }
  }

  hasPower(id) { return this.powers.find((p) => p.def.id === id); }

  addPower(id) {
    const ex = this.hasPower(id);
    if (ex) { ex.levelUp(); return ex; }
    const inst = new PowerInstance(this.scene, this, POWERS[id]);
    this.powers.push(inst);
    return inst;
  }

  addPassive(id) {
    const def = PASSIVES.find((p) => p.id === id);
    def.apply(this);
    this.passives[id] = (this.passives[id] || 0) + 1;
  }

  // Remove tudo (reinício limpo)
  destroy() {
    for (const p of this.powers) p.destroy();
    this.powers.length = 0;
    this.sprite.destroy(); this.shadow.destroy();
  }
}
