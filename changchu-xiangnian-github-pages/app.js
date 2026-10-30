/* All prototype tuning lives here. Distances use a 126px reference radius. */
const CONFIG = {
  shapes: {
    round: { name: '圆团', description: '圆润、饱满', radius: a => 1 + .025 * Math.sin(3*a+.4) + .018*Math.sin(5*a-1) },
    cloud: { name: '云朵', description: '柔软相连', radius: a => .88 + .105*Math.cos(4*a-.25) + .045*Math.cos(6*a+.7) },
    drop: { name: '水滴', description: '上窄下圆', radius: a => 1 }
  },
  colors: {
    lavender: { name: '紫 · 蜜桃', colors: ['#a9aeec','#d3b8eb','#f3bed0'], light: '#fff0e9', inner: '#8582c6', motif:['#e98fad','#85bed6','#f0d389'] },
    blue: { name: '蓝 · 奶黄', colors: ['#a8cee9','#b9dded','#f5e4a8'], light: '#fff8d6', inner: '#78a5c2', motif:['#eaa7b7','#64b8d1','#e8c76c'] },
    green: { name: '绿 · 米白', colors: ['#afd8c5','#d4e9d8','#f2e9d9'], light: '#fff8ed', inner: '#86b5a6', motif:['#e7a9b0','#76b9a9','#ddbe7b'] }
  },
  personalities: {
    gentle: { name: '温柔慢热', description: '容易按下，慢慢回到原样', symbol:'〜', softness: 1.15, spring: .060, damping: .86, maxIndent: .22, drag: .68 },
    lively: { name: '活泼黏人', description: '回弹鲜明，还会轻轻晃几下', symbol:'✧', softness: 1, spring: .13, damping: .89, maxIndent: .19, drag: .78 },
    calm: { name: '安静独立', description: '形体稳定，恢复得很平稳', symbol:'◌', softness: .68, spring: .12, damping: .70, maxIndent: .115, drag: .45 }
  },
  physics: { points: 96, pressRampMs: 850, influenceRadians: .55, stretchMin: .79, stretchMax: 1.23, neighborSpring: .035, orbitSensitivity: .008, maxTilt: 1.08, bodyDepth: .27, perspective: 4.5, dragThreshold: 9, pullHoldMs: 380 }
};

const state = { page: 0, shape:'round', color:'lavender', personality:'gentle', generating:false };
const $ = id => document.getElementById(id);
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const rgba = (hex, alpha) => { const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${alpha})`; };

function buildOptions(){
  $('shapeOptions').innerHTML = Object.entries(CONFIG.shapes).map(([id,x])=>`<button class="option-card" data-shape="${id}" aria-pressed="false"><span class="mini-shape ${id}"></span><span class="option-name">${x.name}</span></button>`).join('');
  $('colorOptions').innerHTML = Object.entries(CONFIG.colors).map(([id,x])=>`<button class="option-card color-card" data-color="${id}" aria-pressed="false"><span class="swatch" style="--c1:${x.colors[0]};--c2:${x.colors[2]}"></span><span class="color-name">${x.name}</span></button>`).join('');
  $('personalityOptions').innerHTML = Object.entries(CONFIG.personalities).map(([id,x])=>`<button class="personality-card" data-personality="${id}" aria-pressed="false"><strong>${x.name}</strong><em>${x.description}</em><span class="symbol" aria-hidden="true">${x.symbol}</span></button>`).join('');
  document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>{state.shape=b.dataset.shape;refresh();});
  document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{state.color=b.dataset.color;refresh();});
  document.querySelectorAll('[data-personality]').forEach(b=>b.onclick=()=>{state.personality=b.dataset.personality;refresh();});
}

function refresh(){
  for(const key of ['shape','color','personality']) document.querySelectorAll(`[data-${key}]`).forEach(b=>{const yes=b.dataset[key]===state[key];b.classList.toggle('selected',yes);b.setAttribute('aria-pressed',yes);});
  $('selectionSummary').textContent=`${CONFIG.shapes[state.shape].name} · ${CONFIG.colors[state.color].name}`;
  $('squishSubtitle').textContent=`${CONFIG.personalities[state.personality].name}，正等你轻轻碰它。`;
  for(const renderer of Object.values(renderers)) renderer.rebuild();
}

function showPage(page){
  state.page=page;
  ['pageShape','pagePersonality','pageSquish'].forEach((id,i)=>{const el=$(id);el.hidden=i!==page;el.classList.toggle('active',i===page);});
  $('backBtn').hidden=page===0;
  $('progressFill').style.width=`${(page+1)/3*100}%`;
  $('progressText').textContent=`0${page+1} / 03`;
  window.scrollTo({top:0,behavior:'instant'});
  requestAnimationFrame(()=>{for(const renderer of Object.values(renderers)) renderer.resize();});
}

class Candy {
  constructor(canvas, interactive=false){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.interactive=interactive;this.nodes=[];this.pointers=new Map();this.press=null;this.pinch=null;this.gesture=null;this.angles={x:0,y:0,z:0};this.w=0;this.h=0;this.t=0;this.alive=true;
    if(interactive) this.bind();
    new ResizeObserver(()=>this.resize()).observe(canvas);
    this.resize();this.loop();
  }
  resize(){const rect=this.canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;const dpr=Math.min(window.devicePixelRatio||1,2);this.w=rect.width;this.h=rect.height;this.canvas.width=Math.round(this.w*dpr);this.canvas.height=Math.round(this.h*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.cx=this.w/2;this.cy=this.h/2+(this.interactive?0:7);this.r=Math.min(this.w*.355,this.h*(this.interactive?.355:.37));this.rebuild();}
  basePoint(a){const shape=state.shape;let rr=CONFIG.shapes[shape].radius(a)*this.r;let x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(shape==='drop'){x*=1+.22*Math.sin(a);y*=1+.035*Math.sin(a);}return {x,y};}
  rebuild(){if(!this.r)return;this.nodes=Array.from({length:CONFIG.physics.points},(_,i)=>{const a=i*2*Math.PI/CONFIG.physics.points,p=this.basePoint(a);return {a,baseX:p.x,baseY:p.y,x:p.x,y:p.y,vx:0,vy:0};});this.press=null;this.pinch=null;this.gesture=null;this.angles={x:0,y:0,z:0};this.pointers.clear();this.draw();}
  reset(){this.press=null;this.pinch=null;this.gesture=null;this.angles={x:0,y:0,z:0};this.pointers.clear();for(const n of this.nodes){n.x=n.baseX;n.y=n.baseY;n.vx=n.vy=0;}this.draw();}
  local(e){const r=this.canvas.getBoundingClientRect();return {x:e.clientX-r.left-this.cx,y:e.clientY-r.top-this.cy};}
  unrotate(p){const a=this.angles,ca=Math.cos(a.z),sa=Math.sin(a.z),x=p.x*ca+p.y*sa,y=-p.x*sa+p.y*ca;return {x:x/Math.max(.45,Math.cos(a.y)),y:y/Math.max(.45,Math.cos(a.x))};}
  bind(){this.canvas.addEventListener('pointerdown',e=>{const p=this.local(e);if(Math.hypot(p.x,p.y)>this.r*1.28)return;e.preventDefault();this.canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,p);if(this.pointers.size===1){const q=this.unrotate(p),now=performance.now();this.gesture={start:p,time:now,mode:e.shiftKey&&e.pointerType==='mouse'?'z':'pending',angles:{...this.angles}};this.press=this.gesture.mode==='z'?null:{start:q,current:q,time:now,angle:Math.hypot(q.x,q.y)<this.r*.18?-Math.PI/2:Math.atan2(q.y,q.x)};this.pinch=null;}else if(this.pointers.size===2){const arr=[...this.pointers.values()],angle=Math.atan2(arr[1].y-arr[0].y,arr[1].x-arr[0].x);this.pinch={start:Math.hypot(arr[1].x-arr[0].x,arr[1].y-arr[0].y),startAngle:angle,startZ:this.angles.z,axis:angle-this.angles.z};this.press=null;this.gesture=null;}});
    this.canvas.addEventListener('pointermove',e=>{if(!this.pointers.has(e.pointerId))return;e.preventDefault();const p=this.local(e);this.pointers.set(e.pointerId,p);if(this.pinch&&this.pointers.size===2){const arr=[...this.pointers.values()],angle=Math.atan2(arr[1].y-arr[0].y,arr[1].x-arr[0].x),diff=Math.atan2(Math.sin(angle-this.pinch.startAngle),Math.cos(angle-this.pinch.startAngle));this.angles.z=this.pinch.startZ+diff;return;}if(!this.gesture)return;const g=this.gesture,dx=p.x-g.start.x,dy=p.y-g.start.y,travel=Math.hypot(dx,dy);if(g.mode==='pending'&&travel>CONFIG.physics.dragThreshold){g.mode=performance.now()-g.time>=CONFIG.physics.pullHoldMs?'pull':'orbit';if(g.mode==='orbit')this.press=null;}if(g.mode==='orbit'){this.angles.x=clamp(g.angles.x-dy*CONFIG.physics.orbitSensitivity,-CONFIG.physics.maxTilt,CONFIG.physics.maxTilt);this.angles.y=clamp(g.angles.y+dx*CONFIG.physics.orbitSensitivity,-CONFIG.physics.maxTilt,CONFIG.physics.maxTilt);}else if(g.mode==='z'){const startAngle=Math.atan2(g.start.y,g.start.x),angle=Math.atan2(p.y,p.x),diff=Math.atan2(Math.sin(angle-startAngle),Math.cos(angle-startAngle));this.angles.z=g.angles.z+diff;}else if(this.press)this.press.current=this.unrotate(p);});
    const end=e=>{if(!this.pointers.has(e.pointerId))return;e.preventDefault();this.pointers.delete(e.pointerId);if(this.canvas.hasPointerCapture(e.pointerId))this.canvas.releasePointerCapture(e.pointerId);if(this.pointers.size===0){this.press=null;this.pinch=null;this.gesture=null;}else if(this.pointers.size===1){const raw=[...this.pointers.values()][0],p=this.unrotate(raw),now=performance.now();this.gesture={start:raw,time:now,mode:'pending',angles:{...this.angles}};this.press={start:p,current:p,time:now,angle:Math.atan2(p.y,p.x)};this.pinch=null;}};
    this.canvas.addEventListener('pointerup',end);this.canvas.addEventListener('pointercancel',end);
    this.canvas.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId)){this.pointers.delete(e.pointerId);if(!this.pointers.size){this.press=null;this.pinch=null;this.gesture=null;}}});
  }
  stretchPoint(n){if(!this.pinch||this.pointers.size!==2)return {x:n.baseX,y:n.baseY};const arr=[...this.pointers.values()];let ratio=clamp(Math.hypot(arr[1].x-arr[0].x,arr[1].y-arr[0].y)/Math.max(1,this.pinch.start),CONFIG.physics.stretchMin,CONFIG.physics.stretchMax);const ca=Math.cos(this.pinch.axis),sa=Math.sin(this.pinch.axis),along=n.baseX*ca+n.baseY*sa,across=-n.baseX*sa+n.baseY*ca;const side=clamp(1-(ratio-1)*.27,.93,1.07);return {x:ca*along*ratio-sa*across*side,y:sa*along*ratio+ca*across*side};}
  step(){if(!this.nodes.length)return;const personality=CONFIG.personalities[state.personality], active=this.interactive, press=this.press;let depth=0,dragX=0,dragY=0;if(active&&press){const held=performance.now()-press.time;depth=personality.maxIndent*this.r*(.42+.58*clamp(held/CONFIG.physics.pressRampMs,0,1))*personality.softness;dragX=clamp(press.current.x-press.start.x,-this.r*.44,this.r*.44)*personality.drag;dragY=clamp(press.current.y-press.start.y,-this.r*.44,this.r*.44)*personality.drag;}
    const old=this.nodes.map(n=>({x:n.x,y:n.y}));const count=this.nodes.length;
    for(let i=0;i<count;i++){const n=this.nodes[i];let target=this.stretchPoint(n);if(press){let d=Math.atan2(Math.sin(n.a-press.angle),Math.cos(n.a-press.angle));let influence=Math.exp(-.5*(d/CONFIG.physics.influenceRadians)**2);target.x+=(-Math.cos(n.a)*depth+dragX)*influence;target.y+=(-Math.sin(n.a)*depth+dragY)*influence;}
      const prev=old[(i-1+count)%count],next=old[(i+1)%count];const bPrev=this.nodes[(i-1+count)%count],bNext=this.nodes[(i+1)%count];
      const smoothX=(prev.x+next.x-2*n.x)-(bPrev.baseX+bNext.baseX-2*n.baseX);const smoothY=(prev.y+next.y-2*n.y)-(bPrev.baseY+bNext.baseY-2*n.baseY);
      n.vx=(n.vx+(target.x-n.x)*personality.spring+smoothX*CONFIG.physics.neighborSpring)*personality.damping;
      n.vy=(n.vy+(target.y-n.y)*personality.spring+smoothY*CONFIG.physics.neighborSpring)*personality.damping;
      n.x+=n.vx;n.y+=n.vy;
    }
  }
  path(n=this.nodes){const c=this.ctx,count=n.length;c.beginPath();for(let i=0;i<count;i++){const p0=n[(i-1+count)%count],p1=n[i],p2=n[(i+1)%count],p3=n[(i+2)%count];const aX=p1.x+(p2.x-p0.x)/6,aY=p1.y+(p2.y-p0.y)/6,bX=p2.x-(p3.x-p1.x)/6,bY=p2.y-(p3.y-p1.y)/6;if(i===0)c.moveTo(p1.x,p1.y);c.bezierCurveTo(aX,aY,bX,bY,p2.x,p2.y);}c.closePath();}
  project(x,y,z){const a=this.angles,cx=Math.cos(a.x),sx=Math.sin(a.x),cy=Math.cos(a.y),sy=Math.sin(a.y),cz=Math.cos(a.z),sz=Math.sin(a.z);const yy=y*cx-z*sx,zz=y*sx+z*cx,xx=x*cy+zz*sy,depth=-x*sy+zz*cy;const factor=CONFIG.physics.perspective*this.r/(CONFIG.physics.perspective*this.r-depth);return {x:(xx*cz-yy*sz)*factor,y:(xx*sz+yy*cz)*factor,z:depth};}
  innerPoint(x,y,z=-.12){let px=x*this.r,py=y*this.r;if(this.pinch&&this.pointers.size===2){const arr=[...this.pointers.values()],ratio=clamp(Math.hypot(arr[1].x-arr[0].x,arr[1].y-arr[0].y)/Math.max(1,this.pinch.start),CONFIG.physics.stretchMin,CONFIG.physics.stretchMax),ca=Math.cos(this.pinch.axis),sa=Math.sin(this.pinch.axis),along=px*ca+py*sa,across=-px*sa+py*ca;px=ca*along*ratio-sa*across;py=sa*along*ratio+ca*across;}
    if(this.press){const p=this.press;const dx=p.current.x-p.start.x,dy=p.current.y-p.start.y;const dist=Math.hypot(px-p.current.x,py-p.current.y);const inf=Math.exp(-.5*(dist/(this.r*.68))**2);px+=dx*.19*inf-Math.cos(p.angle)*this.r*.022*inf;py+=dy*.19*inf-Math.sin(p.angle)*this.r*.022*inf;}return this.project(px,py,this.r*z);}
  draw(){if(!this.w||!this.nodes.length)return;const c=this.ctx,palette=CONFIG.colors[state.color],r=this.r;c.clearRect(0,0,this.w,this.h);c.save();c.translate(this.cx,this.cy);
    const front=this.nodes.map(n=>this.project(n.x,n.y,0)),back=this.nodes.map(n=>this.project(n.x,n.y,-2*r*CONFIG.physics.bodyDepth));
    // The projected back and side wall reveal thickness as the view tilts.
    c.save();c.translate(0,r*.19);c.scale(1.03,.92);c.filter='blur(16px)';this.path(back);c.fillStyle='rgba(98,83,134,.17)';c.fill();c.restore();
    this.path(back);c.fillStyle=rgba(palette.colors[1],.76);c.fill();
    const wall=c.createLinearGradient(-r,-r,r,r);wall.addColorStop(0,rgba(palette.colors[0],.55));wall.addColorStop(.6,rgba(palette.colors[1],.82));wall.addColorStop(1,rgba(palette.inner,.43));
    c.fillStyle=wall;for(let i=0;i<front.length;i++){const j=(i+1)%front.length;c.beginPath();c.moveTo(back[i].x,back[i].y);c.lineTo(back[j].x,back[j].y);c.lineTo(front[j].x,front[j].y);c.lineTo(front[i].x,front[i].y);c.closePath();c.fill();}
    this.path(front);c.save();c.clip();
    let base=c.createLinearGradient(-r,-r,r,r);base.addColorStop(0,palette.colors[0]);base.addColorStop(.53,palette.colors[1]);base.addColorStop(1,palette.colors[2]);c.fillStyle=base;c.fillRect(-r*1.4,-r*1.4,r*2.8,r*2.8);
    const diffuse=(x,y,rad,color)=>{const g=c.createRadialGradient(x,y,0,x,y,rad);g.addColorStop(0,color);g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(-r*1.5,-r*1.5,r*3,r*3);};
    diffuse(-r*.52,-r*.55,r*1.15,'rgba(255,255,255,.42)');diffuse(r*.6,r*.55,r*.92,rgba(palette.light,.54));diffuse(-r*.28,r*.3,r*.7,rgba(palette.colors[0],.16));
    // Colored ribbons sit inside the translucent body and follow its local deformation.
    const ribbons=[
      [[-.58,-.12],[-.31,-.39],[-.03,-.28],[.07,.08],[.37,.26],[.55,.11]],
      [[-.53,.34],[-.31,.10],[-.06,.16],[.18,-.17],[.48,-.33]],
      [[-.31,.55],[-.13,.27],[.13,.35],[.41,.48]]
    ];
    const smoothLine=pts=>{c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let j=1;j<pts.length-1;j++){const mid={x:(pts[j].x+pts[j+1].x)/2,y:(pts[j].y+pts[j+1].y)/2};c.quadraticCurveTo(pts[j].x,pts[j].y,mid.x,mid.y);}c.lineTo(pts.at(-1).x,pts.at(-1).y);};
    c.lineCap='round';c.lineJoin='round';for(let i=0;i<ribbons.length;i++){const depth=[-.12,-.27,-.06][i],pts=ribbons[i].map(([x,y])=>this.innerPoint(x,y,depth));smoothLine(pts);c.strokeStyle='rgba(255,255,255,.24)';c.lineWidth=r*(i===0?.17:.14);c.stroke();const g=c.createLinearGradient(pts[0].x,pts[0].y,pts.at(-1).x,pts.at(-1).y);g.addColorStop(0,rgba(palette.motif[i],.38));g.addColorStop(.52,rgba(palette.motif[i],.76));g.addColorStop(1,rgba(palette.motif[i],.43));smoothLine(pts);c.strokeStyle=g;c.lineWidth=r*(i===0?.105:.085);c.stroke();}
    const shortMarks=[[ -.44,.13,.13,-.22,0], [.28,-.45,.11,.23,1], [.41,.02,.09,.2,2], [-.17,.02,.08,.18,0], [.12,.53,.12,-.12,1]];
    for(const [x,y,dx,dy,index] of shortMarks){const a=this.innerPoint(x,y),b=this.innerPoint(x+dx,y+dy);c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo((a.x+b.x)/2+r*.035,(a.y+b.y)/2-r*.025,b.x,b.y);c.strokeStyle=rgba(palette.motif[index],.67);c.lineWidth=r*.034;c.stroke();}
    const bubbles=[[-.38,-.34,.065,-.04],[.25,-.03,.085,-.31],[-.14,.43,.05,-.14],[.41,.35,.06,-.22],[-.04,-.53,.035,-.08]];for(const [x,y,s,z] of bubbles){const p=this.innerPoint(x,y,z),br=r*s;const g=c.createRadialGradient(p.x-br*.3,p.y-br*.32,1,p.x,p.y,br);g.addColorStop(0,'rgba(255,255,255,.93)');g.addColorStop(.58,'rgba(255,255,255,.35)');g.addColorStop(1,rgba(palette.inner,.18));c.beginPath();c.arc(p.x,p.y,br,0,Math.PI*2);c.fillStyle=g;c.fill();c.strokeStyle='rgba(255,255,255,.78)';c.lineWidth=1.3;c.stroke();c.beginPath();c.arc(p.x-br*.23,p.y-br*.25,br*.27,0,Math.PI*2);c.fillStyle='rgba(255,255,255,.76)';c.fill();}
    if(this.press){const p=this.project(this.press.current.x,this.press.current.y,0),power=clamp((performance.now()-this.press.time)/CONFIG.physics.pressRampMs,0,1);const g=c.createRadialGradient(p.x,p.y,r*.04,p.x,p.y,r*.55);g.addColorStop(0,rgba(palette.inner,.12+.09*power));g.addColorStop(.44,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(-r*1.5,-r*1.5,r*3,r*3);}
    c.restore();this.path(front);c.strokeStyle='rgba(255,255,255,.62)';c.lineWidth=2.2;c.stroke();c.restore();}
  loop(){if(!this.alive)return;this.step();this.draw();requestAnimationFrame(()=>this.loop());}
}

const renderers={};
buildOptions();
renderers.preview=new Candy($('previewCanvas'));
renderers.personality=new Candy($('personalityCanvas'));
renderers.squish=new Candy($('squishCanvas'),true);
refresh();showPage(0);
$('toPersonality').onclick=()=>showPage(1);
$('backBtn').onclick=()=>showPage(Math.max(0,state.page-1));
$('generateBtn').onclick=()=>{if(state.generating)return;state.generating=true;$('generating').hidden=false;setTimeout(()=>{state.generating=false;$('generating').hidden=true;showPage(2);renderers.squish.reset();},1150);};
$('resetBtn').onclick=()=>renderers.squish.reset();
$('reselectBtn').onclick=()=>showPage(0);
