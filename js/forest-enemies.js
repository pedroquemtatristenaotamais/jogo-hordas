// Criaturas da floresta noturna: silhuetas e animações próprias, no mesmo pool.
const FOREST_ENEMY_IDS = Object.freeze([
  'forest_wolf', 'forest_spider', 'forest_wisp', 'forest_bandit',
  'forest_rootling', 'forest_moth', 'forest_druid', 'forest_stalker',
]);

Object.assign(ENEMIES, {
  forest_wolf: {
    stage:'forest', name:'Lobo da Penumbra', kind:'melee', hp:18, speed:88, dmg:6, radius:12, xp:1, from:0, weight:8,
    charge:{range:290,min:95,windup:.55,dur:.4,mul:2.7,cd:4.2,recover:.55,col:0xb2c9aa},
  },
  forest_spider: {
    stage:'forest', name:'Aranha do Brejo', kind:'melee', hp:24, speed:70, dmg:7, radius:12, xp:3, from:40, weight:5, maxAlive:18, poison:true,
    shell:{range:280,radius:40,delay:1.3,dmg:11,cd:5.4,col:0xa1c865,kind:'bone'},
  },
  forest_wisp: {
    stage:'forest', name:'Fogo Errante', kind:'ranged', hp:23, speed:46, dmg:3, radius:11, xp:4, from:75, weight:4, ghost:true, keep:260,
    shot:{type:'magic',cd:3.2,range:440,count:1,speed:145,tint:0x98efc7,slow:.5},
  },
  forest_bandit: {
    stage:'forest', name:'Saqueador Perdido', kind:'melee', hp:38, speed:62, dmg:10, radius:13, xp:4, from:95, weight:5,
    sweep:{range:95,windup:.7,cd:4.4,half:.6,dmg:13,col:0xd9b57e},
  },
  forest_rootling: {
    stage:'forest', name:'Raiz Retorcida', kind:'melee', hp:105, speed:34, dmg:12, radius:18, xp:7, from:150, weight:3.5, maxAlive:14, kb:.3,
    shell:{range:230,radius:46,delay:1.45,dmg:14,cd:6.2,col:0xb5b97c,kind:'bone'},
  },
  forest_moth: {
    stage:'forest', name:'Mariposa Fúnebre', kind:'flyer', hp:10, speed:105, dmg:5, radius:10, xp:2, from:20, weight:6, fly:true,
  },
  forest_druid: {
    stage:'forest', name:'Druida Corrompido', kind:'summoner', hp:94, speed:43, dmg:5, radius:14, xp:11, from:230, weight:2.5, maxAlive:4, keep:300,
    shot:{type:'dark',cd:4,range:480,count:3,spread:.25,speed:155,tint:0xa9ce80},
    summon:{type:'forest_rootling',count:1,cd:9},
  },
  forest_stalker: {
    stage:'forest', name:'Espreitador dos Galhos', kind:'melee', hp:145, speed:77, dmg:17, radius:17, xp:12, from:340, weight:2.5, maxAlive:8, kb:.45, ambush:true,
    charge:{range:510,min:120,windup:.85,dur:.55,mul:4,cd:5.2,recover:.95,col:0xc7c2a1},
  },
  forest_matriarch: {
    stage:'forest', name:'Matriarca do Brejo', kind:'caster', hp:1300, speed:55, dmg:20, radius:30, xp:0, from:Infinity, weight:0, keep:220, kb:.15, poison:true,
    shell:{range:680,radius:70,delay:1.35,dmg:22,cd:3.2,col:0xc3d170,kind:'bone'},
    shot:{type:'magic',cd:3.5,range:620,count:3,spread:.28,speed:170,tint:0xb6d780,slow:.7},
    summon:{type:'forest_spider',count:2,cd:11},
  },
  forest_huntsman: {
    stage:'forest', name:'Caçador Sem Sepultura', kind:'melee', hp:2700, speed:68, dmg:26, radius:31, xp:0, from:Infinity, weight:0, kb:.1,
    shot:{type:'bolt',cd:3.9,range:680,count:3,spread:.22,speed:240,tint:0xdcc49a},
    sweep:{range:160,windup:.95,cd:4.5,half:.7,dmg:27,col:0xdac39b},
    charge:{range:620,min:150,windup:1,dur:.65,mul:4,cd:6,recover:1.1,col:0xdac39b},
  },
});

const FOREST_EVENTS = Object.freeze([
  {t:50,type:'swarm',enemy:'forest_moth',count:16,msg:'As mariposas cobrem a lua!'},
  {t:120,type:'pack',list:{forest_wolf:12,forest_bandit:4},msg:'Uivos entre as árvores!'},
  {t:195,type:'ring',enemy:'forest_spider',count:18,msg:'O brejo se move ao seu redor!'},
  {t:270,type:'pack',list:{forest_rootling:8,forest_wisp:6},msg:'As raízes despertam!'},
  {t:375,type:'pack',list:{forest_druid:2,forest_bandit:8,forest_wolf:8},msg:'O círculo dos druidas se fecha!'},
  {t:465,type:'swarm',enemy:'forest_stalker',count:8,msg:'Algo caça nas sombras!'},
  {t:560,type:'ring',enemy:'forest_moth',count:24,msg:'Uma nuvem de asas fúnebres!'},
  {t:675,type:'pack',list:{forest_rootling:10,forest_druid:2,forest_spider:10},msg:'A floresta defende seu coração!'},
  {t:790,type:'pack',list:{forest_stalker:6,forest_wolf:14,forest_wisp:6},msg:'A última caçada começou!'},
]);

function drawForestWolf(P, frame) {
  const step=[0,1,0,-1][frame], bob=frame%2;
  const ink='#111e25', fur='#64717b', shade='#394b59', light='#a2afb1';
  P.shadow(12,21,21);
  // Cauda, quatro patas e dorso baixo deixam o quadrúpede legível.
  P.line(5,13+bob,1,9+bob,ink,3); P.line(5,13+bob,1,10+bob,shade,2);
  for(const [x,off] of [[5,-step],[10,step],[15,step],[19,-step]]) {
    P.r(x+off,15,2,5,ink); P.r(x+off,16,1,4,shade); P.r(x+off-1,20,3,1,light);
  }
  P.r(4,10+bob,15,7,ink); P.r(5,10+bob,13,5,fur); P.r(5,14+bob,12,2,shade);
  P.r(6,9+bob,7,1,light); P.r(7,11+bob,6,1,light); P.r(9,13+bob,5,1,shade);
  P.r(16,7+bob,5,8,ink); P.r(17,8+bob,4,5,fur); P.r(19,11+bob,4,3,ink); P.r(20,11+bob,3,2,light);
  P.line(16,8+bob,16,3+bob,ink,2); P.line(19,8+bob,20,4+bob,ink,2);
  P.p(17,5+bob,'#9b7974'); P.p(20,6+bob,'#9b7974'); P.p(20,9+bob,'#e4e9a0');
  P.r(19,13+bob,3,1,'#18232b'); P.p(20,14+bob,'#e4e7cf'); P.p(22,11+bob,'#111c24');
  P.p(4,12+bob,light); P.p(15,10+bob,light);
}

function drawForestSpider(P, frame) {
  const step=[0,1,0,-1][frame], ink='#101d20', shell='#384c40', hi='#85956b';
  P.shadow(12,21,19);
  for(let i=0;i<4;i++) {
    const y=9+i*3, foot=5+i*5+(i%2?step:-step);
    for(const side of [-1,1]) {
      const root=12+side*4, knee=12+side*(8+i%2), end=12+side*11;
      P.line(root,y,knee,y-3,ink,2); P.line(knee,y-3,end,Math.min(21,foot),ink,2);
      P.line(root,y,knee,y-3,hi); P.line(knee,y-2,end,Math.min(21,foot),shell);
    }
  }
  P.disc(12,13,6,ink); P.disc(12,12,5,shell); P.disc(11,10,3,'#5a704f');
  P.r(10,10,4,1,hi); P.r(11,12,2,3,'#a7c773'); P.p(12,15,'#c7d689');
  P.r(8,5,8,5,ink); P.r(9,5,6,4,shell); P.p(10,6,'#e2de9b'); P.p(13,6,'#e2de9b');
  P.p(11,5,'#e2de9b'); P.p(14,7,'#c1c990'); P.line(9,9,8,11,'#c8c5a1'); P.line(14,9,15,11,'#c8c5a1');
}

function drawForestWisp(P, frame) {
  const bob=[0,-1,0,1][frame], ink='#22484f', edge='#447b78', glow='#8ccbb4', core='#d5f4cd';
  // Chama assimétrica, sem robe ou cabeça humana.
  P.shadow(12,22,10); P.line(11,16+bob,7+(frame%2),21,ink,2); P.line(12,17+bob,15,20,edge);
  P.line(9,8+bob,8+(frame%2)*2,2,edge,2); P.line(13,7+bob,17,3+bob,ink,2); P.p(18,2+bob,glow);
  P.disc(12,12+bob,6,ink); P.disc(12,11+bob,5,edge); P.disc(11,11+bob,3,glow);
  P.r(10,8+bob,3,6,core); P.r(9,10+bob,5,2,core); P.p(10,8+bob,'#f4ffe9');
  P.p(15,13+bob,glow); P.p(5,11+frame,'#6aa398'); P.p(19,15-frame,glow);
  P.line(6,17+bob,4,19,edge); P.p(3,20,glow);
}

function drawForestBandit(P, frame) {
  const step=[0,1,0,-1][frame], bob=frame%2, ink='#161c24', coat='#725b4a', skin='#b5a38a';
  P.shadow(12,22,15);
  for(const [x,off] of [[8,step],[13,-step]]) { P.r(x,16,3,5,ink); P.r(x,18,2,2,'#4e5147'); P.r(x-1,20+off,4,2,'#293338'); }
  P.r(6,10+bob,12,8,ink); P.r(7,10+bob,10,7,coat); P.r(8,11+bob,2,5,'#9a7b55');
  P.r(11,10+bob,2,7,'#343b3a'); P.line(8,10+bob,15,16+bob,'#b39b73'); P.r(7,16+bob,10,2,'#383c35'); P.p(12,16+bob,'#cbb385');
  P.r(5,11+bob,2,6,ink); P.r(5,12+bob,1,4,coat); P.r(5,16+bob,2,2,skin);
  P.r(17,11+bob,2,5,ink); P.r(17,12+bob,1,3,coat); P.r(18,15+bob,2,2,skin);
  P.r(8,4+bob,8,6,ink); P.r(9,5+bob,6,4,skin); P.r(8,3+bob,8,3,'#323b39'); P.r(9,3+bob,6,1,'#586153');
  P.r(9,9+bob,6,2,'#563f35'); P.p(10,7+bob,ink); P.p(14,7+bob,ink); P.p(14,5+bob,'#795747');
  P.r(7,10+bob,10,1,'#894d45'); P.r(6,10+bob,2,4,'#894d45');
  // Machado curto de lenhador e bolsa na cintura, sem capuz.
  P.r(20,8+bob,1,13,'#936e45'); P.r(19,6+bob,4,5,'#344550'); P.r(21,6+bob,2,4,'#a3b0ad'); P.r(22,7+bob,1,3,'#d6dac1');
  P.r(7,17+bob,3,3,'#98794f'); P.p(8,17+bob,'#c5a76f');
}

function drawForestRootling(P, frame) {
  const step=[0,1,0,-1][frame], ink='#172426', bark='#665c45', ridge='#a5986b', moss='#71815b';
  P.shadow(12,22,22);
  for(const [x,off] of [[7,step],[14,-step]]) { P.line(x,16,x-2+off,22,ink,3); P.line(x,17,x-2+off,21,bark,2); P.line(x-2+off,21,x-5+off,22,ridge); }
  P.r(6,7,13,12,ink); P.r(7,7,11,10,bark); P.r(8,7,2,10,ridge); P.r(15,8,2,10,'#464b3d');
  P.line(12,8,11,12,'#393d32'); P.line(11,12,14,17,'#393d32'); P.line(8,15,12,15,'#baa775');
  P.line(7,10,3,15+step,ink,4); P.line(4,15+step,1,19+step,ink,3); P.line(7,10,3,15+step,bark,2); P.line(4,15+step,1,19+step,ridge);
  P.line(18,9,21,13-step,ink,3); P.line(21,13-step,22,19-step,bark,2); P.line(21,17-step,19,21-step,ridge);
  P.line(8,8,6,2,ink,3); P.line(7,5,3,3,bark,2); P.line(6,2,9,1,ridge);
  P.line(15,8,17,2,bark,3); P.line(17,4,21,1,ridge); P.line(17,4,16,0,ridge);
  P.r(9,10,7,3,'#242f2b'); P.p(10,11,'#d4e0a2'); P.p(14,11,'#d4e0a2'); P.r(11,15,3,2,'#242f2b');
  P.r(6,7,5,2,moss); P.r(16,7,4,2,moss); P.p(7,6,'#a5ac73'); P.p(17,16,moss);
}

function drawForestMoth(P, frame) {
  const wing=[0,2,4,2][frame], ink='#1d2830', edge='#8b897b', pale='#c2c0a0', dark='#646b68';
  P.shadow(12,22,11);
  for(const side of [-1,1]) {
    const g=P.g;g.save();if(side===-1){g.translate(24,0);g.scale(-1,1);}
    P.line(11,9,3+wing,3,ink,3); P.r(2+wing,4,9-wing,9,ink); P.r(3+wing,5,7-wing,7,edge);
    P.line(4+wing,5,10,10,pale,2); P.r(4+wing,10,5-wing,3,dark);
    P.line(11,12,5+wing,18,ink,3); P.r(5+wing,13,6-wing,6,edge); P.r(7+wing,14,3,3,pale);
    P.disc(6+wing/2,8,2,dark); P.p(6+wing/2,8,pale); P.p(4+wing,6,'#e3dfbe');
    g.restore();
  }
  P.r(10,7,4,12,ink); P.r(11,7,2,11,'#a19e83'); P.r(11,10,2,1,'#dad1ae'); P.r(11,14,2,1,'#565f5c');
  P.line(11,7,9,3,'#d8cfaa'); P.line(12,7,14,3,'#d8cfaa'); P.p(11,8,'#e6e9bf');
}

function drawForestDruid(P, frame) {
  const bob=frame%2, step=[0,1,0,-1][frame], ink='#15242a', bark='#534b3b', pale='#b2b897';
  P.shadow(12,22,17);
  // Corpo de galhos e manto de folhas rasgadas, com o rosto de madeira exposto.
  P.line(8,16,7+step,21,ink,3); P.line(14,16,15-step,21,ink,3); P.line(8,17,7+step,21,'#7f7556'); P.line(14,17,15-step,21,'#7f7556');
  P.r(6,10+bob,12,9,ink); P.r(7,10+bob,10,8,'#3b5549'); P.r(7,11+bob,2,7,'#64785b'); P.r(14,12+bob,3,7,'#293e38');
  for(const [x,y] of [[5,11],[7,17],[10,18],[15,18],[17,12]]) {P.r(x,y+bob,2,3,'#637652');P.p(x,y+bob,'#91996b');}
  P.r(9,4+bob,6,7,ink); P.r(10,4+bob,4,7,'#85836a'); P.r(10,5+bob,1,4,pale); P.r(11,7+bob,3,1,'#263d39'); P.p(11,7+bob,'#cde9a8'); P.p(13,7+bob,'#cde9a8');
  P.line(10,5+bob,7,1,bark,2); P.line(8,3,4,2,pale); P.line(8,3,8,0,pale);
  P.line(14,5+bob,17,1,bark,2); P.line(16,3,20,2,pale); P.line(17,1,18,0,pale);
  P.line(7,12+bob,3,15+bob,bark,2); P.p(3,15+bob,pale); P.line(17,12+bob,20,13+bob,bark,2);
  P.line(20,6+bob,20,22,'#8f835b',2); P.line(20,7+bob,17,5+bob,'#b6af79'); P.line(20,7+bob,23,3+bob,'#b6af79');
  P.disc(20,6+bob,2,'#536c50'); P.p(20,5+bob,'#d1e9aa'); P.p(19,7+bob,'#a9c28b');
  P.line(10,11+bob,13,17+bob,'#a29d73'); P.r(11,13+bob,3,2,'#d2d0a0');
}

function drawForestStalker(P, frame) {
  const step=[0,1,0,-1][frame], bob=frame%2, ink='#142129', fur='#45524e', hi='#859081', bone='#bbb99a';
  P.shadow(12,22,21);
  // Dorso curvado, braços longos e mandíbula animal, sem equipamento humano.
  P.line(8,14,5+step,20,ink,4); P.line(14,14,17-step,21,ink,4); P.line(8,14,5+step,20,fur,2); P.line(14,14,17-step,21,fur,2);
  P.r(5+step,20,4,2,bone); P.r(16-step,21,5,1,bone);
  P.r(6,8+bob,12,8,ink); P.r(7,8+bob,10,6,fur); P.line(8,8+bob,13,7+bob,hi,2); P.r(8,10+bob,2,3,hi);
  P.line(7,11+bob,2,16-step,ink,4); P.line(2,16-step,1,20-step,hi,2); P.p(0,21-step,bone); P.p(2,21-step,bone);
  P.line(16,11+bob,21,16+step,ink,3); P.line(21,16+step,22,20+step,fur,2); P.p(21,21+step,bone); P.p(23,21+step,bone);
  P.r(12,5+bob,7,6,ink); P.r(13,5+bob,5,5,hi); P.r(16,8+bob,5,3,ink); P.r(17,8+bob,4,1,bone); P.r(17,10+bob,3,1,bone); P.p(18,7+bob,'#e6dd9d');
  P.line(13,6+bob,10,2,bone,2); P.line(10,2,6,1,bone); P.line(10,2,11,0,bone);
  P.line(16,5+bob,18,1,hi,2); P.line(18,2,22,0,bone); P.p(13,12+bob,'#a5ac8a'); P.r(9,7+bob,2,1,'#738165');
}

function drawForestMatriarch(P, frame) {
  const step=[0,1,0,-1][frame], ink='#122523', shell='#52634c', scar='#a3a577', egg='#c8cf9a';
  P.shadow(12,22,23);
  for(let i=0;i<4;i++) for(const side of [-1,1]) {
    const x=12+side*5, knee=12+side*(9-i%2), foot=12+side*11, y=7+i*3, move=i%2?step:-step;
    P.line(x,y,knee,y-3,ink,2); P.line(knee,y-3,foot,9+i*4+move,ink,2);
    P.line(x,y,knee,y-3,scar); P.line(knee,y-3,foot,9+i*4+move,shell);
  }
  P.disc(12,12,7,ink); P.disc(12,11,6,shell); P.disc(10,10,4,'#74815b');
  for(const [x,y] of [[8,10],[12,8],[15,10],[10,13],[14,14]]) { P.disc(x,y,2,ink); P.disc(x,y,1,egg); P.p(x,y-1,'#e5dfac'); }
  P.line(8,16,10,19,scar,2); P.line(16,16,14,19,scar,2);
  P.r(8,3,8,5,ink); P.r(9,3,6,4,shell); P.r(10,4,4,1,'#e7d892'); P.p(9,5,'#e7d892'); P.p(14,5,'#e7d892');
  P.line(9,6,7,9,egg,2); P.line(14,6,16,9,egg,2); P.r(10,18,4,2,ink); P.p(11,19,'#a9c15d');
}

function drawForestHuntsman(P, frame) {
  const step=[0,1,0,-1][frame], bob=frame%2, ink='#142127', cloth='#4e6058', skin='#b3baa7', leather='#82664c';
  P.shadow(12,22,19);
  // Chapéu largo de feltro, aljava, arco comprido e cutelo de caça.
  P.r(3,5+bob,4,12,ink); P.r(4,6+bob,2,10,leather);
  for(const x of [3,5]) {P.line(x,3+bob,x+1,10+bob,'#b9b58e');P.p(x,3+bob,'#dedcc0');}
  P.r(6,10+bob,13,10,ink); P.r(7,10+bob,10,9,cloth); P.r(7,11+bob,2,7,'#7c8872'); P.r(15,11+bob,3,8,'#344b45');
  P.r(8,18,3,4,ink); P.r(13,18,3,4,ink); P.r(7,21+Math.min(0,step),5,1,leather); P.r(13,21+Math.min(0,-step),5,1,leather);
  P.line(8,10+bob,16,17+bob,leather,2); P.p(12,13+bob,'#cab287'); P.r(7,17+bob,11,1,leather); P.r(11,17+bob,2,1,'#d5c093');
  P.r(8,4+bob,8,7,ink); P.r(9,4+bob,6,6,skin); P.r(9,7+bob,6,1,'#32413b'); P.p(10,7+bob,'#d6dfaa'); P.p(14,7+bob,'#d6dfaa');
  P.r(10,9+bob,5,2,'#687565'); P.r(9,2+bob,7,3,'#364a45'); P.r(6,4+bob,14,2,ink); P.r(7,4+bob,12,1,'#85907a');
  P.line(15,3+bob,18,0,'#aaa589'); P.p(18,1,'#d1caa2');
  P.r(5,11+bob,3,6,cloth); P.r(5,16+bob,2,2,skin); P.r(17,11+bob,2,5,cloth); P.r(18,15+bob,2,2,skin);
  P.line(20,2+bob,23,7+bob,leather,2); P.line(23,7+bob,23,16+bob,leather); P.line(23,16+bob,20,21+bob,leather,2); P.line(20,2+bob,20,21+bob,'#d5d5b1');
  P.r(2,13+bob,1,8,leather); P.r(1,12+bob,3,5,'#86968e'); P.r(1,12+bob,1,5,'#d9dcca');
}

const forestArt = (fn, k=2) => ({custom:true,frames:4,w:24,h:24,k,visualScale:1,fn});
Object.assign(ENEMY_ART, {
  forest_wolf:forestArt(drawForestWolf), forest_spider:forestArt(drawForestSpider),
  forest_wisp:forestArt(drawForestWisp), forest_bandit:forestArt(drawForestBandit),
  forest_rootling:forestArt(drawForestRootling), forest_moth:forestArt(drawForestMoth),
  forest_druid:forestArt(drawForestDruid), forest_stalker:forestArt(drawForestStalker),
  forest_matriarch:forestArt(drawForestMatriarch,4), forest_huntsman:forestArt(drawForestHuntsman,4),
});
