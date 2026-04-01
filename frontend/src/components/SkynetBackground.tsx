import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SkynetBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Colors
    const CYAN = 0x00f0ff;
    const GREEN = 0x00ff9d;
    const BLUE = 0x0050c8;

    // OBJECT 1: Large central icosahedron wireframe
    const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const icoMat = new THREE.MeshBasicMaterial({
      color: CYAN,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const icoMesh = new THREE.Mesh(icoGeo, icoMat);
    icoMesh.position.set(3.2, 0, -3);
    scene.add(icoMesh);

    // OBJECT 2: Inner solid icosahedron
    const icoGeo2 = new THREE.IcosahedronGeometry(1.8, 0);
    const icoMat2 = new THREE.MeshBasicMaterial({
      color: BLUE,
      wireframe: true,
      transparent: true,
      opacity: 0.06,
    });
    const icoMesh2 = new THREE.Mesh(icoGeo2, icoMat2);
    icoMesh2.position.set(3.2, 0, -3);
    scene.add(icoMesh2);

    // OBJECT 3: Torus ring
    const torusGeo = new THREE.TorusGeometry(3.5, 0.008, 8, 120);
    const torusMat = new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.18,
    });
    const torusMesh = new THREE.Mesh(torusGeo, torusMat);
    torusMesh.position.set(3.2, 0, -4);
    torusMesh.rotation.x = Math.PI * 0.3;
    scene.add(torusMesh);

    // OBJECT 4: Second tilted ring
    const torus2Geo = new THREE.TorusGeometry(2.8, 0.006, 8, 100);
    const torus2Mat = new THREE.MeshBasicMaterial({
      color: GREEN,
      transparent: true,
      opacity: 0.1,
    });
    const torus2Mesh = new THREE.Mesh(torus2Geo, torus2Mat);
    torus2Mesh.position.set(3.2, 0, -4);
    torus2Mesh.rotation.x = Math.PI * 0.55;
    torus2Mesh.rotation.z = Math.PI * 0.2;
    scene.add(torus2Mesh);

    // OBJECT 5: Dot field
    const PARTICLE_COUNT = 800;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24; // x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14; // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 6; // z
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: CYAN,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // OBJECT 6: Grid floor plane
    const gridHelper = new THREE.GridHelper(30, 28, 0x001828, 0x001828);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.5;
    gridHelper.position.set(0, -3.5, -4);
    gridHelper.rotation.x = Math.PI * 0.04;
    scene.add(gridHelper);

    // Interaction
    let targetRotX = 0, targetRotY = 0;
    let currentRotX = 0, currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetRotY = ((e.clientX / window.innerWidth) - 0.5) * 0.6;
      targetRotX = ((e.clientY / window.innerHeight) - 0.5) * 0.3;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let frame = 0;
    let requestRef: number;
    const animate = () => {
      requestRef = requestAnimationFrame(animate);
      frame++;

      currentRotX += (targetRotX - currentRotX) * 0.04;
      currentRotY += (targetRotY - currentRotY) * 0.04;

      icoMesh.rotation.x = frame * 0.0025 + currentRotX * 0.5;
      icoMesh.rotation.y = frame * 0.004 + currentRotY * 0.5;
      icoMesh2.rotation.x = frame * 0.003 - currentRotX * 0.3;
      icoMesh2.rotation.y = frame * 0.005 - currentRotY * 0.3;

      torusMesh.rotation.z = frame * 0.003 + currentRotY * 0.2;
      torusMesh.rotation.y = frame * 0.002 + currentRotX * 0.1;
      torus2Mesh.rotation.z = -frame * 0.004 + currentRotY * 0.15;
      torus2Mesh.rotation.y = -frame * 0.003 + currentRotX * 0.1;

      particles.rotation.y = frame * 0.0005 + currentRotY * 0.1;
      particles.rotation.x = currentRotX * 0.08;

      camera.position.x = currentRotY * 0.4;
      camera.position.y = -currentRotX * 0.2;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(requestRef);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      id="three-canvas"
      className="fixed inset-0 z-0 opacity-0 animate-fade-in"
      style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
    />
  );
};

export default SkynetBackground;
