"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Animated hero background: a wireframe icosahedron orbited by a
 * particle field, drifting and reacting to pointer movement.
 */
export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Central wireframe icosahedron
    const coreGeometry = new THREE.IcosahedronGeometry(2.1, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0xd6ff3f,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);

    // Inner solid shell for depth
    const shellGeometry = new THREE.IcosahedronGeometry(1.55, 1);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x6d6dff,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    scene.add(shell);

    // Particle field
    const particleCount = 600;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 4 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    const particlesMaterial = new THREE.PointsMaterial({
      color: 0xf5f5f0,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
    });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    // Pointer parallax
    const pointer = { x: 0, y: 0 };
    const targetRotation = { x: 0, y: 0 };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    };
    window.addEventListener("pointermove", handlePointerMove);

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      core.rotation.x = elapsed * 0.08;
      core.rotation.y = elapsed * 0.12;
      shell.rotation.x = -elapsed * 0.05;
      shell.rotation.y = -elapsed * 0.09;
      particles.rotation.y = elapsed * 0.015;

      targetRotation.x += (pointer.y * 0.4 - targetRotation.x) * 0.04;
      targetRotation.y += (pointer.x * 0.4 - targetRotation.y) * 0.04;
      scene.rotation.x = targetRotation.x;
      scene.rotation.y = targetRotation.y;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      coreGeometry.dispose();
      coreMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 z-0 [&>canvas]:!h-full [&>canvas]:!w-full"
      aria-hidden="true"
    />
  );
}
