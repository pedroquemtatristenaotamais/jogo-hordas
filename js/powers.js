// ============================================================
//  PODERES — estrutura extensível.
//  Para criar um poder novo: adicione a definição em data.js (POWERS)
//  e uma implementação em POWER_IMPL abaixo com init/update/destroy.
//  Estatísticas efetivas passam por inst.dmg(), inst.cd(), inst.range()
//  e inst.area(), que aplicam os modificadores do jogador.
// ============================================================
class PowerInstance {
  constructor(scene, player, def) {
    this.scene = scene; this.player = player; this.def = def;
    this.level = 1;
    this.timer = 0.4;           // primeiro disparo rápido
    this.pending = [];          // eventos atrasados {t, fn}
    this.recompute();
    this.impl = POWER_IMPL[def.id];
    this.state = {};
    if (this.impl.init) this.impl.init(this);
  }
  get maxLevel() { return this.def.upgrades.length + 1; }
  get maxed() { return this.level >= this.maxLevel; }
  nextText() { return this.def.upgrades[this.level - 1] ? this.def.upgrades[this.level - 1].text : ''; }
  recompute() {
    const s = Object.assign({}, this.def.base);
    for (let i = 0; i < this.level - 1; i++) this.def.upgrades[i].apply(s);
    this.s = s;
  }
  levelUp() {
    if (this.maxed) return;
    this.level++;
    this.recompute();
    if (this.impl.onLevel) this.impl.onLevel(this);
  }
  // Valores efetivos
  dmg() { return this.s.damage * this.player.mods.damage; }
  cd() { return this.s.cooldown / this.player.mods.rate; }
  range() { return (this.s.range || 0) * this.player.mods.range; }
  area(v) { return v * this.player.mods.area; }

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i]; e.t -= dt;
      if (e.t <= 0) { this.pending.splice(i, 1); e.fn(); }
    }
    this.impl.update(this, dt);
  }
  after(t, fn) { this.pending.push({ t, fn }); }
  cast() { this.player.pulse = 0.16; }   // pequena "pulsada" no sprite ao atacar
  destroy() { if (this.impl.destroy) this.impl.destroy(this); this.pending.length = 0; }
}

// Utilitários de mira
function nearestEnemies(scene, x, y, r, n) {
  const arr = scene.queryEnemies(x, y, r, scene.tmpA);
  arr.sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2));
  return arr.slice(0, n);
}

// ---------- Projéteis do jogador (pool) ----------
class PlayerShots {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    for (let i = 0; i < CONFIG.maxPlayerShots; i++) {
      const s = scene.add.image(0, 0, 'p_arrow').setVisible(false).setActive(false);
      s.live = false; s.hit = [];
      this.items.push(s);
    }
    this.tmp = [];
  }
  fire(o) {
    // o: {tex, x, y, ang, speed, range, dmg, pierce, radius, explode, depth, powerId, scale}
    for (const s of this.items) {
      if (s.live) continue;
      s.live = true; s.hit.length = 0;
      s.setTexture(o.tex).setPosition(o.x, o.y).setRotation(o.ang).setVisible(true).setActive(true).setScale(o.scale || 1);
      s.setBlendMode(o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      s.vx = Math.cos(o.ang) * o.speed; s.vy = Math.sin(o.ang) * o.speed;
      s.life = o.range / o.speed; s.dmg = o.dmg; s.pierce = o.pierce; s.rad = o.radius;
      s.explode = o.explode || 0; s.kind = o.kind; s.powerId = o.powerId; s.knock = o.knock || 60;
      s.trail = o.trail || null; s.trailTimer = 0;
      s.setDepth(9100);
      return s;
    }
    return null;
  }
  kill(s) { s.live = false; s.setVisible(false).setActive(false); }
  update(dt) {
    const sc = this.scene;
    for (const s of this.items) {
      if (!s.live) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.trail) { s.trailTimer -= dt; if (s.trailTimer <= 0) { sc.fx.burst(s.trail, s.x, s.y, 1); s.trailTimer = 0.035; } }
      let done = s.life <= 0;
      if (!done && sc.world.outside(s.x, s.y)) done = true;
      if (!done) {
        sc.grid.query(s.x, s.y, s.rad, this.tmp);
        for (let i = 0; i < this.tmp.length; i++) {
          const e = this.tmp[i];
          if (s.hit.indexOf(e.uid) >= 0) continue;
          s.hit.push(e.uid);
          if (s.explode) { done = true; break; }
          sc.damageEnemy(e, s.dmg, { x: s.x, y: s.y, knock: s.knock, kind: 'proj' });
          sc.fx.burst('spark', s.x, s.y, 3);
          s.pierce--;
          if (s.pierce <= 0) { done = true; break; }
        }
      }
      if (done) {
        if (s.explode) sc.explodeAt(s.x, s.y, s.explode, s.dmg, 'fire', s.knock);
        this.kill(s);
      }
    }
  }
}

// ---------- Implementações ----------
const POWER_IMPL = {

  // Golpe Giratório: varre 360° ao redor do jogador.
  slash: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      p.timer = p.cd(); p.cast();
      for (let h = 0; h < p.s.hits; h++) p.after(h * 0.22, () => POWER_IMPL.slash.hit(p));
    },
    hit(p) {
      const pl = p.player, sc = p.scene;
      const r = p.range() * Math.max(1, pl.mods.area * 0.8 + 0.2);
      sc.fx.sweep(pl.x, pl.y, r, pl);
      sc.fx.ring(pl.x, pl.y, r * 0.5, r, 0.2, 0xcfe0ff, 3, 0.1);
      const list = sc.queryEnemies(pl.x, pl.y, r, sc.tmpB);
      for (let i = 0; i < list.length; i++) sc.damageEnemy(list[i], p.dmg(), { x: pl.x, y: pl.y, knock: p.s.knock, kind: 'slash' });
      if (list.length) sc.cameras.main.shake(60, 0.0025);
    },
  },

  // Flechas: tiro no inimigo mais próximo.
  arrows: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene, rng = p.range();
      const t = nearestEnemies(sc, pl.x, pl.y, rng, 1)[0];
      if (!t) { p.timer = 0.1; return; }
      p.timer = p.cd(); p.cast();
      const base = Math.atan2(t.y - pl.y, t.x - pl.x);
      const n = p.s.count;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * p.s.spread;
        sc.pShots.fire({ tex: 'p_arrow', x: pl.x, y: pl.y - 6, ang: base + off, speed: p.s.speed, range: rng, dmg: p.dmg(), pierce: p.s.pierce, radius: 8, kind: 'arrow', powerId: 'arrows', knock: 70 });
      }
    },
  },

  // Nova Arcana: escolhe o ponto mais denso, marca e detona.
  arcane: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene, rng = p.range();
      const cands = sc.queryEnemies(pl.x, pl.y, rng, sc.tmpA).slice();
      if (!cands.length) { p.timer = 0.15; return; }
      p.timer = p.cd(); p.cast();
      const radius = p.area(p.s.radius);
      const used = [];
      for (let n = 0; n < p.s.count; n++) {
        // amostra candidatos e escolhe o de maior densidade (que não esteja perto de um alvo já escolhido)
        let best = null, bestScore = -1;
        const tries = Math.min(cands.length, 14);
        for (let i = 0; i < tries; i++) {
          const c = cands[(Math.random() * cands.length) | 0];
          if (used.some((u) => Math.hypot(u.x - c.x, u.y - c.y) < radius * 0.8)) continue;
          const cnt = sc.queryEnemies(c.x, c.y, radius, sc.tmpB).length;
          if (cnt > bestScore) { bestScore = cnt; best = c; }
        }
        if (!best) continue;
        const tx = best.x, ty = best.y; used.push({ x: tx, y: ty });
        const delay = 0.4 + n * 0.12;
        sc.fx.teleCircle(tx, ty, radius, delay, 0xb070ff);
        p.after(delay, () => {
          sc.explodeAt(tx, ty, radius, p.dmg(), 'dark', 120, 0xb070ff);
          sc.fx.ring(tx, ty, radius * 0.3, radius * 1.05, 0.35, 0xe0c0ff, 3, 0);
        });
      }
    },
  },

  // Lâminas Giratórias: orbitam o jogador.
  blades: {
    init(p) { p.state.sprites = []; p.state.ang = 0; POWER_IMPL.blades.sync(p); },
    onLevel(p) { POWER_IMPL.blades.sync(p); },
    sync(p) {
      const sc = p.scene, a = p.state.sprites;
      while (a.length < p.s.count) a.push(sc.add.image(0, 0, 'p_blade').setDepth(9050));
    },
    update(p, dt) {
      const pl = p.player, sc = p.scene, st = p.state;
      st.ang += p.s.speed * dt;
      const n = p.s.count, R = p.s.radius * Math.max(1, pl.mods.range * 0.5 + pl.mods.area * 0.5);
      for (let i = 0; i < n; i++) {
        const a = st.ang + i * Math.PI * 2 / n;
        const x = pl.x + Math.cos(a) * R, y = pl.y + Math.sin(a) * R;
        const s = st.sprites[i];
        s.setPosition(x, y).setRotation(a + Math.PI / 2 + st.ang * 3).setDepth(y + 30);
        const list = sc.grid.query(x, y, 16 * pl.mods.area, sc.tmpC);
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (sc.t - (e.hitT.blades || -9) < p.s.hitCd) continue;
          e.hitT.blades = sc.t;
          sc.damageEnemy(e, p.dmg(), { x: pl.x, y: pl.y, knock: 70, kind: 'blade' });
          sc.fx.burst('spark', x, y, 2);
        }
      }
    },
    destroy(p) { for (const s of p.state.sprites) s.destroy(); p.state.sprites.length = 0; },
  },

  // Relâmpago: atinge alvos e salta entre próximos.
  lightning: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene, rng = p.range();
      const cands = sc.queryEnemies(pl.x, pl.y, rng, sc.tmpA).slice();
      if (!cands.length) { p.timer = 0.12; return; }
      p.timer = p.cd(); p.cast();
      const hitSet = [];
      for (let k = 0; k < p.s.targets; k++) {
        const pool = cands.filter((c) => hitSet.indexOf(c.uid) < 0 && c.alive);
        if (!pool.length) break;
        let cur = pool[(Math.random() * pool.length) | 0];
        let fx = pl.x, fy = pl.y - 20;
        for (let j = 0; j <= p.s.chains && cur; j++) {
          hitSet.push(cur.uid);
          sc.fx.bolt(fx, fy, cur.x, cur.y - 10, 0.16, 0xaee0ff);
          sc.fx.burst('spark', cur.x, cur.y, 4);
          sc.damageEnemy(cur, p.dmg(), { x: fx, y: fy, knock: 30, kind: 'lightning' });
          fx = cur.x; fy = cur.y - 10;
          // próximo alvo: mais próximo ainda não atingido
          const near = sc.queryEnemies(cur.x, cur.y, p.area(p.s.chainRange), sc.tmpB);
          let nx = null, nd = 1e9;
          for (let i = 0; i < near.length; i++) {
            const e = near[i];
            if (hitSet.indexOf(e.uid) >= 0 || !e.alive) continue;
            const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
            if (d < nd) { nd = d; nx = e; }
          }
          cur = nx;
        }
      }
    },
  },

  // Bola de Fogo: projétil explosivo.
  fireball: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene, rng = p.range();
      const ts = nearestEnemies(sc, pl.x, pl.y, rng, p.s.count);
      if (!ts.length) { p.timer = 0.12; return; }
      p.timer = p.cd(); p.cast();
      for (let i = 0; i < p.s.count; i++) {
        const t = ts[i % ts.length];
        const ang = Math.atan2(t.y - pl.y, t.x - pl.x) + (ts.length < p.s.count ? (i - (p.s.count - 1) / 2) * 0.18 : 0);
        const dist = Math.min(rng, Math.hypot(t.x - pl.x, t.y - pl.y) + 60);
        sc.pShots.fire({ tex: 'p_fire', x: pl.x, y: pl.y - 6, ang, speed: p.s.speed, range: dist, dmg: p.dmg(), pierce: 1, radius: 10, explode: p.area(p.s.radius), kind: 'fire', powerId: 'fireball', add: true, trail: 'fire', knock: 140 });
      }
    },
  },

  // Orbes Mágicos: orbitam no sentido contrário, com empurrão.
  orbs: {
    init(p) { p.state.sprites = []; p.state.ang = 0; POWER_IMPL.orbs.sync(p); },
    onLevel(p) { POWER_IMPL.orbs.sync(p); },
    sync(p) {
      const sc = p.scene, a = p.state.sprites;
      while (a.length < p.s.count) a.push(sc.add.image(0, 0, 'p_orb').setDepth(9050).setBlendMode(Phaser.BlendModes.ADD));
    },
    update(p, dt) {
      const pl = p.player, sc = p.scene, st = p.state;
      st.ang += p.s.speed * dt;
      const n = p.s.count, R = p.s.radius * Math.max(1, pl.mods.range * 0.5 + pl.mods.area * 0.5);
      for (let i = 0; i < n; i++) {
        const a = st.ang + i * Math.PI * 2 / n;
        const x = pl.x + Math.cos(a) * R, y = pl.y + Math.sin(a) * R;
        const s = st.sprites[i];
        const pulse = 1 + Math.sin(sc.t * 6 + i) * 0.12;
        s.setPosition(x, y).setScale(pulse * pl.mods.area).setDepth(y + 30);
        const list = sc.grid.query(x, y, 15 * pl.mods.area, sc.tmpC);
        for (let j = 0; j < list.length; j++) {
          const e = list[j];
          if (sc.t - (e.hitT.orbs || -9) < p.s.hitCd) continue;
          e.hitT.orbs = sc.t;
          sc.damageEnemy(e, p.dmg(), { x: pl.x, y: pl.y, knock: p.s.knock, kind: 'orb' });
          sc.fx.burst('spark', x, y, 2);
        }
      }
    },
    destroy(p) { for (const s of p.state.sprites) s.destroy(); p.state.sprites.length = 0; },
  },

  // Projétil Perfurante: escolhe a linha com mais inimigos.
  pierce: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene, rng = p.range();
      const cands = sc.queryEnemies(pl.x, pl.y, rng, sc.tmpA);
      if (!cands.length) { p.timer = 0.12; return; }
      p.timer = p.cd(); p.cast();
      // testa 16 direções e escolhe a que atravessa mais inimigos
      let bestAng = 0, bestN = -1;
      for (let d = 0; d < 16; d++) {
        const a = d * Math.PI / 8 + Math.random() * 0.1;
        const dx = Math.cos(a), dy = Math.sin(a);
        let n = 0;
        for (let i = 0; i < cands.length; i++) {
          const e = cands[i];
          const ex = e.x - pl.x, ey = e.y - pl.y;
          const along = ex * dx + ey * dy;
          if (along < 0) continue;
          const perp = Math.abs(ex * dy - ey * dx);
          if (perp < 26 + e.radius) n++;
        }
        if (n > bestN) { bestN = n; bestAng = a; }
      }
      const n = p.s.count;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.16;
        sc.pShots.fire({ tex: 'p_pierce', x: pl.x, y: pl.y - 6, ang: bestAng + off, speed: p.s.speed, range: rng, dmg: p.dmg(), pierce: p.s.pierce, radius: 12, kind: 'pierce', powerId: 'pierce', add: true, trail: 'spark', knock: 90 });
      }
    },
  },

  // Explosão de Energia: pulso ao redor do jogador.
  burst: {
    update(p, dt) {
      p.timer -= dt;
      if (p.timer > 0) return;
      const pl = p.player, sc = p.scene;
      const r = p.area(p.s.radius);
      // só dispara se houver inimigos por perto (economiza efeitos)
      if (sc.queryEnemies(pl.x, pl.y, r * 1.15, sc.tmpA).length === 0) { p.timer = 0.15; return; }
      p.timer = p.cd(); p.cast();
      for (let k = 0; k < p.s.pulses; k++) {
        p.after(k * 0.3, () => {
          const rr = p.area(p.s.radius);
          sc.fx.ring(pl.x, pl.y, rr * 0.15, rr, 0.35, 0x9ad8ff, 5, 0.22);
          sc.fx.ring(pl.x, pl.y, rr * 0.05, rr * 0.7, 0.25, 0xffffff, 2, 0);
          sc.fx.burst('spark', pl.x, pl.y, 14);
          const list = sc.queryEnemies(pl.x, pl.y, rr, sc.tmpB);
          for (let i = 0; i < list.length; i++) sc.damageEnemy(list[i], p.dmg(), { x: pl.x, y: pl.y, knock: p.s.knock, kind: 'burst' });
          sc.cameras.main.shake(90, 0.003);
        });
      }
    },
  },
};
