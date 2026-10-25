// Original low-resolution actor artwork, authored as integer-pixel silhouettes.
// Pose geometry belongs to presentation only. No sprite is a collision mask.
const OUTLINE = '#111d20';
const SHELL_DARK = '#365623';
const PALETTES = {
  leo: { skin: '#59a52b', light: '#a4d947', shade: '#2f6e2b', mask: '#3479e3', maskLight: '#84b4fb', shell: '#779637' },
  raph: { skin: '#4da938', light: '#9fd845', shade: '#286d32', mask: '#e84b35', maskLight: '#ff9970', shell: '#718b34' },
  mike: { skin: '#72ae31', light: '#b5d94c', shade: '#3c732e', mask: '#f78b25', maskLight: '#ffca65', shell: '#808e32' },
  don: { skin: '#559835', light: '#98cb41', shade: '#2c622c', mask: '#a451c6', maskLight: '#da8fe7', shell: '#758534' },
};
const WIDTH=128, HEIGHT=112, OX=58, OY=94;
const cache=new Map();

class Pixels {
  constructor(){this.data=new Uint8Array(WIDTH*HEIGHT);this.colors=[''];this.indices=new Map();}
  color(c){if(!this.indices.has(c)){this.indices.set(c,this.colors.length);this.colors.push(c);}return this.indices.get(c);}
  dot(x,y,c){x=Math.round(x)+OX;y=Math.round(y)+OY;if(x>=0&&x<WIDTH&&y>=0&&y<HEIGHT)this.data[y*WIDTH+x]=typeof c==='number'?c:this.color(c);}
  box(x,y,w,h,c){const v=this.color(c);for(let yy=Math.round(y);yy<Math.round(y+h);yy++)for(let xx=Math.round(x);xx<Math.round(x+w);xx++)this.dot(xx,yy,v);}
  oval(x,y,rx,ry,c){const v=this.color(c);for(let yy=Math.ceil(y-ry);yy<=Math.floor(y+ry);yy++)for(let xx=Math.ceil(x-rx);xx<=Math.floor(x+rx);xx++)if((xx-x)**2/(rx*rx)+(yy-y)**2/(ry*ry)<=1)this.dot(xx,yy,v);}
  line(points,color,width=1){for(let i=1;i<points.length;i++){const [x0,y0]=points[i-1],[x1,y1]=points[i],steps=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1)*2;for(let s=0;s<=steps;s++){const t=s/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t;if(width<=1)this.dot(x,y,color);else this.oval(x,y,width/2,width/2,color);}}}
  polygon(points,color){
    const minX=Math.floor(Math.min(...points.map(p=>p[0]))),maxX=Math.ceil(Math.max(...points.map(p=>p[0]))),minY=Math.floor(Math.min(...points.map(p=>p[1]))),maxY=Math.ceil(Math.max(...points.map(p=>p[1]))),v=this.color(color);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
      }if(inside)this.dot(x,y,v);
    }
  }
  outlined(points,fill,width=1){this.polygon(points,fill);this.line([...points,points[0]],OUTLINE,width);}
}
const add=(p,x=0,y=0)=>[p[0]+x,p[1]+y];
function bone(s,a,b,r,c,highlight=true){
  s.line([a,b],OUTLINE,r*2+2);s.line([a,b],c.skin,r*2);
  s.line([add(a,-r*.45,-.7),add(b,-r*.45,-.7)],c.light,Math.max(1,r*.85));
  if(highlight)s.line([add(a,r*.5,.6),add(b,r*.5,.6)],c.shade,1);
}
function glove(s,p,c,r=3.3){s.oval(...p,r+1,r+1,OUTLINE);s.oval(p[0],p[1]-.4,r,r,c.skin);s.oval(p[0]-.6,p[1]-1.3,r-1.1,r-1.1,c.light);s.dot(p[0]+1,p[1]+2,c.shade);}
function boot(s,p,c,facing=1){
  const [x,y]=p;const shape=[[x-4,y-4],[x+2,y-5],[x+7,y-2],[x+9,y],[x+8,y+1],[x-6,y+1],[x-7,y-1]];
  s.outlined(shape,c.skin);s.polygon([[x-4,y-3],[x+2,y-4],[x+6,y-2],[x+6,y-1],[x-4,y-1]],c.light);
  s.line([[x+3,y],[x+3,y-2]],c.shade);s.dot(x+6,y,c.shade);
}
function band(s,p,c,angle=0){const dx=Math.cos(angle)*3,dy=Math.sin(angle)*3;s.line([[p[0]-dx,p[1]-dy],[p[0]+dx,p[1]+dy]],OUTLINE,4);s.line([[p[0]-dx,p[1]-dy],[p[0]+dx,p[1]+dy]],c.mask,2);}
function limb(s,hip,knee,ankle,c){bone(s,hip,knee,3.5,c);bone(s,knee,ankle,2.6,c);band(s,knee,c,.12);}
function arm(s,shoulder,elbow,hand,c){bone(s,shoulder,elbow,3.5,c);s.oval(elbow[0]-.8,elbow[1]-2,3.4,3.4,c.light);bone(s,elbow,hand,2.7,c);band(s,elbow,c,-.3);glove(s,hand,c);}

function turtlePose(action,phase){
  const p={hip:[-1,-14],backKnee:[-9,-8],backAnkle:[-11,-2],frontKnee:[9,-8],frontAnkle:[7,-2],backFoot:[-13,0],frontFoot:[10,0],backElbow:[-12,-23],backHand:[-9,-16],frontElbow:[12,-25],frontHand:[16,-29],lean:0,bob:0,head:[7,-36]};
  if(action==='walk'){
    const frames=[[-12,-5,10,-9],[-5,-8,9,-7],[8,-7,-10,-5],[-5,-7,-4,-7]],v=frames[phase%4];
    p.backKnee=[v[0],-8];p.backAnkle=[v[0]-3,-2];p.backFoot=[v[0]-4,0];p.frontKnee=[v[2],-9];p.frontAnkle=[v[2]+2,-2];p.frontFoot=[v[2]+5,0];
    p.bob=phase%2?-1:0;p.backElbow=[-12,phase%2?-25:-22];p.frontElbow=[12,phase%2?-22:-25];
  }
  if(action==='attack'||action==='toss'){
    p.lean=phase===0?-3:3;p.head=[phase===0?4:10,-36];p.frontKnee=[12,-8];p.frontFoot=[15,0];p.backFoot=[-16,0];
    if(phase===0){p.frontElbow=[7,-28];p.frontHand=[1,-36];p.backHand=[-14,-27];}
    else if(phase===1||phase===2){p.frontElbow=[16,-26];p.frontHand=[24,-26];p.backHand=[4,-20];}
    else {p.frontElbow=[13,-24];p.frontHand=[18,-25];}
    if(action==='toss'){p.frontElbow=[11,-26];p.frontHand=phase<2?[19,-31]:[-1,-44];p.backHand=[-4,-28];}
  }
  if(action==='jump'){
    p.hip=[-1,-12];p.backKnee=[-12,-16];p.backAnkle=[-16,-10];p.backFoot=[-16,-8];p.frontKnee=[10,-15];p.frontAnkle=[11,-7];p.frontFoot=[13,-5];p.frontElbow=[14,-29];p.frontHand=[18,-35];p.backHand=[-16,-29];p.head=[7,-35];
  }
  if(action==='kick'){
    p.lean=-4;p.head=[2,-36];p.hip=[-2,-15];p.backKnee=[-12,-14];p.backAnkle=[-15,-6];p.backFoot=[-16,-5];p.frontKnee=[13,-20];p.frontAnkle=[24,-22];p.frontFoot=[29,-21];p.frontElbow=[11,-29];p.frontHand=[9,-34];p.backHand=[-17,-29];
  }
  if(action==='hurt'||action==='grabbed'||action==='frozen'){
    p.lean=-5;p.head=[0,-36];p.frontElbow=[12,-28];p.frontHand=[18,-34];p.backElbow=[-16,-26];p.backHand=[-20,-31];p.frontKnee=[5,-7];p.frontFoot=[7,0];p.backFoot=[-13,0];
  }
  return p;
}
function shell(s,lean,bob,c){
  const x=-5+lean,y=-25+bob;
  s.oval(x,y,10.5,13.5,OUTLINE);s.oval(x,y,9.5,12.5,SHELL_DARK);s.oval(x-1,y-1,8.5,11,c.shell);
  s.oval(x-3,y-5,5,5,'#a3ac42');
  s.line([[x-4,y-10],[x+2,y-8],[x+5,y-3],[x+2,y+4],[x-4,y+8]],SHELL_DARK,1);
  s.line([[x-8,y-2],[x-2,y-4],[x+5,y-3]],SHELL_DARK,1);s.line([[x-7,y+5],[x-2,y+2],[x+2,y+4]],SHELL_DARK,1);
}
function turtleHead(s,p,c){
  const x=p[0],y=p[1]-2;
  // Low crown and a broad muzzle keep the head near one fifth of the body height.
  s.oval(x-1,y,7,4.5,OUTLINE);s.oval(x-1,y-.3,6.1,3.8,c.skin);s.oval(x-3,y-1.6,4,2.2,c.light);
  s.oval(x+4.5,y+3,6.4,3.2,OUTLINE);s.oval(x+4.5,y+2.6,5.7,2.5,c.light);
  s.line([[x+3,y+4],[x+9,y+4]],c.shade,1);s.dot(x+8,y+1,c.shade);
  s.line([[x-7,y],[x-1,y-1],[x+7,y]],c.mask,2);s.line([[x-5,y-2],[x,y-2]],c.maskLight,1);
  s.line([[x+1,y],[x+6,y]],'#fff1bd',1);s.dot(x+5,y,OUTLINE);
  s.line([[x-7,y],[x-12,y+1],[x-16,y-1]],c.mask,2);s.line([[x-8,y+1],[x-12,y+4],[x-17,y+3]],c.mask,1);
}
function weapon(s,character,hand,angle,back=false){
  const [x,y]=hand,dx=Math.cos(angle),dy=Math.sin(angle),along=n=>[x+dx*n,y+dy*n],side=(n,k)=>[x+dx*n-dy*k,y+dy*n+dx*k];
  const blade='#eaf1cf',shadow='#7d9eaa',wood='#d88f3a';
  if(character==='leo'){
    s.line([along(-3),along(26)],OUTLINE,3);s.line([along(5),along(25)],blade,2);s.line([side(7,1),side(24,1)],shadow,1);s.line([side(3,-4),side(3,4)],'#e7b452',2);s.line([along(-4),along(2)],'#7e532e',2);
  }else if(character==='don'){
    s.line([along(-15),along(34)],OUTLINE,4);s.line([along(-14),along(33)],wood,2);s.line([side(-12,-1),side(31,-1)],'#f3d18a',1);
    for(const n of [-4,4,22])s.line([side(n,-1),side(n,1)],'#f3e7b5',2);
  }else if(character==='raph'){
    s.line([along(-3),along(16)],OUTLINE,3);s.line([along(3),along(15)],blade,1);s.line([side(7,-4),side(2,-3),side(2,3),side(7,4)],blade,1);s.line([along(-3),along(1)],'#9e673d',2);
  }else{
    s.line([along(-5),along(5)],OUTLINE,4);s.line([along(-4),along(5)],wood,2);
    const tail=back?angle+1.15:angle-.85,chain=along(15),end=[chain[0]+Math.cos(tail)*13,chain[1]+Math.sin(tail)*13];
    // Separate wooden handles with visible short metal links, rather than one bent bar.
    for(const n of [7,9,11,13])s.dot(...along(n),'#e0e8cf');
    s.line([chain,end],OUTLINE,4);s.line([chain,end],'#efae45',2);s.dot(...chain,'#fbdd8d');
  }
}
function turtleSprite(character,action,phase){
  const s=new Pixels(),c=PALETTES[character]||PALETTES.leo;
  const poseAction=action==='special'?(character==='mike'?'kick':character==='raph'?'jump':'attack'):action;
  const p=turtlePose(poseAction,phase);
  if(character==='raph'&&!['kick','jump','hurt','down','special'].includes(action)){p.backElbow=[-14,-28];p.backHand=[-17,-20];}
  if(action==='attack'){
    if(character==='leo'){p.backHand=[-5,-26];p.backElbow=[-13,-29];}
    else if(character==='raph'){p.backHand=[10,-17];p.backElbow=[-7,-22];p.lean=4;}
    else if(character==='mike'&&phase>0){p.frontElbow=[12,-25];p.frontHand=[20,-33];p.head=[9,-37];p.lean=2;}
    else if(character==='don'&&phase>0){p.frontElbow=[11,-25];p.frontHand=[21,-26];p.backHand=[3,-22];p.lean=4;}
  }
  if(action==='special'&&character==='mike'){
    // Both anatomical legs extend; no standing leg remains underneath the double kick.
    p.backKnee=[12,-13];p.backAnkle=[25,-13];p.backFoot=[29,-12];
  }
  if(action==='special'&&character==='raph'){
    // Draw the extended pose upright, then rotate it: feet trail left and sai lead right.
    Object.assign(p,{hip:[0,-14],backKnee:[-5,-3],backAnkle:[-6,7],backFoot:[-8,9],frontKnee:[6,-2],frontAnkle:[7,9],frontFoot:[10,11],head:[5,-38],backElbow:[-8,-35],backHand:[-4,-44],frontElbow:[12,-35],frontHand:[10,-45],lean:0});
  }
  if(action==='idle')p.bob=phase%2;
  const lean=p.lean,bob=p.bob;
  // Far arm and leg first; the shell overlaps them, leaving a rounded silhouette.
  limb(s,[-5,-15],p.backKnee,p.backAnkle,{...c,skin:c.shade,light:c.skin});boot(s,p.backFoot,{...c,skin:c.shade,light:c.skin});
  arm(s,[-5+lean,-29+bob],p.backElbow,p.backHand,{...c,skin:c.shade,light:c.skin});
  const rearWeapon=!['kick','jump','hurt','grabbed','frozen','special','down'].includes(action)&&character!=='don';
  shell(s,lean,bob,c);
  // Pear-shaped chest and separate abdominal plates replace the old box torso.
  s.oval(3+lean,-25+bob,7,11,OUTLINE);s.oval(3+lean,-25+bob,6.3,10.2,c.skin);
  s.oval(5+lean,-25+bob,5.6,9,'#b8822d');s.oval(5+lean,-27+bob,4.8,7.2,'#e7b94d');
  s.line([[5+lean,-33+bob],[5+lean,-17+bob]],'#98662d',1);
  for(const y of [-28,-23])s.line([[1+lean,y+bob],[9+lean,y+bob]],'#98662d',1);
  s.line([[-6+lean,-16+bob],[1+lean,-14+bob],[9+lean,-16+bob]],OUTLINE,4);s.line([[-6+lean,-16+bob],[1+lean,-14+bob],[9+lean,-16+bob]],c.mask,2);s.oval(3+lean,-15+bob,2,2,'#edc468');
  limb(s,[3+lean,-15],p.frontKnee,p.frontAnkle,c);boot(s,p.frontFoot,c);
  s.oval(5+lean,-32+bob,3,4,c.skin);turtleHead(s,add(p.head,0,bob),c);
  if(rearWeapon){
    arm(s,[-5+lean,-29+bob],p.backElbow,p.backHand,{...c,skin:c.shade,light:c.skin});
    const rearAngle=character==='leo'?-1.65:character==='raph'?(action==='attack'?-.02:-1.05):1.2;
    weapon(s,character,p.backHand,rearAngle,true);
  }
  arm(s,[6+lean,-29+bob],p.frontElbow,p.frontHand,c);
  let angle=-.65;
  if(action==='attack')angle=(character==='mike'?[-2.7,-.8,.65,-.4]:[-2.15,-.08,.42,-.7])[phase%4];
  if(action==='toss')angle=phase<2?-1.1:-2.5;
  if(action==='walk')angle=-.75+(phase%2)*.15;
  if(!['kick','hurt','grabbed','frozen','down'].includes(poseAction)&&!(action==='special'&&character==='raph'))weapon(s,character,p.frontHand,angle);
  if(action==='special'){
    if(character==='leo'){
      s.line([[-29,-28],[-23,-34],[17,-35],[33,-28],[25,-20],[-21,-18],[-29,-24]],'#eef3cd',1);
      s.line([[-25,-23],[-15,-19],[23,-22]],c.maskLight,1);weapon(s,'leo',[10,-27],phase%2?.08:2.95);weapon(s,'leo',[-8,-22],phase%2?2.9:.15);
    }else if(character==='mike'){
      // Speed marks accompany the two extended legs drawn above.
      s.line([[23,-29],[31,-32],[38,-28]],'#f6df91',1);
    }else if(character==='raph'){
      weapon(s,'raph',p.backHand,-Math.PI/2,true);weapon(s,'raph',p.frontHand,-Math.PI/2);s.line([[-14,-3],[-17,3],[-14,7]],'#e7edc2',1);
    }
  }
  return {pixels:s,rotation:action==='special'&&character==='don'?(phase%4)*-Math.PI/2:action==='special'&&character==='raph'?Math.PI/2:action==='down'?-Math.PI/2:0,pivot:action==='down'?[0,-10]:[0,-22]};
}

const FOOT_COLORS={
  foot:['#7a48b8','#bd8ae1','#442871'],sand:['#bd8427','#f3c352','#825326'],shuriken:['#cc453b','#f28a64','#8b3035'],knife:['#258e9b','#7bd2c9','#225770'],
  boomerang:['#d47929','#f6be65','#8e492d'],spear:['#387dbb','#82b9dd','#2e477d'],whip:['#a4b2bc','#e7e5d5','#5f6e83'],sword:['#9fabb7','#e2e6d4','#59637c'],
  surfer:['#bf517c','#f0a1b7','#762b64'],carrier:['#3679bd','#85bee5','#314a88'],electric:['#c3a637','#f4dc6d','#847237']
};
function footSprite(type,action,phase){
  const s=new Pixels(),[skin,light,shade]=FOOT_COLORS[type]||FOOT_COLORS.foot,c={skin,light,shade,mask:'#414256'};
  const walk=action==='walk'||action==='enter',strike=action==='attack',windup=action==='windup';
  const beat=walk?[-1,0,1,0][phase%4]:0,lean=strike?4:windup?-3:2;
  const backKnee=[-6-beat*5,-9],frontKnee=[8+beat*5,-9],backFoot=[-12-beat*6,0],frontFoot=[12+beat*6,0];
  if(action==='hurt'){frontKnee[0]=6;frontFoot[0]=7;}
  limb(s,[-4,-17],backKnee,add(backFoot,1,-3),{...c,skin:shade,light:skin});boot(s,backFoot,{...c,skin:shade,light:skin});
  // Ninja torso twists over bent hips. The front shoulder is distinct from the hood.
  s.outlined([[-9+lean,-33],[-2+lean,-36],[7+lean,-33],[11+lean,-25],[6,-16],[-5,-15],[-10+lean,-24]],skin);
  s.polygon([[-5+lean,-32],[1+lean,-34],[6+lean,-31],[6+lean,-27],[-4+lean,-24]],light);
  s.polygon([[-6+lean,-24],[5+lean,-25],[6,-17],[-4,-17]],shade);
  s.line([[-6,-18],[6,-18]],OUTLINE,5);s.line([[-6,-18],[6,-18]],'#484457',3);s.box(0,-20,3,4,'#c8bbc5');
  const backElbow=walk?[-13,-24+beat*2]:[-12,-26],backHand=walk?[-14,-17+beat*2]:[-10,-20];
  arm(s,[-6+lean,-31],backElbow,backHand,{...c,skin:shade,light:skin});
  limb(s,[3,-17],frontKnee,add(frontFoot,-3,-3),c);boot(s,frontFoot,c);
  const headX=lean+2,headY=-40+(walk&&phase%2?-1:0);
  s.oval(headX,headY,5.8,5.6,OUTLINE);s.oval(headX,headY-.4,5,4.8,skin);s.oval(headX-2,headY-2,3.4,2.8,light);
  s.polygon([[headX-2,headY-2],[headX+6,headY-1],[headX+6,headY+3],[headX,headY+2]],'#1b2438');s.line([[headX,headY-1],[headX+5,headY]],'#eee9bc',1);
  s.line([[headX-4,headY+4],[headX+4,headY+5]],shade,1);
  const elbow=strike?[16,-28]:windup?[7,-28]:[12,-29],hand=strike?[25,-28]:windup?[2,-38]:[15,-35];
  arm(s,[7+lean,-31],elbow,hand,c);
  if(type==='sword')weapon(s,'leo',hand,strike?.05:-1.15);
  else if(type==='spear'){
    const a=strike?0:-1.1,tip=[hand[0]+Math.cos(a)*32,hand[1]+Math.sin(a)*32];s.line([[hand[0]-Math.cos(a)*17,hand[1]-Math.sin(a)*17],tip],'#bb8e45',2);s.oval(...tip,2,2,'#e9dec2');s.line([tip,[tip[0]+Math.cos(a)*7,tip[1]+Math.sin(a)*7]],'#e9dec2',2);
  }else if(type==='whip')s.line([hand,[hand[0]+12,hand[1]+8],[hand[0]+24,hand[1]-2],[hand[0]+32,hand[1]+12]],'#e6ba6f',2);
  else if(type==='boomerang')s.line([[hand[0]-3,hand[1]-6],[hand[0]+4,hand[1]-12],[hand[0]+10,hand[1]-5]],'#f6cf73',3);
  else if(type==='knife')weapon(s,'raph',hand,strike?0:-.7);
  else if(type==='shuriken'){
    s.line([[hand[0],hand[1]-7],[hand[0],hand[1]+2]],'#d8e2d3',1);s.line([[hand[0]-4,hand[1]-3],[hand[0]+4,hand[1]-3]],'#d8e2d3',1);s.dot(hand[0],hand[1]-3,OUTLINE);
  }else if(type==='carrier'){
    s.oval(-1,-58,12,8,OUTLINE);s.box(-13,-58,25,13,'#ac7834');s.oval(-1,-45,12,4,'#b98d49');s.oval(-1,-58,11,5,'#d9a959');s.line([[-11,-55],[-11,-46]],'#f1c77a',1);s.line([[-13,-53],[11,-53]],'#635a4c',2);s.line([[-13,-46],[11,-46]],'#635a4c',2);
  }else if(type==='electric'&&strike)s.line([[hand[0]+3,hand[1]],[hand[0]+8,hand[1]-9],[hand[0]+9,hand[1]+2],[hand[0]+17,hand[1]-4]],'#fff1a2',1);
  else if(type==='sand'&&strike)for(let i=0;i<9;i++)s.dot(hand[0]+i*2,hand[1]+(i%3)*2,'#edc675');
  if(type==='surfer')s.outlined([[-25,2],[18,2],[29,5],[18,8],[-20,7],[-27,5]],'#edb95e');
  return {pixels:s,rotation:0,pivot:[0,-22]};
}

const BOSS_COLORS={
  rocksteady:['#8faaa1','#cdd9ba','#546d70','#8c8649'],groundchuck:['#b86b3d','#edaf66','#743f32','#6b755d'],
  bebop:['#b98668','#e8b78a','#795249','#427c99'],dirtbag:['#947655','#d8ae72','#614939','#477fb2'],
  leatherhead:['#469740','#a0c154','#2b603b','#9f843d'],rahzar:['#939892','#d7d8b0','#5b6666','#68513f'],
  slash:['#549545','#a7c952','#2a5836','#66553b'],tokka:['#8aaa42','#d0d868','#456533','#85642f'],
  shredder:['#8753b3','#bb8bdb','#503575','#434e7f'],supershredder:['#8050ac','#c790df','#4c2b78','#435271'],
  krang:['#d99783','#f5c7a5','#9b626c','#9e466e'],
};
function bossKind(entity){const k=(entity.type||entity.boss||'').replace(/[^a-z]/gi,'').toLowerCase();return k==='super'?'supershredder':k;}
function bossSprite(kind,action,phase,variant){
  const s=new Pixels(),[skin,light,shade,pants]=BOSS_COLORS[kind],c={skin,light,shade,mask:pants};
  const walking=action==='walk'||action==='charge',attack=action==='attack',windup=action==='windup';
  const beat=walking?[-2,0,2,0][phase%4]:0,lean=attack?3:windup?-2:0;
  const isTurtle=kind==='slash'||kind==='tokka',shred=kind.includes('shredder'),croc=kind==='leatherhead';
  const backFoot=[-14-beat*2,0],frontFoot=[14+beat*2,0],backKnee=[-10-beat,-9],frontKnee=[12+beat,-10];
  const leg={...c,skin:pants,light:shred?'#8090bb':light,shade};
  if(croc){s.outlined([[-13,-20],[-23,-12],[-39,-3],[-29,-4],[-12,-10]],skin);s.line([[-27,-8],[-19,-10]],light,2);}
  limb(s,[-6,-20],backKnee,add(backFoot,1,-4),leg);boot(s,backFoot,{...c,skin:shade,light:skin});
  if(isTurtle){
    s.oval(-10,-31,15,18,OUTLINE);s.oval(-11,-31,13,16,'#365d35');s.oval(-12,-33,10,13,'#7e942f');
    s.line([[-19,-37],[-10,-40],[-5,-33],[-10,-22],[-20,-26]],'#364f30',2);
    for(const [x,y] of [[-21,-42],[-24,-32],[-23,-22]])s.outlined([[x+1,y-3],[x-8,y-5],[x-2,y+5]],'#d9d494');
  }
  // Broad shoulders, tapered waist and separate rounded pectorals.
  s.oval(lean,-31,15,17,OUTLINE);s.oval(lean,-32,14,15,skin);s.oval(-5+lean,-36,7,8,light);s.oval(7+lean,-36,7,8,light);
  s.oval(3+lean,-25,10,8,skin);s.line([[1+lean,-35],[1+lean,-25]],shade,1);
  s.line([[-8+lean,-27],[8+lean,-27]],shade,1);
  if(isTurtle){s.oval(5+lean,-31,10,13,'#ad7c2e');s.oval(5+lean,-33,9,10,'#e3be58');s.line([[5+lean,-42],[5+lean,-19]],'#9a682d',1);for(const y of [-36,-29])s.line([[-2+lean,y],[13+lean,y]],'#9a682d',1);}
  s.line([[-12,-18],[0,-16],[13,-18]],OUTLINE,5);s.line([[-12,-18],[0,-16],[13,-18]],pants,3);s.oval(3,-17,3,2,'#d8ba68');
  limb(s,[6,-20],frontKnee,add(frontFoot,-1,-4),leg);boot(s,frontFoot,c);
  const backHand=windup?[-19,-44]:[-21,-24],frontHand=attack?[30,-32]:windup?[12,-46]:[23,-25];
  arm(s,[-12+lean,-38],[-20,-31],backHand,{...c,skin:shade,light:skin});
  arm(s,[12+lean,-38],attack?[22,-32]:[21,-32],frontHand,c);
  const hx=3+lean,hy=-50;
  s.oval(hx,hy,10,11,OUTLINE);s.oval(hx,hy,9,10,skin);s.oval(hx-3,hy-4,5.7,5.3,light);
  s.line([[hx+3,hy-3],[hx+8,hy-2]],OUTLINE,2);s.dot(hx+6,hy-2,'#fff1bd');
  if(kind==='rocksteady'){
    s.oval(hx+11,hy+5,11,7,OUTLINE);s.oval(hx+11,hy+5,10,6,skin);s.oval(hx+12,hy+3,7,3,light);
    s.outlined([[hx+13,hy+2],[hx+17,hy-13],[hx+20,hy+3]],'#e4d69f');s.dot(hx+20,hy+4,shade);
    s.line([[-9,-43],[-8,-23]],'#dbb04e',6);s.line([[8,-43],[8,-23]],'#dbb04e',5);
    s.outlined([[18,-32],[44,-32],[44,-25],[31,-25],[27,-19],[20,-19]],'#445c67');s.box(39,-33,7,10,'#819b98');s.line([[23,-31],[40,-31]],'#b4bf9e',1);
  }else if(kind==='groundchuck'){
    s.outlined([[-4,-57],[-13,-65],[-17,-61],[-11,-54]],'#ede0a8');s.outlined([[10,-57],[20,-67],[23,-62],[18,-52]],'#ede0a8');
    s.oval(12,-45,11,7,OUTLINE);s.oval(12,-45,10,6,light);s.oval(17,-45,2,1,shade);s.oval(18,-42,3,3,'#c2b670');s.dot(18,-42,skin);
    s.line([[-5,-53],[10,-52]],'#647580',3);s.dot(5,-52,'#f9d474');
    if(variant){s.line([[15,-29],[44,-29],[44,-39]],OUTLINE,6);s.line([[15,-29],[44,-29],[44,-39]],'#b6c6b6',4);s.line([[18,-30],[43,-30]],'#eff0c5',1);}
  }else if(kind==='bebop'){
    s.outlined([[-4,-58],[-7,-66],[-1,-62],[3,-68],[7,-62],[11,-64],[10,-56]],'#b55ad7');
    s.line([[-5,-53],[13,-52]],'#1b233d',5);s.line([[-3,-54],[2,-54]],'#d7d1e7',1);
    s.oval(15,-44,10,6,OUTLINE);s.oval(15,-44,9,5,light);s.dot(18,-45,shade);s.outlined([[19,-43],[23,-51],[25,-45],[23,-40]],'#efe0ae');
    s.line([[-11,-42],[-10,-23]],'#b74336',5);s.line([[11,-42],[10,-24]],'#b74336',5);
    s.line([[23,-26],[32,-21],[40,-28],[44,-39]],'#c1c9ac',1);s.oval(44,-42,7,7,OUTLINE);s.oval(44,-42,6,6,'#4b6177');s.oval(42,-44,2,2,'#9eafb6');
  }else if(kind==='dirtbag'){
    s.oval(1,-59,18,3,OUTLINE);s.oval(1,-60,17,2,'#d0a65e');s.outlined([[-10,-60],[-9,-67],[9,-67],[12,-60]],'#ac813f');
    s.oval(14,-48,10,5,skin);s.oval(22,-48,4,3,OUTLINE);s.dot(21,-49,light);
    s.line([[-9,-43],[-7,-28]],'#4280b2',4);s.line([[10,-43],[9,-28]],'#4280b2',4);s.outlined([[-10,-31],[11,-31],[12,-19],[-11,-19]],'#4280b2');s.box(-6,-28,12,5,'#79acd0');
    s.line([[22,-18],[36,-54]],OUTLINE,4);s.line([[22,-18],[36,-54]],'#e3b56b',2);s.outlined([[30,-53],[33,-66],[45,-65],[43,-54],[36,-49]],'#a3bfb8');s.line([[35,-55],[39,-62]],'#e3e4bd',1);
  }else if(croc){
    s.outlined([[8,-54],[30,-52],[35,-47],[31,-42],[10,-42]],skin);s.line([[12,-43],[31,-43]],light,3);s.dot(30,-50,shade);
    for(let i=0;i<4;i++)s.outlined([[12+i*5,-44],[15+i*5,-40],[17+i*5,-44]],'#f8e7b2');
    s.oval(1,-61,17,2,OUTLINE);s.oval(1,-61,16,1,'#c6b452');s.outlined([[-9,-61],[-8,-68],[9,-68],[12,-61]],'#a39e42');
    s.line([[-11,-43],[-11,-24]],'#c09d45',5);s.line([[11,-43],[10,-24]],'#c09d45',4);s.line([[25,-29],[42,-28]],'#e4ddaf',3);
  }else if(kind==='rahzar'){
    s.outlined([[-5,-57],[-14,-67],[-12,-54]],light);s.outlined([[8,-58],[17,-68],[16,-53]],light);
    s.oval(15,-44,11,6,OUTLINE);s.oval(15,-44,10,5,light);s.oval(24,-46,3,2,OUTLINE);
    for(let i=0;i<4;i++)s.outlined([[-14+i*8,-41],[-10+i*8,-30],[-5+i*8,-41]],light);
    for(let i=0;i<3;i++){s.line([[frontHand[0]+i*3-2,frontHand[1]+2],[frontHand[0]+i*3,frontHand[1]+8]],'#f6e5ba',2);s.line([[-24+i*3,-22],[-23+i*3,-16]],'#f6e5ba',2);}
  }else if(isTurtle){
    s.oval(14,-44,11,6,OUTLINE);s.oval(14,-45,10,5,light);s.line([[11,-41],[21,-42]],shade,1);
    s.line([[-6,-53],[13,-52]],kind==='slash'?'#d54468':'#995e26',3);s.line([[7,-52],[13,-52]],'#fff0b1',1);s.dot(11,-52,OUTLINE);
    if(kind==='slash'){weapon(s,'leo',frontHand,attack?.12:-.3);s.outlined([[14,-43],[17,-36],[20,-43]],'#eee0b1');}
    else{for(let i=0;i<3;i++)s.outlined([[frontHand[0]-2+i*3,frontHand[1]+2],[frontHand[0]+1+i*3,frontHand[1]+9],[frontHand[0]+3+i*3,frontHand[1]+1]],'#f2dda2');}
  }else if(shred){
    s.outlined([[-13,-43],[-23,-36],[-13,-29],[-5,-38]],'#a4b7bf');s.outlined([[13,-43],[26,-36],[19,-28],[7,-38]],'#b8cad0');
    s.outlined([[-9,-56],[-4,-65],[8,-65],[18,-55],[13,-47],[-9,-47]],'#a2bac5');s.line([[3,-64],[4,-57]],'#e5e6ce',2);
    s.line([[-5,-53],[13,-52]],'#242c48',5);s.line([[0,-53],[4,-53]],'#f6deab',1);s.line([[9,-52],[12,-52]],'#f6deab',1);
    s.outlined([[-6,-48],[14,-47],[10,-40],[-3,-40]],'#c7d8d5');s.line([[5,-47],[5,-41]],'#778f9a',1);
    for(let i=0;i<3;i++)s.outlined([[frontHand[0]-3+i*4,frontHand[1]],[frontHand[0]+3+i*4,frontHand[1]-14],[frontHand[0]+1+i*4,frontHand[1]+2]],'#e7e6c7');
    if(kind==='supershredder'){s.line([[-9,-33],[11,-33]],'#b8bc78',3);s.line([[-7,-27],[10,-27]],'#6d965e',3);s.outlined([[-18,-41],[-28,-49],[-23,-36]],'#d6dfc9');s.outlined([[19,-40],[28,-48],[26,-34]],'#d6dfc9');}
  }else if(kind==='krang'){
    s.line([[-8,-56],[14,-56]],'#a74c6c',5);s.line([[-7,-52],[15,-52]],'#382a4a',5);s.line([[-5,-53],[13,-53]],'#a7e2cf',1);s.line([[0,-43],[11,-43]],light,3);
    s.oval(2,-29,13,10,OUTLINE);s.oval(2,-29,12,9,'#263b57');s.oval(2,-29,10,6,'#eb91b5');s.line([[-4,-32],[-1,-27],[3,-32],[7,-27]],'#a34d82',1);s.dot(-3,-30,OUTLINE);s.dot(6,-30,OUTLINE);
    s.line([[-18,-38],[-11,-42]],'#a4496b',5);s.line([[13,-42],[21,-38]],'#a4496b',5);
  }
  return {pixels:s,rotation:0,pivot:[0,-27]};
}

function posePhase(entity,frame){
  const action=typeof entity.action==='string'?entity.action:'idle',age=entity.age||0;
  if(action==='walk'||action==='enter')return Math.floor(frame/6)%4;
  if(action==='idle')return Math.floor(frame/28)%2;
  if(action==='special')return Math.floor(age/5)%4;
  if(action==='attack'||action==='toss')return age<3?0:age<9?1:age<14?2:3;
  return Math.floor(age/8)%2;
}
function makeSurface(pixels,ctx){
  let canvas;
  if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(WIDTH,HEIGHT);
  else if(ctx.canvas?.ownerDocument)canvas=ctx.canvas.ownerDocument.createElement('canvas');
  if(!canvas)return null;
  canvas.width=WIDTH;canvas.height=HEIGHT;
  const c=canvas.getContext('2d'),image=c.createImageData(WIDTH,HEIGHT);
  const rgb=pixels.colors.map(color=>color?[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]:[0,0,0]);
  for(let i=0;i<pixels.data.length;i++)if(pixels.data[i]){const q=i*4,col=rgb[pixels.data[i]];image.data[q]=col[0];image.data[q+1]=col[1];image.data[q+2]=col[2];image.data[q+3]=255;}
  c.putImageData(image,0,0);return canvas;
}
function paintPixels(ctx,pixels){
  for(let y=0;y<HEIGHT;y++){let x=0;while(x<WIDTH){const value=pixels.data[y*WIDTH+x];if(!value){x++;continue;}let end=x+1;while(end<WIDTH&&pixels.data[y*WIDTH+end]===value)end++;ctx.fillStyle=pixels.colors[value];ctx.fillRect(x-OX,y-OY,end-x,1);x=end;}}
}
export function isPixelBoss(entity){return Object.hasOwn(BOSS_COLORS,bossKind(entity));}
export function isPixelActor(entity){return Boolean(entity.character)||Object.hasOwn(FOOT_COLORS,entity.type||'');}
export function drawActorSprite(ctx,entity,frame=0){
  const action=typeof entity.action==='string'?entity.action:'idle',phase=posePhase(entity,frame),identity=entity.character||entity.type||'foot';
  const kind=bossKind(entity),boss=Boolean(entity.isBoss||entity.boss)&&Object.hasOwn(BOSS_COLORS,kind),variant=kind==='groundchuck'&&(entity.hp<(entity.maxHp||128)*.75||entity.aiState==='pipe');
  const key=`${entity.character?'t':boss?'b':'f'}:${identity}:${action}:${phase}:${variant}`;
  let sprite=cache.get(key);
  if(!sprite){sprite=entity.character?turtleSprite(identity,action,phase):boss?bossSprite(kind,action,phase,variant):footSprite(identity,action,phase);cache.set(key,sprite);}
  if(!sprite.surface)sprite.surface=makeSurface(sprite.pixels,ctx);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.scale(entity.facing===-1?-1:1,1);
  if(sprite.rotation){ctx.translate(...sprite.pivot);ctx.rotate(sprite.rotation);ctx.translate(-sprite.pivot[0],-sprite.pivot[1]);}
  if(sprite.surface)ctx.drawImage(sprite.surface,-OX,-OY);else paintPixels(ctx,sprite.pixels);
  ctx.restore();
}

export function renderPixelActorPreview(ctx,entity,{frame=0,scale=3}={}){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(ctx.canvas.width/2),ctx.canvas.height-12);ctx.scale(scale,scale);drawActorSprite(ctx,entity,frame);ctx.restore();
}
