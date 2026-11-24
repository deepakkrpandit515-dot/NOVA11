const canvas=document.getElementById("nova3d");
if(canvas){
 const ctx=canvas.getContext("2d"); let angle=0,drag=false,lastX=0;
 function draw(){
  const w=canvas.clientWidth||220,h=canvas.clientHeight||220,dpr=Math.min(devicePixelRatio||1,2);
  if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const cx=w/2,cy=h/2,r=Math.min(w,h)*.29;
  const glow=ctx.createRadialGradient(cx,cy,4,cx,cy,r*1.8);glow.addColorStop(0,"rgba(75,220,255,.28)");glow.addColorStop(1,"rgba(75,220,255,0)");
  ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);
  for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,r*(1+i*.22),r*(.43+i*.08),i*.8,0,Math.PI*2);ctx.strokeStyle=i===1?"rgba(174,150,255,.8)":"rgba(83,225,255,.65)";ctx.lineWidth=1.3;ctx.stroke();}
  ctx.restore();
  const pulse=1+Math.sin(Date.now()/500)*.035;
  ctx.beginPath();ctx.arc(cx,cy,r*.56*pulse,0,Math.PI*2);ctx.fillStyle="#102b45";ctx.fill();ctx.strokeStyle="#71eaff";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#c5f8ff";ctx.font=`800 ${r*.85}px system-ui`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("N",cx,cy+1);
  angle+=.003;requestAnimationFrame(draw);
 }
 canvas.style.width="100%";canvas.style.height="220px";canvas.addEventListener("pointerdown",e=>{drag=true;lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener("pointermove",e=>{if(drag){angle+=(e.clientX-lastX)*.01;lastX=e.clientX;}});canvas.addEventListener("pointerup",()=>drag=false);draw();
}
