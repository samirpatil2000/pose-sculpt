import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPoseToModel, captureRestPose } from '../utils/boneMappings';

/**
 * Hook that renders a 3D preview of the GLB mannequin model.
 * Supports lazy initialization — the scene builds when the container ref is set.
 * Call `applyPose(poseData)` to update the model's pose.
 */
export function useModelPreview(containerRef) {
  const stateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    boneRefs: {},
    model: null,
    animFrameId: null,
    initialized: false,
    pendingPose: null,
  });

  const [containerReady, setContainerReady] = useState(false);

  // Watch for container becoming available
  useEffect(() => {
    if (!containerRef.current) {
      setContainerReady(false);
      return;
    }
    setContainerReady(true);
  });

  // Build 3D scene when container is ready
  useEffect(() => {
    if (!containerReady || !containerRef.current) return;
    if (stateRef.current.initialized) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111114);

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
    camera.position.set(0, 1.0, 3.5);
    camera.lookAt(0, 0.8, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 0.3;
    controls.maxDistance = 8;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, 3, -3);
    scene.add(backLight);

    // Grid
    const gridHelper = new THREE.GridHelper(3, 15, 0xffffff, 0xffffff);
    gridHelper.material.opacity = 0.06;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Store state
    stateRef.current = {
      ...stateRef.current,
      scene, camera, renderer, controls,
      boneRefs: {}, model: null, initialized: true,
    };

    // Load GLB model
    const loader = new GLTFLoader();
    loader.load('/sample-model.glb', (gltf) => {
      const model = gltf.scene;

      // The GLB's Armature node already has scale 0.01 baked in (cm → meters).
      // Do NOT apply additional scaling.
      model.position.set(0, 0, 0);

      const boneRefs = {};
      model.traverse((child) => {
        if (child.isBone) {
          boneRefs[child.name] = child;
        }
        if (child.isMesh) {
          child.material = new THREE.MeshPhongMaterial({
            color: 0xdddddd,
            shininess: 60,
          });
        }
      });

      scene.add(model);
      stateRef.current.boneRefs = boneRefs;
      stateRef.current.model = model;

      // Capture T-pose rest state for rotation calculations
      model.updateMatrixWorld(true);
      captureRestPose(boneRefs);

      // Apply any pending pose
      if (stateRef.current.pendingPose) {
        applyPoseInternal(stateRef.current.pendingPose);
        stateRef.current.pendingPose = null;
      }
    }, undefined, (err) => {
      console.error('Error loading GLB model:', err);
    });

    // Animation loop
    const animate = () => {
      stateRef.current.animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle container resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    observer.observe(container);

    // Cleanup
    return () => {
      stateRef.current.initialized = false;
      cancelAnimationFrame(stateRef.current.animFrameId);
      observer.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [containerReady]);

  function applyPoseInternal(poseData) {
    const { boneRefs } = stateRef.current;
    if (!poseData || Object.keys(boneRefs).length === 0) return;

    // Convert poseData arrays to Vector3
    const positions = {};
    for (const [name, coords] of Object.entries(poseData)) {
      if (Array.isArray(coords) && coords.length === 3) {
        positions[name] = new THREE.Vector3(coords[0], coords[1], coords[2]);
      }
    }

    applyPoseToModel(boneRefs, positions);
  }

  /** Apply pose data (18-joint object) to the GLB model */
  const applyPose = useCallback((poseData) => {
    if (Object.keys(stateRef.current.boneRefs).length === 0) {
      stateRef.current.pendingPose = poseData;
      return;
    }
    applyPoseInternal(poseData);
  }, []);

  const zoomIn = useCallback(() => {
    const { controls } = stateRef.current;
    if (!controls) return;
    const dir = new THREE.Vector3().subVectors(controls.target, stateRef.current.camera.position).normalize();
    stateRef.current.camera.position.addScaledVector(dir, 0.3);
    controls.update();
  }, []);

  const zoomOut = useCallback(() => {
    const { controls } = stateRef.current;
    if (!controls) return;
    const dir = new THREE.Vector3().subVectors(controls.target, stateRef.current.camera.position).normalize();
    stateRef.current.camera.position.addScaledVector(dir, -0.3);
    controls.update();
  }, []);

  return { applyPose, zoomIn, zoomOut };
}
