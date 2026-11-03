// Chest rewards and transformations. No timers advance while a reward menu is open.
class ProgressionSystem {
  constructor(scene) {
    this.scene = scene; this.chests = []; this.consumed = new Set(); this.completed = new Set(); this.supplemental = new Set();
  }
  canOfferPower(id) { return !!POWERS[id] && POWERS[id].obtainable !== false && !this.consumed.has(id); }
  eligible(recipe) {
    const p = this.scene.player;
    if (!recipe || this.scene.t < 300 || this.completed.has(recipe.id)) return false;
    if (recipe.passive && !(p.passives[recipe.passive] >= 1)) return false;
    if (recipe.kind === 'dash') return p.dashLevel >= 3 && !p.smokeDash;
    return !p.hasPower(recipe.result) && recipe.ingredients.every(id => { const w = p.hasPower(id); return w && w.maxed; });
  }
  getOffers(canEvolve = true) {
    const offers = canEvolve ? PROGRESSION_RECIPES.filter(r => this.eligible(r)).slice(0, 3).map(r => ({ type: 'evolution', id: r.id, key: 'e:' + r.id })) : [];
    const keys = new Set(offers.map(o => o.key));
    // rollChoices knows current slots and passive caps. Filter defensively for callers
    // that still use an older choice roller.
    for (let attempt = 0; offers.length < 3 && attempt < 4; attempt++) {
      for (const o of this.scene.rollChoices()) {
        if (offers.length >= 3) break;
        if (o.type === 'new' && !this.canOfferPower(o.id)) continue;
        const key = o.key || o.type + ':' + (o.id || '');
        if (keys.has(key)) continue;
        keys.add(key); offers.push(o);
      }
    }
    if (!offers.length) offers.push({ type: 'heal', key: 'heal' });
    return offers;
  }
  applyRecipe(id) {
    const recipe = PROGRESSION_RECIPES.find(r => r.id === id);
    if (!this.eligible(recipe)) return false;
    const p = this.scene.player;
    if (recipe.kind === 'dash') {
      if (typeof p.enableSmokeDash !== 'function') return false;
      p.enableSmokeDash();
    } else {
      const ingredients = p.powers.filter(w => recipe.ingredients.includes(w.def.id));
      for (const w of ingredients) w.destroy();
      p.powers = p.powers.filter(w => !recipe.ingredients.includes(w.def.id));
      for (const base of recipe.ingredients) this.consumed.add(base);
      p.addPower(recipe.result);
    }
    this.completed.add(id); return true;
  }
  dropChest(x, y, canEvolve = true) {
    if (this.chests.length >= 8 || this.scene.ended) return null;
    const sc = this.scene, radius = sc.player.radius;
    // Use player clearance so the pickup position is walkable, including arena locks.
    // Recheck after obstacle pushes: a push near a wall can leave the map again.
    const candidates = [{ x, y }, { x: sc.player.x, y: sc.player.y }];
    let position = null;
    for (const candidate of candidates) {
      const point = { ...candidate, radius };
      for (let attempt = 0; attempt < 16; attempt++) {
        const previous = { x: point.x, y: point.y };
        sc.world.constrain(point);
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < .01) {
          const blocked = !sc.world.arenaLock && sc.world.solids.query(point.x, point.y, radius, []).some(o => Math.hypot(point.x - o.x, point.y - o.y) < radius + o.radius - .01);
          if (!blocked) position = point;
          break;
        }
      }
      if (position) break;
    }
    if (!position) return null; // Undelivered supplies retry on the next update.
    ({ x, y } = position);
    const sprite = sc.add.image(x, y, 'progression_chest').setDepth(y + 10);
    const chest = { x, y, canEvolve, sprite }; this.chests.push(chest); return chest;
  }
  update(dt) {
    const sc = this.scene;
    if (sc.levelUpOpen || sc.chestOpen || sc.ended) return;
    for (const t of [180, 420, 720]) if (sc.t >= t && !this.supplemental.has(t)) {
      const p = sc.player;
      if (this.dropChest(p.x + 70, p.y + 20, true)) this.supplemental.add(t);
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.sprite.setScale(1 + Math.sin(sc.t * 4) * 0.06);
      if (Math.hypot(sc.player.x - c.x, sc.player.y - c.y) > 36) continue;
      if (sc.openEvolutionChest(c)) { c.sprite.destroy(); this.chests.splice(i, 1); break; }
    }
  }
  destroy() { for (const c of this.chests) c.sprite.destroy(); this.chests.length = 0; }
}

function drawProgressionAssets(scene) {
  const colors = { axes: '#aebbd0', frost: '#8eeaff', poison: '#8bcc60', soulblade: '#bdf8e0', tempest: '#a4cfff', inferno: '#ff8845', reaper_axes: '#e2bae8', blizzard: '#c3f5ff', miasma: '#b5db67', celestial_ring: '#ffdd81', singularity: '#c393ee', smoke_dash: '#aab6c9' };
  for (const [id, color] of Object.entries(colors)) {
    SPR.make(scene, 'i_' + id, 16, 16, 1, 3, P => {
      P.r(1, 1, 14, 14, '#171323'); P.r(2, 2, 12, 1, '#4b3f61');
      if (id.includes('axes')) { P.line(5, 13, 10, 3, '#8b6849', 2); P.r(5, 3, 7, 4, color); P.r(4, 4, 2, 4, color); P.r(10, 3, 3, 6, color); }
      else if (id === 'frost' || id === 'blizzard') { P.line(8, 3, 8, 13, color); P.line(3, 5, 12, 11, color); P.line(3, 11, 12, 5, color); P.r(7, 6, 3, 4, '#f1ffff'); }
      else if (id === 'poison' || id === 'miasma' || id === 'smoke_dash') { P.disc(6, 8, 3, color); P.disc(10, 7, 3, color); P.disc(9, 11, 3, color); P.p(5, 7, '#f0ffd6'); }
      else if (id === 'soulblade') { P.line(5, 12, 11, 3, color, 2); P.line(4, 9, 9, 12, '#b9904a'); }
      else if (id === 'tempest') { P.line(10, 3, 5, 8, color, 2); P.line(5, 8, 10, 8, color, 2); P.line(10, 8, 6, 13, color, 2); }
      else { P.disc(8, 8, 5, color); P.disc(8, 8, 3, '#24192f'); P.r(7, 2, 2, 3, '#fff2d5'); P.r(7, 11, 2, 3, color); }
    });
    if (['axes', 'reaper_axes', 'celestial_ring'].includes(id)) SPR.make(scene, 'p_' + id, 16, 16, 1, 2, P => {
      if (id === 'celestial_ring') { P.disc(8, 8, 6, color); P.disc(8, 8, 4, '#352542'); P.line(8, 0, 8, 15, '#fff3cc'); P.line(0, 8, 15, 8, '#fff3cc'); return; }
      P.line(4, 13, 11, 2, '#9f7953', 2); P.r(5, 3, 8, 4, color); P.r(3, 4, 3, 5, color); P.r(11, 2, 3, 7, color); P.line(5, 3, 12, 3, '#ffffff');
    });
    if (['poison','inferno','miasma','singularity'].includes(id)) SPR.make(scene, 'fx_' + id, 24, 24, 1, 2, P => {
      P.disc(12, 12, 11, '#251b30'); P.disc(12, 12, 9, color); P.disc(12, 12, 6, '#302339');
      for (let i = 0; i < 6; i++) P.disc(12 + Math.round(Math.cos(i) * 8), 12 + Math.round(Math.sin(i) * 8), 2, color);
    });
  }
  SPR.make(scene, 'progression_chest', 20, 16, 1, 2, P => {
    P.r(2, 5, 16, 10, '#1c1426'); P.r(3, 6, 14, 8, '#65435e'); P.r(4, 3, 12, 4, '#9c6c6b');
    P.r(3, 7, 14, 2, '#d6ac61'); P.r(5, 4, 2, 10, '#bd9857'); P.r(13, 4, 2, 10, '#bd9857');
    P.r(8, 7, 4, 5, '#edce83'); P.r(9, 8, 2, 2, '#35263f');
  });
}
