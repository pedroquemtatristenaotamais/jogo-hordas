// A sobreposição tem câmera própria: o zoom do mundo não desloca as barras.
class FinaleOverlayScene extends Phaser.Scene {
  constructor() { super('FinaleOverlay'); }
  create() {
    this.add.rectangle(CONFIG.width / 2, 21, CONFIG.width, 42, 0x000000);
    this.add.rectangle(CONFIG.width / 2, CONFIG.height - 21, CONFIG.width, 42, 0x000000);
    this.caption = mkText(this, CONFIG.width / 2, CONFIG.height - 66, 'O SILÊNCIO NÃO ERA O FIM.', 19, '#dec9a6').setOrigin(.5);
  }
}

// Desfecho do castelo: o mesmo círculo ritual se rompe sob os pés do herói.
class CastleFinale {
  constructor(scene, onComplete) {
    this.scene = scene; this.onComplete = onComplete; this.elapsed = 0;
    this.opening = 0; this.complete = false; this.sparkClock = 0;
    const A = CONFIG.arena, p = scene.player;
    this.A = A; this.start = { x: p.x, y: p.y };
    this.cracks = scene.add.graphics().setDepth(-5006);
    this.void = scene.add.graphics().setDepth(-5005);
    this.rim = scene.add.graphics().setDepth(-5002);
    this.maskShape = scene.make.graphics({ x: 0, y: 0, add: false });
    this.mask = this.maskShape.createGeometryMask();
    SPR.canvas(scene, 'finale_lava', 256, 256, ctx => {
      const rng = mulberry32(0x1af103);
      ctx.fillStyle = '#5f160e'; ctx.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 2) for (let x = 0; x < 256; x += 2) {
        const wave = Math.sin(x * .13 + Math.sin(y * .08) * 2.8) + Math.cos(y * .17 - x * .035);
        ctx.fillStyle = wave > 1.35 ? '#ffce61' : wave > .8 ? '#ff922c' : wave > .15 ? '#d64c13' : wave > -.6 ? '#992b0e' : '#39100e';
        ctx.fillRect(x, y, 2, 2);
        if (rng() < .015) { ctx.fillStyle = '#ffe3a0'; ctx.fillRect(x, y, 1, 1); }
      }
    });
    this.lava = scene.add.tileSprite(A.x, A.y, A.r * 2, A.r * 2, 'finale_lava')
      .setTileScale(4).setDepth(-5004).setMask(this.mask).setVisible(false);
    this.heat = scene.add.image(A.x, A.y, 'glow').setTint(0xff7d20).setScale(9).setAlpha(0)
      .setDepth(-5001).setBlendMode(Phaser.BlendModes.ADD);
    scene.scene.launch('FinaleOverlay');
    this.overlay = scene.scene.get('FinaleOverlay');
    this.paths = [];
    const rng = mulberry32(CONFIG.seed ^ 0xf1ae);
    for (let i = 0; i < 18; i++) {
      const angle = i / 18 * Math.PI * 2, points = [{ x: A.x, y: A.y }];
      for (let j = 1; j <= 11; j++) {
        const r = j / 11 * A.r, a = angle + (rng() - .5) * .16;
        points.push({ x: Math.round((A.x + Math.cos(a) * r) / 4) * 4, y: Math.round((A.y + Math.sin(a) * r) / 4) * 4 });
      }
      this.paths.push(points);
    }
    scene.cameras.main.stopFollow();
    scene.cameras.main.pan(A.x, A.y, 1500, 'Sine.easeInOut');
    scene.cameras.main.zoomTo(.6, 1600);
    scene.cameras.main.shake(1800, .0018);
    p.sprite.clearTint().setAlpha(1).setAngle(0);
    scene.events.once('shutdown', () => { scene.scene.stop('FinaleOverlay'); this.mask.destroy(); this.maskShape.destroy(); });
  }

  polygon(g, radius) {
    const A = this.A;
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * Math.PI * 2, r = radius * (1 + .028 * Math.sin(i * 3.7));
      const x = Math.round((A.x + Math.cos(a) * r) / 4) * 4, y = Math.round((A.y + Math.sin(a) * r) / 4) * 4;
      if (!i) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  update(dt) {
    if (this.complete) return;
    this.elapsed += dt;
    const t = this.elapsed, A = this.A, sc = this.scene, p = sc.player;
    const crackProgress = clamp((t - 1.2) / 3.5, 0, 1);
    this.cracks.clear();
    for (const path of this.paths) {
      const count = Math.floor(crackProgress * (path.length - 1));
      if (!count) continue;
      for (const [w, color, alpha] of [[16, 0x11090b, 1], [7, 0xa52d11, .9], [3, 0xffa844, .9]]) {
        this.cracks.lineStyle(w, color, alpha).beginPath().moveTo(path[0].x, path[0].y);
        for (let i = 1; i <= count; i++) this.cracks.lineTo(path[i].x, path[i].y);
        this.cracks.strokePath();
      }
    }
    this.opening = clamp((t - 4.5) / 2.9, 0, 1) * (A.r - 55);
    this.maskShape.clear(); this.void.clear(); this.rim.clear();
    if (this.opening > 0) {
      this.lava.setVisible(true).setTilePosition(Math.floor(t * 8), -Math.floor(t * 13));
      this.void.fillStyle(0x120809, 1); this.polygon(this.void, this.opening + 24); this.void.fillPath();
      this.maskShape.fillStyle(0xffffff, 1); this.polygon(this.maskShape, this.opening); this.maskShape.fillPath();
      this.rim.lineStyle(18, 0x25110e, 1); this.polygon(this.rim, this.opening + 7); this.rim.strokePath();
      this.rim.lineStyle(5, 0xff7620, .85); this.polygon(this.rim, this.opening); this.rim.strokePath();
      this.heat.setAlpha(.09 + Math.sin(t * 11) * .015).setScale(4 + this.opening / 70);
      this.sparkClock -= dt;
      if (this.sparkClock <= 0) {
        this.sparkClock = .12;
        const a = t * 7.3, r = this.opening * .85;
        sc.fx.burst('fire', A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, 7);
      }
    }
    if (t < 6.8) {
      const approach = clamp((t - 1.5) / 4, 0, 1);
      p.x = this.start.x + (A.x - this.start.x) * approach;
      p.y = this.start.y + (A.y + 35 - this.start.y) * approach;
      if (approach > 0 && approach < 1) p.sprite.anims.resume(); else p.sprite.anims.pause();
      p.sprite.setPosition(p.x, p.y).setDepth(p.y + 20);
      p.shadow.setPosition(p.x, p.y + 20);
    } else {
      const fall = clamp((t - 6.8) / 2.5, 0, 1);
      p.sprite.anims.pause(); p.shadow.setVisible(false);
      p.sprite.setPosition(A.x, A.y + 35 + fall * fall * 150).setScale(1 - fall * .94)
        .setRotation(fall * 1.6).setAlpha(1 - fall * fall).setTint(0xffaf6b);
    }
    if (t > 3.5) this.overlay.caption?.setText(t < 7 ? 'O SELO SE ROMPEU.' : 'SOB A ÚLTIMA MURALHA…');
    if (t > 9.4) this.overlay.caption?.setAlpha(clamp((10.8 - t) / 1.4, 0, 1));
    if (t >= 9.4 && !this.fading) { this.fading = true; sc.cameras.main.fadeOut(1400, 0, 0, 0); }
    if (t >= 11) { this.complete = true; sc.scene.stop('FinaleOverlay'); this.onComplete(); }
  }
}
