import { renderActorPreview } from '../src/renderer.js';

if(new URLSearchParams(location.search).has('sheet'))document.body.classList.add('sheet');
const heroes=document.querySelector('#heroes'), enemies=document.querySelector('#enemies');
const characterIds=['leo','raph','mike','don'];
const names=['LEONARDO / 达芬奇','RAPHAEL / 拉斐尔','MICHELANGELO / 米开朗基罗','DONATELLO / 多纳泰罗'];
const colors=['#55b5ff','#ff655b','#ffb544','#bb7bef'];
const sample=document.createElement('canvas');sample.width=352;sample.height=200;
const sampleCtx=sample.getContext('2d');
let playing=false,frame=12;
function cell(ctx,entity,column,row,label,color='#f0dbad',clock=12){
  const x=column*240,y=row*190;
  ctx.fillStyle=row%2?'#253740':'#2b4149';ctx.fillRect(x,y,240,190);
  ctx.fillStyle='#91a7a7';ctx.fillRect(x+24,y+151,192,1);
  const before=JSON.stringify(entity);
  renderActorPreview(sampleCtx,entity,{frame:clock,scale:2.8});
  if(JSON.stringify(entity)!==before)throw Error('Renderer mutated actor state');
  ctx.imageSmoothingEnabled=false;ctx.drawImage(sample,x,y+8,240,150);
  ctx.fillStyle=color;ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillText(label,x+120,y+178);
}
function draw(){
  const ctx=heroes.getContext('2d');ctx.clearRect(0,0,960,570);
  characterIds.forEach((character,col)=>{
    const base={id:`p${col+1}`,character,facing:1,x:0,y:0,z:0,hp:8,maxHp:8,age:frame};
    cell(ctx,{...base,action:playing?'walk':'idle'},col,0,names[col],colors[col],frame);
    cell(ctx,{...base,action:'attack',age:playing?frame%20:8},col,1,'ATTACK · 武器攻击',colors[col],frame);
    cell(ctx,{...base,action:'special',age:playing?frame%36:12},col,2,'SPECIAL · '+['旋风双刀','水平钻击','袋鼠踢','前空翻'][col],colors[col],frame);
  });
  const ec=enemies.getContext('2d');ec.clearRect(0,0,960,380);
  ['foot','sword','spear','whip','rocksteady','bebop','tokka','shredder'].forEach((type,i)=>{
    cell(ec,{id:`e${i}`,type,isBoss:i>3,facing:1,action:'idle',aiState:'recover',x:0,y:0,z:0,hp:64,maxHp:64,age:frame},i%4,Math.floor(i/4),type.toUpperCase(),'#f0dbad',frame);
  });
  document.querySelector('#status').textContent='PASS · 20 个角色姿态共用游戏绘制；绘图前后模拟对象保持一致。';
}
document.querySelector('#animate').addEventListener('click',event=>{playing=!playing;event.currentTarget.textContent=playing?'定格动作':'播放动作';draw();});
let last=0;
function tick(time){if(playing&&time-last>1000/12){frame+=5;last=time;draw();}requestAnimationFrame(tick);}
draw();requestAnimationFrame(tick);
