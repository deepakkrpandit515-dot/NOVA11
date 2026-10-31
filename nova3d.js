import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

// Procedurally modelled 3D holographic assistant. No AI/API key required.
const canvas = document.getElementById('nova3d');
if (canvas) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.15, 7.8);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.AmbientLight(0x8adfff, 1.8));
  const key = new THREE.PointLight(0x42eaff, 38, 18); key.position.set(-3, 3, 5); scene.add(key);
  const rim = new THREE.PointLight(0xb45cff, 24, 16); rim.position.set(3, 1, -3); scene.add(rim);
  const group = new THREE.Group(); scene.add(group);
  const cyan = new THREE.MeshStandardMaterial({color:0x5deaff,metalness:.62,roughness:.24,emissive:0x063a55,emissiveIntensity:.8});
  const skin = new THREE.MeshStandardMaterial({color:0x9cecff,metalness:.35,roughness:.34,transparent:true,opacity:.92,emissive:0x124b69,emissiveIntensity:.28});
  const dark = new THREE.MeshStandardMaterial({color:0x101c3b,metalness:.8,roughness:.22,emissive:0x071b38});
  const glow = new THREE.MeshBasicMaterial({color:0x73f3ff});
  const add=(geo,mat,pos,scale, parent=group)=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);if(scale)m.scale.set(...scale);parent.add(m);return m;};
  // Torso and shoulders
  add(new THREE.SphereGeometry(.72,40,32),dark,[0,-1.42,0],[1.22,.72,.58]);
  add(new THREE.CylinderGeometry(.28,.4,.7,32),skin,[0,-.86,0],[1,1,.8]);
  add(new THREE.SphereGeometry(.48,32,24),cyan,[-.78,-1.2,0],[.78,.42,.48]);
  add(new THREE.SphereGeometry(.48,32,24),cyan,[.78,-1.2,0],[.78,.42,.48]);
  // Neck and head
  add(new THREE.CylinderGeometry(.2,.25,.48,32),skin,[0,-.48,0]);
  const head=new THREE.Group();group.add(head);head.position.set(0,.38,0);
  add(new THREE.SphereGeometry(.79,48,40),skin,[0,0,0],[.78,1,.65],head);
  // Hair cap and side locks create a stylized feminine synthetic avatar
  add(new THREE.SphereGeometry(.82,40,28,0,Math.PI*2,0,Math.PI*.58),dark,[0,.19,-.04],[.83,1.02,.72],head);
  add(new THREE.SphereGeometry(.22,24,24),dark,[-.68,-.13,.02],[.55,1.8,.7],head);
  add(new THREE.SphereGeometry(.22,24,24),dark,[.68,-.13,.02],[.55,1.8,.7],head);
  // Faceplate, eyes, nose and mouth
  add(new THREE.SphereGeometry(.61,32,24),new THREE.MeshBasicMaterial({color:0x102c4b,transparent:true,opacity:.32}),[0,-.06,.49],[.92,.82,.22],head);
  for (const x of [-.29,.29]) {
    add(new THREE.SphereGeometry(.105,24,20),glow,[x,.04,.65],[1.15,.48,.35],head);
    add(new THREE.SphereGeometry(.035,16,12),new THREE.MeshBasicMaterial({color:0xffffff}),[x,.04,.69],null,head);
  }
  add(new THREE.SphereGeometry(.055,16,12),cyan,[0,-.18,.68],[.55,1,.55],head);
  const mouth=add(new THREE.TorusGeometry(.13,.018,8,32,Math.PI),glow,[0,-.34,.64],[1,.45,1],head);mouth.rotation.z=Math.PI;
  // Ear modules and chest core
  for (const x of [-.8,.8]) add(new THREE.SphereGeometry(.13,20,16),cyan,[x,-.02,.02],[.55,1.4,.8],head);
  add(new THREE.TorusGeometry(.24,.035,10,48),glow,[0,-1.35,.54]);
  add(new THREE.SphereGeometry(.12,24,18),glow,[0,-1.35,.55]);
  // Floating holographic rings
  const rings=[];
  for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35+i*.24,.012,8,120),new THREE.MeshBasicMaterial({color:i===1?0xb78cff:0x48eaff,transparent:true,opacity:.65}));ring.rotation.x=Math.PI*(.25+i*.18);ring.position.y=-.45;group.add(ring);rings.push(ring);}
  const stars=new THREE.Group();scene.add(stars);
  for(let i=0;i<70;i++){const dot=add(new THREE.SphereGeometry(.012+Math.random()*.018,8,8),glow,[(Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*2],null,stars);dot.userData.phase=Math.random()*6.28;}
  let targetX=0,targetY=0,down=false,lastX=0,lastY=0;
  canvas.addEventListener('pointerdown',e=>{down=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!down)return;targetY+=(e.clientX-lastX)*.009;targetX+=(e.clientY-lastY)*.006;targetX=THREE.MathUtils.clamp(targetX,-.45,.45);lastX=e.clientX;lastY=e.clientY;});
  canvas.addEventListener('pointerup',()=>down=false);canvas.addEventListener('pointercancel',()=>down=false);
  const resize=()=>{const w=canvas.clientWidth||320,h=canvas.clientHeight||320;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(canvas);resize();
  const clock=new THREE.Clock();
  function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();head.rotation.y+=(targetY-head.rotation.y)*.045;head.rotation.x+=(targetX-head.rotation.x)*.045;group.position.y=Math.sin(t*1.15)*.07;group.rotation.y+=((down?0:Math.sin(t*.28)*.12)-group.rotation.y)*.02;rings.forEach((r,i)=>{r.rotation.z=t*(i%2?-.12:.16);r.rotation.x+=.001*(i+1)});stars.children.forEach(d=>{d.position.y+=Math.sin(t+d.userData.phase)*.0008});renderer.render(scene,camera);}
  animate();
}
