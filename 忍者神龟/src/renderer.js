// Original Canvas artwork. Simulation coordinates are read only; z never changes ground depth.
import { getSection } from './content.js';
import { drawActorSprite, isPixelActor, isPixelBoss, renderPixelActorPreview } from './actors.js';
const W = 960, H = 540;
const INK = '#112c32';
const TURTLES = {
  leo: { name: 'LEONARDO', short: 'LEO', mask: '#66b9fa', skin: '#86bc62', light: '#b8d77d', weapon: 'sword' },
  don: { name: 'DONATELLO', short: 'DON', mask: '#bb8ce8', skin: '#769e53', light: '#b0cb75', weapon: 'staff' },
  mike: { name: 'MICHELANGELO', short: 'MIKE', mask: '#ffac54', skin: '#8db960', light: '#c0d979', weapon: 'chucks' },
  raph: { name: 'RAPHAEL', short: 'RAPH', mask: '#f7786c', skin: '#6eae70', light: '#a4d381', weapon: 'sai' },
};
const SCENES = [
  ['海滩', 'FT. SLAUGHTERDALE'], ['海上追击', 'TYPHOON TIDAL POOL'],
  ['布鲁克林大桥', 'BROOKLYN BRIDGE'], ['纽约街区', 'WELCOME TO THE JUNGLE'],
  ['下水道', 'SEWER PIPE NIGHTMARE'], ['科技堡垒', 'THE TECHNODROME'],
  ['高塔', 'VERTIGO POINT TOWER'], ['飞船决战', "KRANG’S SPACESHIP"],
];
const BOSS_CUES = {
  gun:'枪口扫射 · 上下错位',shotgun:'散弹射击 · 避开弹道',chargeWarn:'准备冲撞 · 上下闪避',charge:'冲撞',
  pipe:'钢管横扫 · 退出近身范围',shellSpin:'龟壳旋转 · 跳跃闪避',mace:'链球横扫',pickWarn:'准备挥镐 · 及时后撤',pickaxe:'镐击',
  helmetLaser:'头盔激光',iceBreath:'冰息 · 中招后连按挣脱',leapClaw:'跃起爪击',spawn:'捕鼠机出现',fireballs:'火球',
  guard:'防御姿态 · 飞踢会被挡住',rushPunch:'冲刺挥拳',electricSign:'小心带电招牌',teleport:'传送中',
  transformBeam:'变形光束',lightning:'地面电流',electricBody:'全身带电 · 等待空隙',splitLaser:'分体激光 · 上下体都可攻击',
  homing:'追踪弹',recover:'收招空隙',grab:'近身抓取',rushGrab:'冲刺抓取',tail:'甩尾横扫',dashSlash:'突进斩击',
};
const P = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)); };
function polygon(ctx, points, fill, stroke, width = 2) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function line(ctx, points, color, width = 2) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'miter'; ctx.stroke();
}
function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}
function text(ctx, value, x, y, size = 14, color = '#e2efd9', align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(String(value), x, y);
}
const actionOf = e => typeof e.action === 'object' ? (e.action?.kind || e.action?.type || e.action?.name || '') : (e.action || '');
const lifeOf = e => Number(e.life ?? e.ttl ?? e.timer ?? 24);
const mod = (n, m) => ((n % m) + m) % m;
const actorSeed = e => Number(String(e.id || '0').replace(/\D/g, '')) || 0;
const sectionOf = state => state.section?.type || getSection(state.stageIndex || 0, (state.cameraX || 0) + 480)?.type;
function background(ctx, state) {
  const stage = state.stageIndex || 0, frame = state.frame || 0, cam = state.cameraX || 0;
  const sky = ['#abd2bc', '#b1d9d1', '#9db5bd', '#98bdb9', '#244b4d', '#152d3a', '#203d4d', '#152738'][stage];
  P(ctx, 0, 0, W, H, sky);
  if (stage < 4) {
    P(ctx, 0, 90, W, 58, '#bfd5bc'); P(ctx, 0, 148, W, 40, '#d4dcba');
    ellipse(ctx, 786 - mod(cam * .06, 140), 125, 39, 39, '#f8e5a5');
    for (let i = 0; i < 9; i++) {
      const x = mod(i * 149 - cam * .12, 1180) - 100, y = 115 + i % 3 * 21;
      P(ctx, x, y, 61, 9, '#e7e5c5'); P(ctx, x + 14, y - 7, 34, 8, '#e7e5c5');
    }
  }
  if (stage === 0) beach(ctx, cam, frame, state);
  if (stage === 1) ocean(ctx, state, cam, frame);
  if (stage === 2) bridge(ctx, cam);
  if (stage === 3) street(ctx, state, cam);
  if (stage === 4) sewer(ctx, cam, frame);
  if (stage === 5) fortress(ctx, cam, frame);
  if (stage === 6) tower(ctx, state, cam, frame);
  if (stage === 7) spaceship(ctx, cam, frame);
  // Fixed dark foreground edge anchors all eight environments.
  P(ctx, 0, 485, W, 55, '#102d32'); P(ctx, 0, 485, W, 4, '#345856');
}
function palm(ctx, x, base, size = 1) {
  ctx.save(); ctx.translate(x, base); ctx.scale(size, size);
  polygon(ctx, [[-5, 0], [7, 0], [19, -95], [12, -102], [4, -54]], '#9b7654', '#3a6051', 3);
  for (let i = 0; i < 7; i++) P(ctx, i * 1.4, -i * 13 - 10, 10, 3, '#d5b77c');
  const leaves = [ [[15,-100],[-37,-125],[-67,-98],[-27,-109]], [[15,-100],[-3,-145],[26,-130],[19,-108]], [[15,-100],[60,-135],[84,-101],[47,-111]], [[15,-100],[64,-98],[77,-63],[39,-90]], [[15,-100],[-20,-97],[-39,-67],[-34,-94]] ];
  for (const points of leaves) polygon(ctx, points, '#427c63', '#285a50', 3);
  P(ctx, 9, -102, 11, 9, '#a77947'); ctx.restore();
}
function beach(ctx, cam, frame, state) {
  P(ctx, 0, 180, W, 82, '#6faea7'); P(ctx, 0, 220, W, 40, '#8dc5b3');
  for (let i = 0; i < 16; i++) P(ctx, mod(i * 79 + frame * .12 - cam * .25, 1000) - 20, 229 + (i % 3) * 8, 39, 3, '#c3debf');
  for (let i = -1; i < 5; i++) {
    const x = i * 296 - mod(cam * .45, 296);
    const c = i % 2 ? '#e8bf8d' : '#d8d5b1';
    P(ctx, x + 8, 143, 223, 121, '#587d6c'); P(ctx, x + 12, 141, 216, 118, c);
    P(ctx, x + 8, 134, 226, 9, '#faf0c9'); P(ctx, x + 14, 151, 212, 7, '#bd826d');
    for (let j = 0; j < 4; j++) {
      P(ctx, x + 28 + j * 47, 168, 28, 52, '#608e85'); P(ctx, x + 31 + j * 47, 170, 22, 22, '#a9c8b0');
      P(ctx, x + 38 + j * 47, 168, 3, 52, '#f0e6bb');
    }
    P(ctx, x + 14, 231, 210, 8, '#fbdb9b');
    for (let j = 0; j < 14; j++) P(ctx, x + 14 + j * 15, 231, 7, 9, '#db765b');
    P(ctx, x + 18, 241, 204, 19, '#b7b392');
    if (i % 2 === 0) text(ctx, 'SURF CLUB', x + 120, 127, 12, '#406e63', 'center');
  }
  P(ctx, 0, 263, W, 18, '#6c9471'); P(ctx, 0, 280, W, 10, '#f1d49b');
  P(ctx, 0, 290, W, 195, '#d7bb87');
  for (let y = 302; y < 485; y += 27) {
    P(ctx, 0, y, W, 2, '#b49e75');
    for (let x = -mod(cam + (y % 2) * 55, 114); x < W; x += 114) P(ctx, x, y, 2, 27, '#c1a97e');
  }
  P(ctx, 0, 291, W, 4, '#f3dba7');
  for (let i = -1; i < 4; i++) palm(ctx, i * 370 + 255 - mod(cam * .7, 370), 281, .93);
  for (let i = 0; i < 7; i++) {
    const x = mod(i * 173 - cam, 1100) - 30;
    P(ctx, x, 477, 34, 4, '#998c68'); P(ctx, x + 10, 469, 5, 6, '#c9af7a');
  }
  if(sectionOf(state)==='pier'){
    P(ctx,0,176,W,110,'#6faaa3');
    for(let i=0;i<17;i++)P(ctx,mod(i*73-frame*.24-cam*.4,1050)-30,191+(i%5)*17,45,3,'#b4d0b3');
    P(ctx,0,283,W,202,'#b89d73');
    for(let x=-mod(cam,52);x<W;x+=52){P(ctx,x,286,3,198,'#876e54');P(ctx,x+4,287,46,3,'#dcc390');P(ctx,x+9,304,3,3,'#647565');P(ctx,x+37,458,3,3,'#647565');}
    P(ctx,0,275,W,8,'#d8bc89');
    for(let x=-mod(cam*.8,125);x<W;x+=125){P(ctx,x,234,11,57,'#826e56');P(ctx,x-3,230,17,7,'#cbb38a');}
    P(ctx,0,249,W,6,'#9d835f');P(ctx,0,249,W,2,'#e1cda1');
  }
}
function ocean(ctx, state, cam, frame) {
  P(ctx, 0, 211, W, 274, '#477f8e'); P(ctx, 0, 243, W, 50, '#4f99a0');
  for (let y = 258; y < 485; y += 22) {
    const shift = Math.sin(frame / 38 + y / 21) * 14;
    P(ctx, 0, y, W, 6, '#59a5a8');
    for (let i = 0; i < 9; i++) P(ctx, mod(i * 139 - cam * .7 - frame * .7 + shift, 1080) - 60, y + 8, 52, 3, '#a0d2bc');
  }
  polygon(ctx, [[-10,211],[40,195],[130,186],[211,205],[263,197],[330,212]], '#608e8b');
  const barge = sectionOf(state) === 'ship';
  if (barge) {
    P(ctx, 0, 256, W, 229, '#607e83'); P(ctx, 0, 266, W, 10, '#a1b9ad');
    for (let x = -mod(cam, 120); x < W; x += 120) {
      P(ctx, x, 289, 3, 196, '#3b5b69'); P(ctx, x + 12, 296, 96, 5, '#8eaaa1');
      for (let y = 310; y < 480; y += 73) { P(ctx, x + 14, y, 5, 5, '#b2c5ae'); P(ctx, x + 100, y, 5, 5, '#344e5b'); }
    }
    for (let x = -mod(cam * .4, 260); x < W; x += 260) {
      P(ctx, x + 20, 174, 140, 83, '#547e83'); P(ctx, x + 30, 166, 120, 10, '#b0c3b0');
      P(ctx, x + 48, 191, 60, 28, '#263f53'); P(ctx, x + 52, 195, 52, 7, '#7bb5b0');
    }
  }
}
function skyline(ctx, cam, base, color, scale = .18) {
  for (let i = 0; i < 16; i++) {
    const x = i * 80 - mod(cam * scale, 80), h = 35 + mod(i * 37, 90);
    P(ctx, x, base - h, 68, h, color); P(ctx, x + 17, base - h - 9, 28, 9, color);
    for (let y = base - h + 10; y < base - 8; y += 17) for (let j = 0; j < 3; j++) P(ctx, x + 8 + j * 18, y, 5, 8, '#b3c9b3');
  }
}
function bridge(ctx, cam) {
  skyline(ctx, cam, 251, '#6f9694'); P(ctx, 0, 250, W, 40, '#628f96');
  const x = 160 - mod(cam * .35, 760);
  for (let tower = x; tower < W + 200; tower += 760) {
    P(ctx, tower, 105, 28, 187, '#9a8077'); P(ctx, tower + 107, 105, 28, 187, '#9a8077');
    P(ctx, tower - 8, 105, 151, 17, '#d3b795'); P(ctx, tower + 8, 151, 113, 11, '#bea287');
    line(ctx, [[tower+16,116],[tower+180,202],[tower+360,240],[tower+510,209],[tower+775,116]], '#587879', 4);
    for (let q = 170; q < 700; q += 52) line(ctx, [[tower + q, 185 + Math.sin((q-130)/610*Math.PI)*55],[tower+q,281]], '#698580', 2);
  }
  P(ctx, 0, 271, W, 12, '#e6ad92'); P(ctx, 0, 285, W, 10, '#584f54'); P(ctx, 0, 295, W, 190, '#91a8a3');
  for (let x2 = -mod(cam, 60); x2 < W; x2 += 60) { P(ctx, x2, 279, 5, 24, '#725b61'); P(ctx, x2 + 9, 365, 39, 4, '#dee0bd'); }
  P(ctx, 0, 455, W, 22, '#d69a84'); P(ctx, 0, 455, W, 4, '#f2c3a0');
  for (let q = 0; q < 8; q++) line(ctx, [[mod(q*167-cam,1100)-50,400],[mod(q*167-cam,1100)-36,411],[mod(q*167-cam,1100)-24,408]], '#768d8c', 2);
}
function street(ctx, state, cam) {
  skyline(ctx, cam, 258, '#63877f');
  const subway = sectionOf(state) === 'subway';
  for (let i = -1; i < 6; i++) {
    const x = i * 220 - mod(cam * .55, 220);
    P(ctx, x, 100, 216, 180, i % 2 ? '#b47966' : '#a69c7c');
    P(ctx, x, 105, 216, 6, '#d9bc91'); P(ctx, x, 246, 216, 34, '#53726e');
    for (let y = 121; y < 214; y += 45) for (let j = 0; j < 4; j++) {
      P(ctx, x + 15 + j * 51, y, 28, 31, '#344e50'); P(ctx, x + 18 + j * 51, y + 3, 22, 15, '#a1b7a2');
      P(ctx, x + 12 + j * 51, y + 31, 34, 5, '#d2b598');
    }
    P(ctx, x + 15, 222, 183, 13, '#325b55'); text(ctx, i%2 ? 'PIZZA  •  OPEN LATE' : 'MANHATTAN MARKET', x + 105, 232, 10, '#f4dab0', 'center');
    if (subway) { P(ctx, x + 19, 211, 171, 68, '#7c9690'); P(ctx, x + 22, 224, 165, 19, '#203d45'); P(ctx, x + 64, 211, 4, 68, '#b9beb0'); P(ctx, x+141,211,4,68,'#b9beb0'); }
  }
  P(ctx, 0, 280, W, 24, '#b6b39a'); P(ctx, 0, 304, W, 181, '#718e8c');
  for (let y = 310; y < 480; y += 38) { P(ctx, 0, y, W, 2, '#597777'); for (let x = -mod(cam + y, 112); x < W; x += 112) P(ctx, x, y, 2, 38, '#597777'); }
  for (let i = 0; i < 4; i++) {
    const x = mod(i * 318 - cam, 1300) - 80; P(ctx, x, 257, 36, 34, '#315657'); P(ctx, x - 3, 254, 42, 6, '#527c70');
    P(ctx, x + 58, 196, 5, 105, '#294d50'); P(ctx, x + 51, 186, 20, 20, '#dbc190');
  }
}
function sewer(ctx, cam, frame) {
  P(ctx, 0, 89, W, 201, '#456559');
  for (let y = 90; y < 287; y += 23) for (let x = -mod(cam * .5 + (y % 2) * 34, 76); x < W; x += 76) {
    P(ctx, x, y, 72, 19, y % 3 ? '#647552' : '#57704f'); P(ctx, x+2,y+2,68,3,'#79845a');
  }
  for (let i = -1; i < 5; i++) {
    const x = i * 267 - mod(cam * .6, 267);
    polygon(ctx, [[x+23,280],[x+23,188],[x+36,166],[x+66,152],[x+95,166],[x+108,188],[x+108,280]], '#1e4547', '#8a8a61', 10);
    P(ctx, x+46,176,4,103,'#496957'); P(ctx,x+80,176,4,103,'#496957');
    P(ctx,x+159,99,34,155,'#66897b'); P(ctx,x+151,247,50,19,'#8aa48c');
    P(ctx,x+164,105,7,136,'#9ba68b');
  }
  P(ctx, 0, 290, W, 195, '#838e61'); P(ctx,0,290,W,8,'#adb27b');
  for (let y=314;y<480;y+=29) for(let x=-mod(cam+y,73);x<W;x+=73) P(ctx,x,y,52,3,'#737e56');
  P(ctx,0,459,W,26,'#315d5a');
  for(let i=0;i<16;i++) P(ctx,mod(i*73-frame*.3-cam*.5,1020)-20,466+(i%2)*9,39,3,'#74947c');
}
function fortress(ctx, cam, frame) {
  P(ctx,0,90,W,200,'#355466');
  for(let i=-1;i<7;i++) {
    const x=i*180-mod(cam*.6,180); P(ctx,x,98,173,177,'#537681'); P(ctx,x+9,106,155,156,'#355869');
    P(ctx,x+22,120,130,8,'#7d9e9a'); P(ctx,x+22,244,130,8,'#7d9e9a');
    polygon(ctx,[[x+26,143],[x+39,132],[x+135,132],[x+149,143],[x+149,226],[x+135,237],[x+39,237],[x+26,226]],'#284853','#6b8f91',3);
    if(i%2===0) { P(ctx,x+52,151,71,46,'#163c45'); P(ctx,x+57,156,61,35,'#74bba0'); for(let k=0;k<4;k++) P(ctx,x+61,160+k*7,mod(frame+k*21,43)+8,2,'#bedbb7'); }
    P(ctx,x+12,114,5,5,'#c8b27d'); P(ctx,x+155,249,5,5,'#c8b27d');
  }
  techFloor(ctx,cam,'#6c8d91','#365c6b');
}
function techFloor(ctx, cam, light, dark) {
  P(ctx,0,282,W,203,light); P(ctx,0,282,W,9,'#a9c1ad');
  for(let y=300;y<485;y+=48) { P(ctx,0,y,W,2,dark); for(let x=-mod(cam+(y%2)*50,160);x<W;x+=160) { P(ctx,x,y,2,48,dark); P(ctx,x+10,y+9,5,5,'#abc0ac'); P(ctx,x+143,y+30,5,5,dark); } }
  P(ctx,0,470,W,9,dark);
  for(let x=-mod(cam,36);x<W;x+=36) polygon(ctx,[[x,470],[x+12,470],[x+3,479],[x-9,479]],'#bfb48a');
}
function tower(ctx, state, cam, frame) {
  const roof=sectionOf(state)==='roof';
  skyline(ctx,cam,288,'#48737e',.12);
  if(!roof) {
    for(let x=40;x<W;x+=218) { P(ctx,x,82,24,211,'#315767'); P(ctx,x+6,82,7,211,'#5b7c82'); }
    for(let y=-mod(frame*.35,91)+90;y<286;y+=91) { P(ctx,0,y,W,12,'#244b5b'); P(ctx,0,y,W,3,'#709795'); }
  } else {
    P(ctx,0,259,W,33,'#4b6f76'); P(ctx,0,254,W,8,'#91aba1');
    for(let x=-mod(cam,180);x<W;x+=180) { P(ctx,x,213,105,42,'#4f737c'); P(ctx,x+8,222,87,3,'#819a95'); P(ctx,x+8,232,87,3,'#819a95'); }
  }
  techFloor(ctx,cam,'#789798','#466b76');
  if(!roof) { P(ctx,0,286,14,197,'#aab8a4'); P(ctx,946,286,14,197,'#aab8a4'); }
}
function spaceship(ctx, cam, frame) {
  P(ctx,0,80,W,210,'#273a50');
  for(let i=0;i<60;i++) {
    const x=mod(i*137-cam*.07,960),y=95+mod(i*47,153); P(ctx,x,y,i%3?2:3,i%3?2:3,i%4?'#8ca7ac':'#d9dfbd');
  }
  ellipse(ctx,790-mod(cam*.04,400),170,66,47,'#678f89'); ellipse(ctx,779-mod(cam*.04,400),160,61,45,'#9aada0');
  for(let i=-1;i<6;i++) {
    const x=i*232-mod(cam*.45,232);
    polygon(ctx,[[x,85],[x+19,85],[x+46,127],[x+46,239],[x+20,286],[x,286],[x+23,234],[x+23,131]],'#7c92a0','#365568',3);
    P(ctx,x+53,259,172,23,'#455a70'); P(ctx,x+62,265,152,3,'#829fab');
    for(let k=0;k<5;k++) P(ctx,x+67+k*28,273,16,4,mod(frame+k*10,60)<30?'#9fd2b0':'#698793');
  }
  techFloor(ctx,cam,'#849ba7','#4c657d');
}
function drawShadow(ctx, e, cam) {
  const x=e.x-cam,y=e.y,z=e.z||0;
  const boss=e.isBoss||e.boss, rx=boss?37:e.type==='mouser'?18:24;
  ellipse(ctx,x,y+3,rx*Math.max(.55,1-z/240),boss?9:6,'#163b3a55');
}
function turtle(ctx,e,frame,portrait=false){
  drawActorSprite(ctx,portrait?{...e,action:'idle'}:e,frame);
}
function foot(ctx,e,frame){drawActorSprite(ctx,e,frame);}
function mouser(ctx,e,frame,mother=false){
  ctx.save();ctx.scale(e.facing===-1?-1:1,1);
  const step=Math.sin(frame*.25)*3;
  if(mother){ctx.scale(1.8,1.8);P(ctx,-13,-18,28,14,'#809e9f');P(ctx,-10,-19,21,4,'#c1cbb8');P(ctx,-8,-9,17,9,'#243e47');P(ctx,-5,-8,11,3,'#e6ba75');}
  P(ctx,-11,-7,5,7+step,INK);P(ctx,6,-7,5,7-step,INK);P(ctx,-14,-2+step,10,3,'#a4b7af');P(ctx,6,-2-step,10,3,'#a4b7af');
  polygon(ctx,[[-12,-24],[6,-27],[18,-21],[18,-11],[-1,-8],[-13,-12]],'#a1b8b0',INK,2);
  P(ctx,-8,-23,12,5,'#e0dfc2');P(ctx,5,-22,12,4,'#3d5661');P(ctx,12,-22,4,3,'#ff9b77');
  line(ctx,[[1,-14],[17,-14]],'#263f49',2);P(ctx,4,-13,3,3,'#e9e1be');P(ctx,11,-13,3,3,'#e9e1be');
  ctx.restore();
}
function stone(ctx,e,frame){
  ctx.save();ctx.scale(e.facing===-1?-1:1,1);const step=Math.sin(frame*.13)*2;
  P(ctx,-14,-14,10,12+step,INK);P(ctx,-13,-13,8,11+step,'#77919a');P(ctx,5,-14,10,12-step,INK);P(ctx,6,-13,8,11-step,'#9badac');
  polygon(ctx,[[-16,-38],[11,-38],[19,-26],[14,-11],[-13,-11],[-20,-24]],'#728e9a',INK,2);
  P(ctx,-10,-34,20,9,'#adbdad');P(ctx,-11,-22,24,7,'#456778');P(ctx,-7,-17,17,5,'#9eaaa0');
  polygon(ctx,[[-10,-50],[8,-50],[14,-44],[11,-35],[-12,-35],[-15,-43]],'#809ca3',INK,2);P(ctx,-9,-43,20,4,'#2c4856');P(ctx,2,-43,9,3,'#e2ba7f');
  P(ctx,9,-31,16,10,'#96ada7');P(ctx,19,-31,23,7,'#395968');P(ctx,39,-32,5,9,'#b7b9a1');P(ctx,22,-29,18,2,'#90a49d');
  ctx.restore();
}
function machine(ctx,e,frame){
  const kind=e.type||'',pulse=Math.sin(frame*.35);
  ctx.save();ctx.scale(e.facing===-1?-1:1,1);
  if(kind==='robot'){
    P(ctx,-12,-14,9,14,'#324c65');P(ctx,5,-14,9,14,'#324c65');P(ctx,-15,-4,13,5,'#a0bbc0');P(ctx,4,-4,14,5,'#a0bbc0');
    polygon(ctx,[[-14,-36],[10,-36],[18,-25],[12,-12],[-11,-12],[-18,-25]],'#7197b1',INK,2);
    P(ctx,-10,-31,20,8,'#b2ccc7');P(ctx,-5,-29,10,4,'#ca8575');P(ctx,-6,-21,12,7,'#29475e');
    P(ctx,-8,-48,18,13,'#a3b8bb');P(ctx,-5,-44,17,5,'#2c4660');P(ctx,0,-43,11,2,'#e9a582');
    P(ctx,13,-31,17,10,'#8babad');P(ctx,25,-31,13,6,'#34556c');P(ctx,-23,-32,10,17,'#8babad');
  }else if(kind==='turret'){
    polygon(ctx,[[-20,0],[-17,-14],[-8,-24],[10,-24],[18,-14],[22,0]],'#648b94',INK,2);
    P(ctx,-14,-12,30,5,'#9eb8b1');P(ctx,0,-24,27,9,'#a9b9b2');P(ctx,23,-26,9,13,'#38566a');P(ctx,26,-23,6,7,'#142f43');
    P(ctx,-13,-4,5,4,'#bdc7b1');P(ctx,9,-4,5,4,'#bdc7b1');
  }else if(kind==='flipper'){
    polygon(ctx,[[-18,-5],[-13,-18],[7,-24],[22,-14],[13,-3]],'#c7b583',INK,2);
    P(ctx,-8,-16,21,6,'#385468');P(ctx,2,-15,9,3,'#e2cba1');P(ctx,-13,-3,26,3,'#638d99');
  }else{
    if(kind==='flyer'){
      polygon(ctx,[[-4,-17],[-26,-26-pulse*3],[-25,-10],[-8,-8]],'#a7c9c0',INK,1.5);
      polygon(ctx,[[5,-17],[22,-26+pulse*3],[26,-10],[8,-8]],'#a7c9c0',INK,1.5);
      P(ctx,-7,-20,14,16,'#657f8e');P(ctx,-4,-16,8,7,'#cbd4b6');P(ctx,-1,-15,5,3,'#e6987b');
    }else{
      ellipse(ctx,0,-13,18,10,'#aa8c6d');P(ctx,-10,-24,20,6,'#d6bc8d');P(ctx,-8,-17,17,5,'#32556b');P(ctx,-3,-16,8,3,'#e1ad86');
      P(ctx,-12,-4,24,3,'#557b86');P(ctx,-7,0,4,5+pulse*2,'#e4b775');P(ctx,4,0,4,5-pulse*2,'#e4b775');
    }
  }
  ctx.restore();
}
function krangPart(ctx,e){
  ctx.save();ctx.scale(e.facing===-1?-1:1,1);
  if(e.partKind==='lower'){
    P(ctx,-17,-27,34,10,'#754759');P(ctx,-16,-18,12,16,'#d1a28f');P(ctx,6,-18,12,16,'#d1a28f');
    P(ctx,-20,-4,17,5,'#8b646c');P(ctx,6,-4,19,5,'#8b646c');P(ctx,-14,-26,27,3,'#bca8a0');
    P(ctx,-5,-33,9,7,'#a7bbb3');P(ctx,-3,-34,5,4,'#d6d2b7');
  }else{
    polygon(ctx,[[-17,-34],[14,-34],[23,-22],[16,-4],[-15,-4],[-23,-20]],'#c7968c',INK,2);
    P(ctx,-15,-36,31,6,'#b68182');P(ctx,-14,-29,27,14,'#e0b5a0');P(ctx,-11,-18,25,14,'#32445a');
    ellipse(ctx,1,-11,10,6,'#dda3b0');line(ctx,[[-6,-13],[-2,-8],[3,-13],[8,-10]],'#95647e',1.2);P(ctx,-5,-12,2,2,INK);P(ctx,5,-12,2,2,INK);
    P(ctx,-11,-52,23,17,'#d1a08e');P(ctx,-15,-51,31,7,'#a5777b');P(ctx,-11,-46,25,6,'#332c46');P(ctx,-8,-45,20,2,'#bad6c7');P(ctx,-3,-38,10,3,'#eed1ae');
    P(ctx,-29,-30,12,23,'#b5827f');P(ctx,17,-30,13,23,'#deb4a0');P(ctx,-31,-12,15,9,'#8c636c');P(ctx,17,-12,15,9,'#8c636c');
    P(ctx,-17,-3,33,4,'#84999e');P(ctx,-12,3,7,2,'#d1ddbc');P(ctx,7,3,7,2,'#d1ddbc');
  }
  ctx.restore();
}
function boss(ctx,e,frame){
  if(/mother/.test(e.type||e.boss||'')){mouser(ctx,e,frame,true);return;}
  if(isPixelBoss(e)){
    const kind=e.type||e.boss,scale=kind==='krang'?1.2:kind==='super'?1.1:1;
    ctx.save();ctx.scale(scale,scale);drawActorSprite(ctx,e,frame);ctx.restore();
  }else stone(ctx,e,frame);
}
function drawEntity(ctx,e,state){
  if(!Number.isFinite(e.x)||!Number.isFinite(e.y))return;
  const cam=state.cameraX||0,x=e.x-cam;if(x < -160 || x > W+160)return;
  const action=actionOf(e),down=e.awaitingRespawn;
  if(down&&(e.respawnDelay??0)<45||e.dead||e.hiddenBody)return;
  const invuln=e.invuln??e.invulnerability??0;if(invuln>0&&!down&&!e.freeze&&(state.frame||0)%8<3)return;
  drawShadow(ctx,e,cam);
  ctx.save();ctx.translate(Math.round(x),Math.round(e.y-(e.z||0)));
  const actorScale=isPixelActor(e)?2:2.5;ctx.scale(actorScale,actorScale);
  if(action==='thrown'){ctx.translate(0,-18);ctx.rotate((e.age||0)*.2);ctx.translate(0,18);}
  if(action==='dead'){ctx.globalAlpha=Math.min(1,(e.deadTimer||0)/18);ctx.translate(0,-13);ctx.rotate(-1.3);ctx.translate(0,13);}
  if(action==='burrow'){ctx.globalAlpha=.35;ctx.translate(0,10);}
  if(e.character&&action==='turtle'){
    const c=TURTLES[e.character]||TURTLES.leo;ellipse(ctx,0,-8,13,9,'#52794e');ellipse(ctx,-2,-10,10,7,'#8dab65');P(ctx,-13,-4,6,4,c.skin);P(ctx,7,-4,6,4,c.skin);P(ctx,11,-9,10,6,c.light);P(ctx,15,-9,3,2,INK);
  }else if(e.character)turtle(ctx,e,state.frame||0);
  else if(e.isBoss||e.boss)boss(ctx,e,state.frame||0);
  else if(e.type==='krangpart')krangPart(ctx,e);
  else if(/mother/.test(e.type||''))boss(ctx,e,state.frame||0);
  else if(/mouser/.test(e.type||''))mouser(ctx,e,state.frame||0);
  else if(/stone|gunner|rocket/.test(e.type||''))stone(ctx,e,state.frame||0);
  else if(/flyer|kamikaze|robot|turret|flipper/.test(e.type||''))machine(ctx,e,state.frame||0);
  else foot(ctx,e,state.frame||0);
  ctx.restore();
  if(e.freeze>0||action==='frozen'){
    const base=e.y-(e.z||0);
    polygon(ctx,[[x-28,base],[x-35,base-64],[x-21,base-96],[x+12,base-101],[x+35,base-72],[x+29,base]],'#8fdaeb77','#c5f0dd',2);
    line(ctx,[[x-21,base-87],[x+8,base-61],[x-9,base-36],[x+17,base-13]],'#d8f8ed',2);
    text(ctx,'冻结 · 连按挣脱',x,base-112,11,'#d2f5e5','center');
  }else if(action==='grabbed')text(ctx,'被抓住 · 连按挣脱',x,e.y-(e.z||0)-112,11,'#f8d69a','center');
  if(e.isBoss)bossAction(ctx,e,state);
  if(e.character) {
    const p=(state.players||[]).indexOf(e)+1; text(ctx,`${p}P`,x,e.y-(e.z||0)-99,11,TURTLES[e.character]?.mask,'center');
    if((state.stageIndex||0)===1&&getSection(1,e.x)?.type==='surf') {polygon(ctx,[[x-36,e.y+4],[x+33,e.y+4],[x+45,e.y+8],[x+34,e.y+15],[x-33,e.y+13],[x-42,e.y+9]],'#cf9270',INK,2);P(ctx,x-19,e.y+6,39,3,TURTLES[e.character]?.mask||'#accab1');}
  } else if(e.hp>0&&e.hp<e.maxHp&&!e.isBoss&&e.type!=='krangpart'){P(ctx,x-18,e.y-(e.z||0)-107,36,3,'#25474d');P(ctx,x-18,e.y-(e.z||0)-107,36*e.hp/e.maxHp,3,'#d4d49c');}
  if(e.tossed){
    const tx=e.tossed.toX-cam,ty=e.tossed.toY;
    ellipse(ctx,tx,ty,25,8,'#eab47a88');line(ctx,[[tx-12,ty-6],[tx+12,ty+6]],'#f7d998',2);line(ctx,[[tx-12,ty+6],[tx+12,ty-6]],'#f7d998',2);
  }
  const telegraph=/windup|telegraph|aim|prepare|warning/.test(e.aiState||'')||/windup/.test(actionOf(e));
  if(telegraph){polygon(ctx,[[x,e.y-(e.z||0)-145],[x+8,e.y-(e.z||0)-130],[x-8,e.y-(e.z||0)-130]],'#f7bb68');text(ctx,'!',x,e.y-(e.z||0)-132,11,INK,'center');}
}
function bossAction(ctx,e,state){
  const x=e.x-(state.cameraX||0),y=e.y-(e.z||0),f=e.facing||1,a=e.aiState||'',age=e.aiAge||0;
  ctx.save();
  if(a==='guard'){
    polygon(ctx,[[x+f*37,y-91],[x+f*63,y-78],[x+f*63,y-32],[x+f*43,y-21],[x+f*30,y-39]],'#8da695','#cbd6b8',3);
    line(ctx,[[x+f*39,y-81],[x+f*50,y-72],[x+f*50,y-35]],'#4d776e',3);
  }else if(a==='shellSpin'){
    ellipse(ctx,x,y-43,43,34,'#567957');line(ctx,[[x-54,y-58],[x-66,y-40],[x-49,y-22]],'#c4d2a1',3);line(ctx,[[x+47,y-66],[x+59,y-44],[x+48,y-24]],'#c4d2a1',3);
  }else if(a==='pipe'&&age>14){
    const t=age*.2;line(ctx,[[x-Math.cos(t)*145,y-43],[x+Math.cos(t)*145,y-43]],'#bcc7bc',8);line(ctx,[[x-Math.cos(t)*140,y-45],[x+Math.cos(t)*140,y-45]],'#e5ddbe',2);
  }else if(a==='mace'&&age>14){
    const reach=80+Math.sin(age*.13)*112;line(ctx,[[x+f*32,y-61],[x+f*reach,y-46]],'#aabcb0',4);ellipse(ctx,x+f*reach,y-46,21,20,'#466677');P(ctx,x+f*reach-7,y-56,11,8,'#a3b8b1');
  }else if(a==='electricBody'||a==='lightning'){
    for(let i=0;i<3;i++){const xx=x-43+i*43;line(ctx,[[xx,y-124],[xx+12,y-88],[xx-4,y-64],[xx+10,y-21]],'#e7e8a2',3);}
  }else if(a==='teleport'){
    for(let i=0;i<7;i++)P(ctx,x-36+mod(i*23+age*3,73),y-110+mod(i*31-age*5,100),5,11,'#bfa2d7');
  }
  // Telegraph markers stay at the actor's ground position, including during leaps.
  if(actionOf(e)==='windup'){
    line(ctx,[[x-32,e.y+6],[x-17,e.y+12],[x+17,e.y+12],[x+32,e.y+6]],'#e8ae73',3);
    polygon(ctx,[[x+f*37,e.y+7],[x+f*49,e.y+1],[x+f*49,e.y+13]],'#e8ae73');
  }
  ctx.restore();
}
function drawHazard(ctx,h,state){
  const cam=state.cameraX||0,x=(h.x||0)-cam,y=h.y||420,w=h.width??h.w??85,hh=h.height??h.h??35;
  const kind=h.type||h.kind||'';if(x+w<-100||x>W+100)return;
  if(/pit|hole|gap/.test(kind)){
    polygon(ctx,[[x,y],[x+w-8,y],[x+w,y+7],[x+w-8,y+hh],[x+7,y+hh],[x,y+hh-8]],'#123344','#74948b',3);
    line(ctx,[[x+4,y+3],[x+w-12,y+3]],'#d0c695',3);for(let i=10;i<w;i+=16)P(ctx,x+i,y+3,4,10,'#334f53');
  } else if(kind==='neon') {
    const cx=x+w/2,base=y+hh;
    P(ctx,cx-6,base-146,12,147,'#31515d');P(ctx,cx-29,base-161,58,117,'#1c394d');P(ctx,cx-25,base-157,50,109,'#627985');
    P(ctx,cx-21,base-153,42,101,'#344b62');
    for(let i=0;i<4;i++)text(ctx,'OPEN'[i],cx,base-132+i*23,21,(state.frame||0)%30<22?'#e1a58f':'#936e79','center');
    if(h.active||((state.frame||0)%70<20)){
      line(ctx,[[cx-31,base-153],[cx-39,base-111],[cx-26,base-89],[cx-36,base-47]],'#c6e6c2',3);
      line(ctx,[[cx+30,base-149],[cx+38,base-105],[cx+25,base-79],[cx+35,base-42]],'#e7d59d',3);
    }
    ellipse(ctx,cx,base,w*.6,8,'#203b4a55');
  } else if(/mine/.test(kind)) {
    ellipse(ctx,x+w/2,y+hh/2,w*.43,hh*.35,'#324d59');P(ctx,x+w*.32,y+hh*.14,w*.36,hh*.35,'#bc8767');
    for(let i=0;i<6;i++){const a=i*Math.PI/3;P(ctx,x+w/2+Math.cos(a)*w*.43-3,y+hh/2+Math.sin(a)*hh*.35-3,6,6,'#acc1af');}
  } else if(/conveyor/.test(kind)) {
    P(ctx,x,y,w,hh,'#3e626c');P(ctx,x,y,w,4,'#a7b5a3');P(ctx,x,y+hh-4,w,4,'#a7b5a3');
    for(let xx=x+mod((state.frame||0)*(h.direction||1),27);xx<x+w;xx+=27)line(ctx,[[xx,y+7],[xx-9,y+hh/2],[xx,y+hh-7]],'#8baba2',3);
  } else if(/water/.test(kind)) {
    ellipse(ctx,x+w/2,y+hh/2,w/2,hh/2,'#42766a88');for(let i=0;i<5;i++)P(ctx,x+10+i*w/6,y+hh/2+(i%2)*8,w/9,3,'#b4c08d');
  } else if(/manhole/.test(kind)) {
    ellipse(ctx,x+w/2,y+hh/2,w/2,hh/2,'#304c51');ellipse(ctx,x+w/2,y+hh/2-2,w*.41,hh*.36,'#748e86');
    for(let i=0;i<3;i++)P(ctx,x+w*.25,y+hh*.27+i*6,w*.5,2,'#3d6062');
  } else if(/sign/.test(kind)) {
    P(ctx,x+w/2-3,y-42,6,61,'#6d6b5c');P(ctx,x,y-46,w,26,'#c4b983');P(ctx,x+4,y-42,w-8,18,'#536a60');text(ctx,'PIER',x+w/2,y-29,11,'#efe4bb','center');
  } else if(/truck/.test(kind)) {
    P(ctx,x,y-81,w,63,'#8d846d');P(ctx,x+6,y-75,w*.65,48,'#b3a588');P(ctx,x+w*.72,y-72,w*.22,24,'#44727b');
    P(ctx,x-5,y-20,w+10,9,'#486773');ellipse(ctx,x+24,y-11,15,15,'#233f4d');ellipse(ctx,x+w-25,y-11,15,15,'#233f4d');
  } else if(/fire|flame/.test(kind)) {
    P(ctx,x-14,y-12,22,hh+12,'#667f82');P(ctx,x-17,y-16,28,5,'#b3b8a2');
    if(h.active!==false){
      P(ctx,x,y,w,hh,'#d6876355');
      for(let i=0;i<Math.ceil(w/17);i++){const xx=x+i*17;polygon(ctx,[[xx,y+hh],[xx+8,y-19-(i%2)*17],[xx+24,y+hh]],i%2?'#f0c77f':'#e38f62');}
    }
  } else if(/fall|rock|debris/.test(kind)){
    const cx=x+w/2,cy=y+hh/2,phase=h.phase||0;
    ellipse(ctx,cx,cy,w*.45,hh*.35,h.active?'#cf765a99':'#52635c44');
    if(phase>35&&phase<111){
      line(ctx,[[x+8,y+8],[x+w-8,y+hh-8]],'#e8b580',2);line(ctx,[[x+8,y+hh-8],[x+w-8,y+8]],'#e8b580',2);
      const z=h.z??Math.max(0,(77-phase)*7);
      polygon(ctx,[[cx-27,cy-z-30],[cx+22,cy-z-34],[cx+32,cy-z-4],[cx+21,cy-z+21],[cx-30,cy-z+15]],'#a4ada4',INK,3);
    }
  } else if(/laser|electric/.test(kind)){
    P(ctx,x,y,w,hh,h.active===false?'#4e7f8355':'#db8d7c77');
    if(h.active!==false){P(ctx,x,y+hh/2-5,w,10,'#db8d7c');P(ctx,x,y+hh/2-2,w,4,'#ffe5b4');}
  } else {
    P(ctx,x-16,y-39,32,39,'#937b5f');P(ctx,x-18,y-40,36,5,'#c5aa7a');P(ctx,x-18,y-12,36,4,'#576866');
  }
}
function drawProp(ctx,p,state){
  if(p.hp<=0||p.dead||p.destroyed)return;const x=p.x-(state.cameraX||0),y=p.y;
  ellipse(ctx,x,y+3,23,6,'#173c3a44');
  if(p.type==='crate'){
    P(ctx,x-22,y-44,44,44,'#927b5f');P(ctx,x-19,y-41,38,38,'#ba9e70');
    line(ctx,[[x-18,y-39],[x+17,y-6]],'#756c57',5);line(ctx,[[x+17,y-39],[x-18,y-6]],'#d1b780',5);
    P(ctx,x-22,y-44,44,5,'#dec38d');P(ctx,x-22,y-5,44,5,'#6b6656');
  }else{
    polygon(ctx,[[x-17,y-48],[x+17,y-48],[x+23,y-39],[x+23,y-8],[x+17,y],[x-17,y],[x-23,y-8],[x-23,y-39]],'#a38c67',INK,2);
    for(let i=-13;i<=13;i+=13)P(ctx,x+i,y-45,2,40,'#cbb586');P(ctx,x-24,y-39,48,5,'#526963');P(ctx,x-24,y-13,48,5,'#526963');
  }
}
function drawItem(ctx,it,state){
  if(it.collected||it.dead)return;const x=it.x-(state.cameraX||0),y=it.y-(it.z||0)-Math.sin((state.frame||0)/15)*2;
  ellipse(ctx,x,it.y+4,20,5,'#173c3a44');
  ctx.save();ctx.translate(x,y);const kind=it.type||it.kind||'pizza';
  if(/pizza|food/.test(kind)){P(ctx,-19,-17,38,21,'#d5c7a0');P(ctx,-20,-18,40,5,'#eee0b0');ellipse(ctx,0,-8,14,8,'#c7814d');ellipse(ctx,0,-9,12,6,'#edc673');for(const [xx,yy] of [[-5,-11],[5,-10],[0,-5]])ellipse(ctx,xx,yy,2.5,2,'#b96553');text(ctx,'PIZZA',0,-24,10,'#f8e6bc','center');}
  else {P(ctx,-12,-25,24,24,'#bada98');text(ctx,kind.includes('life')?'1UP':'?',0,-8,13,INK,'center');}
  ctx.restore();
}
function drawProjectile(ctx,p,state){
  const x=p.x-(state.cameraX||0),y=p.y-(p.z||0);const kind=p.type||p.kind||'';
  ctx.save();ctx.translate(x,y);
  if(kind==='barrel'){ctx.rotate((state.frame||0)*.14);ellipse(ctx,0,0,18,18,'#ac9068');ellipse(ctx,0,0,14,14,'#d3b482');line(ctx,[[-12,-11],[12,11]],'#6f7d70',5);line(ctx,[[-12,11],[12,-11]],'#6f7d70',5);}
  else if(kind==='ice'){polygon(ctx,[[-14,0],[-4,-8],[7,-7],[17,0],[5,8],[-5,7]],'#a9e6e1','#d4f5e5',2);line(ctx,[[-7,0],[9,0]],'#eff9db',2);}
  else if(kind==='transform'||kind==='homing'){ellipse(ctx,0,0,12,9,kind==='transform'?'#d6a3df':'#dba07d');ellipse(ctx,3,-2,6,5,'#eee2bb');}
  else if(kind==='electric'){line(ctx,[[-20,0],[-9,-7],[-3,4],[7,-6],[19,1]],'#ebd694',6);line(ctx,[[-20,0],[-9,-7],[-3,4],[7,-6],[19,1]],'#fff1bd',2);}
  else if(kind==='rocket'){polygon(ctx,[[-17,-7],[9,-7],[21,0],[9,7],[-17,7]],'#a8b6b1',INK,2);P(ctx,-24,-4,8,8,'#e0a26d');P(ctx,-15,-6,6,12,'#6d8c8c');}
  else if(kind==='fist'){P(ctx,-12,-10,25,19,'#ccbba2');P(ctx,-15,-5,7,13,'#a29f98');for(let i=0;i<3;i++)P(ctx,-6+i*7,-8,2,7,'#8a8e8a');}
  else if(/bomb|grenade/.test(kind)){ellipse(ctx,0,-8,8,9,'#344857');P(ctx,-2,-22,4,8,'#c8b189');P(ctx,1,-24,4,4,'#e6b977');}
  else if(/boomerang|shuriken|knife/.test(kind)){ctx.rotate((state.frame||0)*.26);polygon(ctx,[[-10,-3],[-2,-3],[0,-12],[4,-3],[12,1],[3,3],[0,11],[-3,3]],'#d7dbbd',INK,1.5);}
  else if(/fire|flame/.test(kind)){ellipse(ctx,0,0,13,7,'#e89364');ellipse(ctx,4,0,8,4,'#f6d592');}
  else if(/laser|beam/.test(kind)){P(ctx,-18,-3,36,6,'#d88190');P(ctx,-16,-1,32,2,'#f8e2c7');}
  else {P(ctx,-8,-3,16,6,'#e1bc81');P(ctx,-4,-2,10,3,'#f8e2b6');}
  ctx.restore();
}
function drawEffect(ctx,e,state){
  const x=(e.x||0)-(state.cameraX||0),y=(e.y||0)-(e.z||0), kind=e.kind||e.type||'',life=lifeOf(e);
  ctx.save();ctx.globalAlpha=Math.min(1,life/12);
  if(/damage|score|text|heal/.test(kind)||e.text!==undefined){text(ctx,e.text??e.value??'',x,y-20-(30-life)*.6,16,kind.includes('heal')?'#cff0a5':'#ffe5b1','center');}
  else if(/hit|spark|impact|explosion|special/.test(kind)){
    const r=kind.includes('explosion')?38:18, rot=(state.frame||0)*.1;
    const points=[];for(let i=0;i<16;i++){const a=i*Math.PI/8+rot,rr=i%2?r*.34:r;points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}polygon(ctx,points,'#f4cc7a');
    P(ctx,x-5,y-5,10,10,'#fff2c6');
  }else {for(let i=0;i<4;i++)P(ctx,x-14+i*9,y-5-(i%2)*5,6,4,'#d4c69b');}
  ctx.restore();
}
function drawHud(ctx,state){
  const players=state.players||[], stage=Math.max(0,Math.min(7,state.stageIndex||0));
  P(ctx,0,0,W,79,'#102e32');P(ctx,0,77,W,2,'#517168');
  players.slice(0,2).forEach((p,i)=>{
    const c=TURTLES[p.character]||TURTLES.leo,x=i?644:24;
    ctx.save();ctx.beginPath();ctx.rect(x-4,3,56,70);ctx.clip();ctx.translate(x+20,68);ctx.scale(1.15,1.15);turtle(ctx,{...p,facing:1,action:'idle',invuln:0},0,true);ctx.restore();
    text(ctx,`${i+1}P  ${c.short}`,x+57,23,15,c.mask);text(ctx,String(p.score||0).padStart(6,'0'),x+270,23,14,'#e6e6bf','right');
    const max=p.maxHp||16,hp=Math.max(0,p.hp||0),bars=16;
    for(let j=0;j<bars;j++){P(ctx,x+57+j*11,33,8,13,'#31534d');if(hp/max>j/bars)P(ctx,x+57+j*11,33,8,13,hp/max<.27?'#e59174':'#b9d78a');}
    text(ctx,p.awaitingRespawn?'SELECT · 选择角色':`LIFE ${Math.max(0,p.lives??0)}`,x+57,65,11,'#9cbaaa');
    if(state.mode==='invincible')text(ctx,'无敌',x+270,65,11,'#d8ba75','right');
  });
  if(players.length<2){text(ctx,'2P · JOIN THE FIGHT',936,30,12,'#8bada0','right');text(ctx,'双人同屏 / 选择不同角色',936,53,11,'#5e857c','right');}
  text(ctx,`SCENE ${String(stage+1).padStart(2,'0')} / 08`,480,25,11,'#e8cc8b','center');
  text(ctx,SCENES[stage][0],480,49,17,'#e2e8c9','center');
  const remaining=(state.enemies||[]).filter(e=>e.hp>0&&!e.dead&&!e.partOf).length;
  text(ctx,remaining?`${remaining} ENEMIES`:'CLEAR THE WAY',480,67,10,'#8daf9e','center');
  const bosses=(state.enemies||[]).filter(e=>(e.isBoss||e.boss)&&e.hp>0&&!e.dead);
  if(bosses.length){
    const b=bosses[0],max=b.maxHp||1;P(ctx,156,498,648,28,'#162b35');
    text(ctx,(b.name||b.type||'BOSS').toUpperCase(),166,517,12,'#eab58b');
    P(ctx,362,508,420,8,'#394854');P(ctx,362,508,420*Math.max(0,b.hp)/max,8,'#e58b78');
    if(/windup|telegraph|charge|prepare/.test(b.aiState||''))text(ctx,'⚠',791,520,18,'#f5cf86','center');
    const cue=BOSS_CUES[b.aiState]||(b.phase===2&&b.type==='krang'?'机械体分离 · 上下体都可攻击':'');
    if(cue){P(ctx,480-Math.max(140,cue.length*7),473,Math.max(280,cue.length*14),20,'#173a3bdf');text(ctx,cue,480,487,11,'#edd6a3','center');}
  } else {
    text(ctx,SCENES[stage][1],22,516,10,'#7c9c91');text(ctx,`WAVE ${String((state.waveIndex||0)+1).padStart(2,'0')}`,938,516,10,'#7c9c91','right');
  }
  if(!remaining&&state.phase!=='gameover'&&state.phase!=='victory'&&!state.paused&&((state.frame||0)%80<58)){
    text(ctx,'GO',903,233,22,'#f9dc91','center');polygon(ctx,[[893,244],[916,244],[916,237],[932,250],[916,263],[916,255],[893,255]],'#f9dc91',INK,2);
  }
  if(state.message&&typeof state.message==='string'){
    const width=Math.min(700,state.message.length*13+36);P(ctx,480-width/2,87,width,31,'#173a38e6');text(ctx,state.message,480,108,13,'#e9ddb3','center');
  }
}
function debug(ctx,state){
  const cam=state.cameraX||0;ctx.save();ctx.setLineDash([3,3]);ctx.strokeStyle='#e6ca80';ctx.lineWidth=1;
  for(const e of [...(state.players||[]),...(state.enemies||[])]){ctx.strokeRect(e.x-cam-16,e.y-9,32,18);ctx.strokeRect(e.x-cam-18,e.y-(e.z||0)-80,36,80);text(ctx,`y${Math.round(e.y)} z${Math.round(e.z||0)}`,e.x-cam,e.y+21,10,'#ffe6ad','center');}
  ctx.restore();
}
export function render(ctx,state,{debug:showDebug=false}={}){
  if(!ctx||!state)return;
  ctx.save();ctx.setTransform(ctx.canvas.width/W,0,0,ctx.canvas.height/H,0,0);ctx.imageSmoothingEnabled=false;
  background(ctx,state);
  for(const h of state.hazards||[])drawHazard(ctx,h,state);
  for(const it of state.items||[])drawItem(ctx,it,state);
  for(const p of state.props||[])drawProp(ctx,p,state);
  const entities=[...(state.players||[]),...(state.enemies||[])].sort((a,b)=>(a.y||0)-(b.y||0));
  for(const e of entities)drawEntity(ctx,e,state);
  for(const p of state.projectiles||[])drawProjectile(ctx,p,state);
  for(const e of state.effects||[])drawEffect(ctx,e,state);
  if(showDebug)debug(ctx,state);
  drawHud(ctx,state);
  ctx.restore();
}
export function renderPortrait(ctx,character,size=64){
  const c=TURTLES[character]||TURTLES.leo;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.scale(size/64,size/64);
  P(ctx,0,0,64,64,'#1f4140');P(ctx,3,3,58,58,'#2a5049');polygon(ctx,[[0,51],[64,20],[64,64],[0,64]],'#335b4b');
  ctx.translate(27,92);ctx.scale(2.05,2.05);turtle(ctx,{character,facing:1,action:'idle'},0,true);ctx.restore();
  ctx.save();ctx.strokeStyle=c.mask;ctx.lineWidth=2;ctx.strokeRect(1,1,size-2,size-2);ctx.restore();
}

/** Transparent actor contact sheet; shares the exact game sprite path. */
export function renderActorPreview(ctx,entity,{frame=0,scale=3}={}){
  if(isPixelActor(entity))return renderPixelActorPreview(ctx,entity,{frame,scale});
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;
  ctx.translate(Math.round(ctx.canvas.width/2),ctx.canvas.height-12);ctx.scale(scale,scale);
  if(entity.isBoss)boss(ctx,entity,frame);else if(/mouser/.test(entity.type||''))mouser(ctx,entity,frame);else if(/stone|gunner|rocket/.test(entity.type||''))stone(ctx,entity,frame);else machine(ctx,entity,frame);
  ctx.restore();
}
