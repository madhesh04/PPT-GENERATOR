import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function ThreeBackground() {
  const mountRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!mountRef.current) return;
    const cv = mountRef.current;
    const rr = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
    rr.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rr.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, .1, 800);
    cam.position.set(0, 0, 5);
    
    const C = { cy: 0x00f0ff, gn: 0x00ff9d, bl: 0x0050c8 };
    
    const iA = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), new THREE.MeshBasicMaterial({color: C.cy, wireframe: true, transparent: true, opacity: .1}));
    iA.position.set(3.4, .2, -4); sc.add(iA);
    const iB = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), new THREE.MeshBasicMaterial({color: C.bl, wireframe: true, transparent: true, opacity: .055}));
    iB.position.set(3.4, .2, -4); sc.add(iB);
    const tA = new THREE.Mesh(new THREE.TorusGeometry(3.2, .007, 8, 110), new THREE.MeshBasicMaterial({color: C.cy, transparent: true, opacity: .15}));
    tA.position.set(3.4, 0, -5); tA.rotation.x = Math.PI * .28; sc.add(tA);
    const tB = new THREE.Mesh(new THREE.TorusGeometry(2.6, .005, 8, 90), new THREE.MeshBasicMaterial({color: C.gn, transparent: true, opacity: .09}));
    tB.position.set(3.4, 0, -5); tB.rotation.x = Math.PI * .55; tB.rotation.z = Math.PI * .18; sc.add(tB);
    
    const PC = 650, pos = new Float32Array(PC * 3);
    for(let i=0; i<PC; i++){
      pos[i*3] = (Math.random()-.5)*22;
      pos[i*3+1] = (Math.random()-.5)*12;
      pos[i*3+2] = (Math.random()-.5)*8-5;
    }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({color: C.cy, size: .022, transparent: true, opacity: .42, sizeAttenuation: true})); sc.add(pts);
    const gr = new THREE.GridHelper(28, 26, 0x001530, 0x001530); 
    if(!Array.isArray(gr.material)){ gr.material.transparent=true; gr.material.opacity=.45; }
    gr.position.set(0, -3.8, -5); gr.rotation.x = Math.PI * .035; sc.add(gr);
    
    let tx = 0, ty = 0, cx = 0, cy = 0, fr = 0;
    const onMM = (e: MouseEvent) => { tx=((e.clientX/window.innerWidth)-.5)*.55; ty=((e.clientY/window.innerHeight)-.5)*.28; };
    document.addEventListener('mousemove', onMM);
    
    const rsz = () => { const w=window.innerWidth, h=window.innerHeight; rr.setSize(w,h); cam.aspect=w/h; cam.updateProjectionMatrix(); };
    window.addEventListener('resize', rsz); rsz();
    
    let req: number;
    const anim = () => {
      req = requestAnimationFrame(anim);
      fr++; cx+=(tx-cx)*.04; cy+=(ty-cy)*.04;
      iA.rotation.x=fr*.0024+cy*.5; iA.rotation.y=fr*.0038+cx*.5;
      iB.rotation.x=fr*.003-cy*.3; iB.rotation.y=fr*.005-cx*.3;
      tA.rotation.z=fr*.003+cx*.2; tB.rotation.z=-fr*.004+cx*.15;
      pts.rotation.y=fr*.0004+cx*.08;
      cam.position.x=cx*.35; cam.position.y=-cy*.2; cam.lookAt(sc.position);
      rr.render(sc,cam);
    };
    anim();
    
    return () => { 
      window.removeEventListener('resize', rsz); 
      document.removeEventListener('mousemove', onMM); 
      cancelAnimationFrame(req); 
      rr.dispose(); 
      pg.dispose(); 
    };
  }, []);
  
  return <canvas id="bg-c" ref={mountRef}></canvas>;
}
