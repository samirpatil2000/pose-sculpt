import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { JOINT_NAMES, CONNECTIONS, getJointColor } from '../utils/poseConfig';

export function usePoseEditor(containerRef) {
  const stateRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    joints: [],
    bones: [],
    selectedJoint: null,
    skeletonGroup: null,
  });

  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const plane = useRef(new THREE.Plane());

  function updateBones(joints, bones) {
    bones.forEach((bone) => {
      const start = joints[bone.start].position;
      const end = joints[bone.end].position;
      const distance = start.distanceTo(end);
      bone.mesh.position.copy(start).lerp(end, 0.5);
      bone.mesh.scale.set(1, 1, distance || 0.001);
      if (distance > 0.0001) {
        bone.mesh.lookAt(end);
      }
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.2, 2.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 0.5;
    controls.maxDistance = 10;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, 5, -3);
    scene.add(backLight);

    const gridHelper = new THREE.GridHelper(4, 20, 0xffffff, 0xffffff);
    gridHelper.material.opacity = 0.05;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    const skeletonGroup = new THREE.Group();
    scene.add(skeletonGroup);

    const jointGeo = new THREE.SphereGeometry(0.02, 32, 32);
    const joints = [];

    JOINT_NAMES.forEach((name, i) => {
      const material = new THREE.MeshPhongMaterial({
        color: getJointColor(i),
        emissive: getJointColor(i),
        emissiveIntensity: 0.2,
        shininess: 100,
      });
      const mesh = new THREE.Mesh(jointGeo, material);
      mesh.userData = { id: i, name };
      // Default positions roughly stacked
      mesh.position.set(0, 1.5 - i * 0.03, 0);
      skeletonGroup.add(mesh);
      joints.push(mesh);
    });

    const bones = [];
    const boneGeo = new THREE.CylinderGeometry(0.005, 0.005, 1, 16);
    boneGeo.rotateX(Math.PI / 2);

    CONNECTIONS.forEach((conn) => {
      const mat = new THREE.MeshPhongMaterial({
        color: getJointColor(conn[0]),
        shininess: 80,
        transparent: true,
        opacity: 0.6
      });
      const mesh = new THREE.Mesh(boneGeo, mat);
      skeletonGroup.add(mesh);
      bones.push({ mesh, start: conn[0], end: conn[1] });
    });

    stateRef.current = { scene, camera, renderer, joints, bones, selectedJoint: null, skeletonGroup };

    // Load initial pose (if converted to new format, otherwise it will be messy)
    fetch('/poses/sample.json')
      .then((res) => res.json())
      .then((data) => {
          applyPoseDataToEditor(data);
      })
      .catch((err) => console.error('Error loading initial pose:', err));

    let isDragging = false;
    const onPointerDown = (event) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);

      const intersects = raycaster.current.intersectObjects(joints);
      if (intersects.length > 0) {
        controls.enabled = false;
        stateRef.current.selectedJoint = intersects[0].object;
        isDragging = true;
        stateRef.current.selectedJoint.material.emissiveIntensity = 0.8;
        stateRef.current.selectedJoint.scale.setScalar(1.5);
        document.body.style.cursor = 'grabbing';
        plane.current.setFromNormalAndCoplanarPoint(
          camera.getWorldDirection(new THREE.Vector3()),
          stateRef.current.selectedJoint.position
        );
      }
    };

    const onPointerMove = (event) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      if (!isDragging) {
        raycaster.current.setFromCamera(mouse.current, camera);
        const intersects = raycaster.current.intersectObjects(joints);
        document.body.style.cursor = intersects.length > 0 ? 'grab' : 'default';
        return;
      }
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersectPoint = new THREE.Vector3();
      raycaster.current.ray.intersectPlane(plane.current, intersectPoint);
      if (intersectPoint && stateRef.current.selectedJoint) {
        stateRef.current.selectedJoint.position.copy(intersectPoint);
        updateBones(joints, bones);
      }
    };

    const onPointerUp = () => {
      if (isDragging && stateRef.current.selectedJoint) {
        stateRef.current.selectedJoint.material.emissiveIntensity = 0.2;
        stateRef.current.selectedJoint.scale.setScalar(1);
        isDragging = false;
        stateRef.current.selectedJoint = null;
        controls.enabled = true;
        document.body.style.cursor = 'default';
      }
    };

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onWindowResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    let animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onWindowResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  function applyPoseDataToEditor(data) {
    const { joints, bones } = stateRef.current;
    if (!joints.length || !data) return;
    
    // Check if new nested format or old flat format
    const wl = data.worldLandmarks || data.landmarks || data;
    
    JOINT_NAMES.forEach((name, i) => {
      const jointData = wl[name];
      if (jointData) {
        if (Array.isArray(jointData)) {
            // Old format [x,y,z]
            joints[i].position.set(jointData[0], jointData[1], jointData[2]);
        } else if (typeof jointData === 'object') {
            // New format {x,y,z} (MediaPipe is Y-down, ThreeJS is Y-up)
            joints[i].position.set(jointData.x, -jointData.y, -jointData.z);
        }
      }
    });
    updateBones(joints, bones);
  }

  const loadPose = useCallback(async (name) => {
    try {
      const res = await fetch(`/poses/${name}.json`);
      const data = await res.json();
      applyPoseDataToEditor(data);
    } catch (err) {
      console.error('Error loading pose:', err);
    }
  }, []);

  const exportPNG = useCallback(() => {
    const { renderer, scene, camera } = stateRef.current;
    if (!renderer) return;
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'pose.png';
    link.href = dataURL;
    link.click();
  }, []);

  const getJointData = useCallback(() => {
    const { joints } = stateRef.current;
    if (!joints.length) return null;
    
    const formatted = {
        landmarks: {},
        worldLandmarks: {}
    };

    JOINT_NAMES.forEach((name, i) => {
      const pos = joints[i].position;
      // Convert back to MediaPipe coordinate space (Y-down)
      const data = {
        x: parseFloat(pos.x.toFixed(6)),
        y: parseFloat((-pos.y).toFixed(6)),
        z: parseFloat((-pos.z).toFixed(6)),
        visibility: 1.0
      };
      // In the editor, for simplicity, we provide the same coords for both
      formatted.landmarks[name] = data;
      formatted.worldLandmarks[name] = data;
    });
    return formatted;
  }, []);

  const exportJSON = useCallback(() => {
    const data = getJointData();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'custom_pose.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [getJointData]);

  const importJSON = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        applyPoseDataToEditor(data);
      } catch (err) {
        console.error('Failed to parse JSON:', err);
      }
    };
    reader.readAsText(file);
  }, []);

  return { loadPose, exportPNG, exportJSON, importJSON, getJointData };
}
