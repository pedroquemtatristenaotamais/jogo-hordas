// A dificuldade é uma escolha por partida e acompanha o resultado no servidor.
class DifficultyScene extends Phaser.Scene {
  constructor() { super('Difficulty'); }
  init(data) { this.charId = data.char; }
  create() {
    const W = CONFIG.width;
    menuBackdrop(this);
    this.add.image(W / 2, 360, 'vignette').setDepth(4).setAlpha(0.9);
    mkText(this, W / 2, 64, 'ESCOLHA SEU DESAFIO', 42, '#e6d6a8').setOrigin(0.5).setDepth(10);
    mkText(this, W / 2, 113, '15 minutos • minibosses aos 5 e 10 • Cavaleiro Sombrio aos 15', 18, '#b8acc7').setOrigin(0.5).setDepth(10);
    this.going = false;
    this.ids = Object.keys(DIFFICULTIES);
    this.sel = Math.max(0, this.ids.indexOf(this.registry.get('difficulty') || 'medium'));
    this.cards = this.ids.map((id, i) => {
      const d = DIFFICULTIES[id], x = 175 + i * 310, y = 352;
      const panel = this.add.rectangle(x, y, 280, 370, 0x15111d, 0.97).setStrokeStyle(3, d.color).setDepth(10).setInteractive({ useHandCursor: true });
      const color = '#' + d.color.toString(16).padStart(6, '0');
      mkText(this, x, y - 137, '[ ' + (i + 1) + ' ]', 22, color).setOrigin(0.5).setDepth(11);
      mkText(this, x, y - 84, d.name.toUpperCase(), 29, color).setOrigin(0.5).setDepth(11);
      mkText(this, x, y - 31, d.desc, 17, '#d3c8df', { wordWrap: { width: 242 }, align: 'center' }).setOrigin(0.5, 0).setDepth(11);
      mkText(this, x, y + 100, 'PONTOS ×' + d.scoreMul.toLocaleString('pt-BR'), 21, '#f1d590').setOrigin(0.5).setDepth(11);
      mkText(this, x, y + 143, id === 'hardcore' ? 'SEM TRÉGUA' : 'SELECIONAR', 15, id === 'hardcore' ? '#ff6a67' : '#a59ab7').setOrigin(0.5).setDepth(11);
      panel.on('pointerover', () => this.select(i));
      panel.on('pointerdown', () => { this.select(i); this.confirm(); });
      return panel;
    });
    mkText(this, W / 2, 590, 'Ataques automáticos • SHIFT / ESPAÇO: dash • G: receitas do grimório', 18, '#b8acc7').setOrigin(0.5).setDepth(10);
    mkText(this, W / 2, 636, '← → escolher   •   1 a 4: iniciar   •   ENTER: confirmar   •   ESC: heróis', 17, '#8f829e').setOrigin(0.5).setDepth(10);
    this.input.keyboard.on('keydown-LEFT', () => this.select((this.sel + 3) % 4));
    this.input.keyboard.on('keydown-RIGHT', () => this.select((this.sel + 1) % 4));
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((key, i) => this.input.keyboard.on('keydown-' + key, () => { this.select(i); this.confirm(); }));
    this.input.keyboard.on('keydown-ENTER', () => this.confirm());
    this.input.keyboard.on('keydown-SPACE', () => this.confirm());
    this.input.keyboard.on('keydown-ESC', () => { if (!this.going) this.scene.start('Select'); });
    this.select(this.sel);
    this.cameras.main.fadeIn(250);
  }
  select(i) {
    if (this.going) return;
    this.sel = i;
    this.cards.forEach((card, index) => card.setStrokeStyle(index === i ? 5 : 2, index === i ? 0xffe3a0 : DIFFICULTIES[this.ids[index]].color).setFillStyle(index === i ? 0x2b2035 : 0x15111d));
  }
  confirm() {
    if (this.going) return;
    this.going = true;
    const difficulty = this.ids[this.sel];
    this.registry.set('difficulty', difficulty);
    Sfx.play('ui');
    this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { char: this.charId, difficulty }));
  }
}
