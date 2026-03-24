import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyPoseToModel, captureRestPose } from '../utils/boneMappings';

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
  const [playbackState, setPlaybackState] = useState({
    isPlaying: false,
    currentFrame: 0,
    totalFrames: 0,
  });
  const sequenceRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) {
      setContainerReady(false);
      return;
    }
    setContainerReady(true);
  });

  useEffect(() => {
    if (!containerReady || !containerRef.current) return;
    if (stateRef.current.initialized) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111114);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
    camera.position.set(0, 1.0, 3.5);
    camera.lookAt(0, 0.8, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 0.3;
    controls.maxDistance = 8;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(2, 4, 3);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, 3, -3);
    scene.add(backLight);

    const gridHelper = new THREE.GridHelper(3, 15, 0xffffff, 0xffffff);
    gridHelper.material.opacity = 0.06;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    stateRef.current = {
      ...stateRef.current,
      scene, camera, renderer, controls,
      boneRefs: {}, model: null, initialized: true,
    };

    const loader = new GLTFLoader();
    loader.load('/sample-model.glb', (gltf) => {
      const model = gltf.scene;
      model.position.set(0, 0, 0);

      const boneRefs = {};
      model.traverse((child) => {
        if (child.isBone) boneRefs[child.name] = child;
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

      model.updateMatrixWorld(true);
      captureRestPose(boneRefs);

      if (stateRef.current.pendingPose) {
        applyPoseToModel(boneRefs, stateRef.current.pendingPose);
        stateRef.current.pendingPose = null;
      }
    }, undefined, (err) => {
      console.error('Error loading GLB model:', err);
    });

    const animate = () => {
      stateRef.current.animFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

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

  /** Apply pose data (the new nested structure) to the GLB model */
  const applyPose = useCallback((poseData) => {
    const { boneRefs } = stateRef.current;
    if (Object.keys(boneRefs).length === 0) {
      stateRef.current.pendingPose = poseData;
      return;
    }
    applyPoseToModel(boneRefs, poseData);
  }, []);

  const pauseSequence = useCallback(() => {
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    setPlaybackState(s => ({ ...s, isPlaying: false }));
  }, []);

  const playSequence = useCallback((sequenceData, fps = 30) => {
    if (!sequenceData || Object.keys(sequenceData).length === 0) return;
    
    // Convert object { "0": pose, "1": pose } to sorted array if needed
    // Assuming keys are sequential integers.
    const frames = Object.keys(sequenceData).sort((a,b) => parseInt(a) - parseInt(b)).map(k => sequenceData[k]);
    sequenceRef.current = frames;
    
    setPlaybackState(s => ({ 
      ...s, 
      isPlaying: true, 
      totalFrames: frames.length,
      // If we are at the end, restart
      currentFrame: s.currentFrame >= frames.length - 1 ? 0 : s.currentFrame 
    }));

    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    
    playbackIntervalRef.current = setInterval(() => {
      setPlaybackState(prev => {
        let nextFrame = prev.currentFrame + 1;
        if (nextFrame >= frames.length) {
          nextFrame = 0; // Loop or stop? Let's loop for now
        }
        applyPose(frames[nextFrame]);
        return { ...prev, currentFrame: nextFrame };
      });
    }, 1000 / fps);
  }, [applyPose]);

  const stopSequence = useCallback(() => {
    pauseSequence();
    setPlaybackState(s => ({ ...s, currentFrame: 0, totalFrames: 0 }));
    sequenceRef.current = null;
  }, [pauseSequence]);

  const seekFrame = useCallback((frameIndex) => {
    if (!sequenceRef.current) return;
    const len = sequenceRef.current.length;
    let idx = parseInt(frameIndex);
    if (idx < 0) idx = 0;
    if (idx >= len) idx = len - 1;
    
    setPlaybackState(s => ({ ...s, currentFrame: idx }));
    applyPose(sequenceRef.current[idx]);
  }, [applyPose]);

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

  return { 
    applyPose, zoomIn, zoomOut, 
    playbackState, playSequence, pauseSequence, stopSequence, seekFrame 
  };
}
