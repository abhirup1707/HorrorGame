import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const root=document.getElementById('game');
const clockUI=document.getElementById('clock'), objectiveUI=document.getElementById('objective'), hintUI=document.getElementById('hint'), interactionUI=document.getElementById('interaction'), startUI=document.getElementById('start');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x07111b); scene.fog=new THREE.FogExp2(0x07111b,0.012);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.05,220); camera.position.set(9,1.7,1.8); camera.lookAt(9,1.7,-10);
const renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; root.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,renderer.domElement); const keys=new Set(); const clock=new THREE.Clock();
const colliders=[]; const interactables=[]; const tmp=new THREE.Vector3(); let elapsed=0,gameMinutes=19*60,train=null,trainNo=0,doorOpen=false,signalGreen=false,dinner=false,lampClock=0;
const trainTimes=[19*60+30,20*60+30,21*60+15,22*60];
const mat=(c,r=.8,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
const M={wood:mat(0x5a3826,.92),wood2:mat(0x7a5035,.9),wall:mat(0x6b665d,.96),dark:mat(0x171a1d,.98),roof:mat(0x24272a,.92),floor:mat(0x302a24,1),metal:mat(0x444a4e,.38,.75),rail:mat(0x565b5d,.3,.85),sleeper:mat(0x49372a,.95),gravel:mat(0x4a4741,1),glass:new THREE.MeshStandardMaterial({color:0x6f8793,transparent:true,opacity:.3,roughness:.15}),red:mat(0xb4312b,.45),green:mat(0x3d9b63,.45),cream:mat(0xd8c5a0,.75),leaf:mat(0x172e28,1),road:mat(0x292b2c,1)};
function box(name,size,pos,material,parent=scene,solid=false){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),material);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(solid)colliders.push({mesh:o,size:new THREE.Vector3(...size)});return o;}
function cyl(name,r,h,pos,material,parent=scene,solid=false){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),material);o.name=name;o.position.set(...pos);o.castShadow=true;o.receiveShadow=true;parent.add(o);if(solid)colliders.push({mesh:o,size:new THREE.Vector3(r*2,h,r*2)});return o;}
function interact(o,label,fn,range=2.3){o.userData.interact={label,fn,range};interactables.push(o);return o;}
function blocked(p){const r=.3,minY=.15,maxY=1.75;for(const c of colliders){c.mesh.getWorldPosition(tmp);const s=c.size,q=tmp;if(q.y+s.y/2<=minY||q.y-s.y/2>=maxY)continue;if(p.x+r>q.x-s.x/2&&p.x-r<q.x+s.x/2&&p.z+r>q.z-s.z/2&&p.z-r<q.z+s.z/2)return true;}return false;}
function move(dx,dz){let p=camera.position.clone();p.x+=dx;if(!blocked(p))camera.position.x=p.x;p=camera.position.clone();p.z+=dz;if(!blocked(p))camera.position.z=p.z;camera.position.x=THREE.MathUtils.clamp(camera.position.x,-18,18);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-62,8);camera.position.y=1.7;}

scene.add(new THREE.HemisphereLight(0x9ab0cf,0x17120f,.85));
const moon=new THREE.DirectionalLight(0xb7caff,1.75); moon.position.set(-25,34,18); moon.castShadow=true; moon.shadow.mapSize.set(2048,2048); moon.shadow.camera.left=-50;moon.shadow.camera.right=50;moon.shadow.camera.top=50;moon.shadow.camera.bottom=-50;scene.add(moon);
const moonMesh=new THREE.Mesh(new THREE.SphereGeometry(2.4,24,24),new THREE.MeshBasicMaterial({color:0xe4ebff})); moonMesh.position.set(-38,31,-62); scene.add(moonMesh);
const stars=new THREE.BufferGeometry(),sp=[]; for(let i=0;i<260;i++){sp.push((Math.random()-.5)*130,18+Math.random()*40,-10-Math.random()*80);} stars.setAttribute('position',new THREE.Float32BufferAttribute(sp,3)); scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xdce7f5,size:.11})));
box('ground',[60,.3,130],[0,-.18,-27],M.gravel); box('yard',[32,.03,105],[0,-.01,-28],M.road);

// Railway: one clean straight corridor, entirely separate from the cabin.
box('ballast',[5,.18,115],[0,.02,-35],M.gravel);
for(const x of[-1.25,1.25]) box('rail',[.14,.16,115],[x,.15,-35],M.rail);
for(let z=18;z>-90;z-=2.1) box('sleeper',[3.5,.14,.28],[0,.06,z],M.sleeper);

// Cabin sits beside the railway, with a real front yard between them.
const cabin=new THREE.Group(); scene.add(cabin);
box('cabin floor',[10,.3,8],[9,0,3],M.floor,cabin);
box('back wall',[10,4.8,.3],[9,2.4,7],M.wall,cabin,true);
box('left wall',[.3,4.8,8],[4.15,2.4,3],M.wall,cabin,true);
box('right wall',[.3,4.8,8],[13.85,2.4,3],M.wall,cabin,true);
box('front wall L',[3.6,4.8,.3],[6.9,2.4,-.85],M.wall,cabin,true);
box('front wall R',[3.6,4.8,.3],[11.1,2.4,-.85],M.wall,cabin,true);
box('front lintel',[4.2,1.25,.3],[9,4.15,-.85],M.wall,cabin,true);
// Simple pitched roof, symmetrical and deliberately wider than the walls.
const roofA=box('roof left',[7.2,.35,8.8],[7.15,5.05,3],M.roof,cabin); roofA.rotation.z=-.22;
const roofB=box('roof right',[7.2,.35,8.8],[10.85,5.05,3],M.roof,cabin); roofB.rotation.z=.22;
box('front beam',[10.4,.22,.22],[9,4.65,-.65],M.wood2,cabin);

// Door on the front wall, opening into the yard.
const doorPivot=new THREE.Object3D(); doorPivot.position.set(8,0,-.7); scene.add(doorPivot);
const door=box('door',[2.0,3.75,.16],[1,1.88,0],M.wood2,doorPivot); const doorCol={mesh:door,size:new THREE.Vector3(2,3.75,.16)}; colliders.push(doorCol);
interact(door,'Open door',()=>{doorOpen=!doorOpen;doorPivot.userData.target=doorOpen?-Math.PI/2:0;if(doorOpen){colliders.splice(colliders.indexOf(doorCol),1);door.userData.interact.label='Close door';}else{colliders.push(doorCol);door.userData.interact.label='Open door';}});
function windowAt(x,z){const g=new THREE.Group();g.position.set(x,2.7,z);scene.add(g);box('glass',[2.6,1.55,.05],[0,0,0],M.glass,g);box('window top',[3,.18,.18],[0,.9,.02],M.wood,g);box('window bottom',[3,.18,.18],[0,-.9,.02],M.wood,g);box('window left',[.18,1.8,.18],[-1.5,0,.02],M.wood,g);box('window right',[.18,1.8,.18],[1.5,0,.02],M.wood,g);box('window mullion',[.12,1.55,.2],[0,0,.04],M.wood,g);}
windowAt(5.0,3); windowAt(13.0,3);
// Interior props placed against walls, leaving a clear walking path.
box('desk',[3.1,.28,1.0],[10.8,1.35,5.8],M.wood2,cabin,true); box('desk leg',[.2,1.35,.2],[9.5,.67,5.8],M.wood,cabin,true);box('desk leg',[.2,1.35,.2],[12.1,.67,5.8],M.wood,cabin,true);
box('chair',[1.0,.25,1.0],[10.8,.78,4.45],M.wood2,cabin,true);
box('bed frame',[2.5,.45,3.5],[5.8,.35,4.6],M.wood,cabin,true);box('mattress',[2.3,.2,3.25],[5.8,.68,4.6],M.cream,cabin);
const stove=box('stove',[1.2,1.0,1.0],[12.5,.65,1.4],M.metal,cabin,true); interact(stove,'Cook dinner',()=>{if(!train){dinner=true;objectiveUI.textContent='Dinner packed. Return to the desk.';}});
const cabinLight=new THREE.PointLight(0xffb86c,5,11,2);cabinLight.position.set(9,3.4,3);cabinLight.castShadow=true;scene.add(cabinLight);

// Signal and crossing are placed beside the track, not in the cabin.
const signal=new THREE.Group();signal.position.set(3.4,0,-8);scene.add(signal);cyl('signal post',.11,5.4,[0,2.7,0],M.metal,signal,true);box('signal head',[.9,1.5,.5],[0,4.35,0],M.dark,signal);const signalLight=new THREE.PointLight(0xb52d2d,3,9);signalLight.position.set(0,4.35,-.32);signal.add(signalLight);const signalLens=cyl('signal lens',.28,.08,[0,4.35,-.32],M.red,signal);signalLens.rotation.x=Math.PI/2;
const control=box('signal control', [1.0,1.2,.9],[2.9,.6,-5.8],M.metal,scene,true); interact(control,'Operate signal',()=>{signalGreen=!signalGreen;signalLens.material=signalGreen?M.green:M.red;signalLight.color.setHex(signalGreen?0x55ff92:0xb52d2d);objectiveUI.textContent=signalGreen?'Signal clear. Wait for the train.':'Signal red. Wait for the train.';});
const barrierPivot=new THREE.Object3D();barrierPivot.position.set(4.5,1,-13);scene.add(barrierPivot);box('barrier arm',[.16,.18,9],[-4.5,0,0],M.wood2,barrierPivot);for(let x=-8.2;x<=-.8;x+=.8)box('barrier stripe',[.32,.2,.22],[x,.02,0],M.red,barrierPivot);
// Service road crossing the railway; barrier sits at its edge.
box('crossing road',[15,.04,4],[0,.01,-13],M.road);box('road edge',[15,.05,.18],[0,.06,-11.2],M.cream);box('road edge',[15,.05,.18],[0,.06,-14.8],M.cream);
const streetPole=cyl('street pole',.12,6,[5.8,3,-2.5],M.metal);const streetLight=new THREE.PointLight(0xffc98b,4.8,15,2);streetLight.position.set(5.8,6,-2.5);streetLight.castShadow=true;scene.add(streetLight);cyl('lamp head',.28,.2,[5.8,6,-2.5],M.dark);
function tree(x,z,s=1){cyl('tree trunk',.25*s,2.5*s,[x,1.25*s,z],M.wood);for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1.1*s,1),M.leaf);c.position.set(x+(i-1)*.5*s,2.5*s+i*.5*s,z+(i%2)*.3*s);c.castShadow=true;scene.add(c);}}
[[-12,5,1.4],[-10,-11,1.7],[15,-18,1.8],[-14,-28,1.5],[14,-34,1.6],[-13,-48,1.8],[14,-55,1.7]].forEach(v=>tree(...v));

function makeTrain(){const g=new THREE.Group();g.position.set(0,1.75,-100);scene.add(g);const body=mat(0x34424a,.45,.45),windowMat=mat(0x111b21,.25,.3);for(let i=0;i<6;i++){const z=i*7.4;box('coach',[5.0,3.3,6.9],[0,0,z],body,g);box('coach windows',[5.05,.95,.08],[0,.65,z-2.8],windowMat,g);box('coach stripe',[5.08,.12,6.7],[0,-.25,z],M.cream,g);}const head=new THREE.PointLight(0xfff1c7,12,40,2);head.position.set(0,0,-4);g.add(head);train={g,speed:24};objectiveUI.textContent='TRAIN APPROACHING — operate the signal.';}
function closest(){let best=null,dBest=999,dir=new THREE.Vector3();camera.getWorldDirection(dir);for(const o of interactables){const p=o.getWorldPosition(new THREE.Vector3()),d=camera.position.distanceTo(p);if(d>o.userData.interact.range)continue;p.sub(camera.position).normalize();if(dir.dot(p)<.15)continue;if(d<dBest){dBest=d;best=o;}}return best;}
function updateMovement(dt){if(!controls.isLocked)return;let f=0,s=0;if(keys.has('KeyW'))f++;if(keys.has('KeyS'))f--;if(keys.has('KeyD'))s++;if(keys.has('KeyA'))s--;if(!f&&!s)return;const n=Math.hypot(f,s)||1,v=keys.has('ShiftLeft')||keys.has('ShiftRight')?5.8:3.5;move((s/n)*v*dt,(f/n)*v*dt);}
function updateLamp(dt){lampClock+=dt;const t=lampClock%5.3;streetLight.intensity=(t>3.5&&t<3.7)?0.2:(t>3.9&&t<4.08)?1.0:5.0;}
function updateTrain(dt){if(!train&&trainNo<trainTimes.length&&gameMinutes>=trainTimes[trainNo]){makeTrain();trainNo++;}if(!train)return;train.g.position.z+=train.speed*dt;if(train.g.position.z>18){scene.remove(train.g);train=null;signalGreen=false;signalLens.material=M.red;signalLight.color.setHex(0xb52d2d);objectiveUI.textContent=dinner?'Train passed. Return to the desk.':'Train passed. Quiet time — cook your dinner.';}}
function updateDoor(dt){doorPivot.rotation.y=THREE.MathUtils.damp(doorPivot.rotation.y,doorPivot.userData.target||0,7,dt);}
function updateBarrier(dt){const target=signalGreen?-Math.PI/2:0;barrierPivot.rotation.z=THREE.MathUtils.damp(barrierPivot.rotation.z,target,5,dt);}
function updateClock(dt){gameMinutes+=dt*.5;const m=Math.floor(gameMinutes)%1440;clockUI.textContent=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
function updateUI(){const o=closest();interactionUI.textContent=o?`E · ${o.userData.interact.label}`:'';interactionUI.style.opacity=o?'1':'0';hintUI.textContent=controls.isLocked?'WASD move · Mouse look · E interact · Shift sprint · Esc release mouse':'Click to enter · WASD move · Mouse look · E interact';}
window.addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyE'){const o=closest();if(o)o.userData.interact.fn();}if(e.code==='Escape')controls.unlock();});window.addEventListener('keyup',e=>keys.delete(e.code));renderer.domElement.addEventListener('click',()=>controls.lock());startUI.addEventListener('click',()=>{controls.lock();startUI.style.display='none';});controls.addEventListener('lock',()=>startUI.style.display='none');
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;updateMovement(dt);updateClock(dt);updateTrain(dt);updateDoor(dt);updateBarrier(dt);updateLamp(dt);updateUI();renderer.render(scene,camera);}animate();
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
