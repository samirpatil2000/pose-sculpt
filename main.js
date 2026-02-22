import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Configuration ---
const JOINT_NAMES = [
    "nose","neck","right_shoulder","right_elbow","right_wrist",
    "left_shoulder","left_elbow","left_wrist",
    "right_hip","right_knee","right_ankle",
    "left_hip","left_knee","left_ankle",
    "right_eye","left_eye","right_ear","left_ear"
];

const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [1,5],[5,6],[6,7],
    [1,8],[8,9],[9,10],
    [1,11],[11,12],[12,13],
    [0,14],[14,16],
    [0,15],[15,17]
];

// --- State ---
let scene, camera, renderer, controls;
let skeletonGroup;
const joints = [];
const bones = [];
let selectedJoint = null;
let hoveredJoint = null;
let isDragging = false;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const intersection = new THREE.Vector3();
const offset = new THREE.Vector3();

// Target states for smooth animation
const targetScales = new Map();
const targetColors = new Map();

// --- Color Utilities ---
function getJointColor(index) {
    const colors = [
        0xff00ff, 0x0000ff, 0xff4500, 0xffd700, 0xff8c00, 
        0xadff2f, 0x32cd32, 0x00ff00, 0x00ffff, 0x007fff, 
        0x4b0082, 0x00fa9a, 0x00ced1, 0x00ffff, 0xff00ff, 
        0xff00ff, 0xff00ff, 0xff00ff
    ];
    return colors[index] || 0xffffff;
}

function getConnectionColor(index) {
    if (index === 0) return 0xff00ff; // neck
    if (index >= 1 && index <= 3) return 0xff8c00; // r_arm
    if (index >= 4 && index <= 6) return 0x32cd32; // l_arm
    if (index >= 7 && index <= 9) return 0x007fff; // r_leg
    if (index >= 10 && index <= 12) return 0x00ced1; // l_leg
    if (index >= 13) return 0xff00ff; // face
    return 0xffffff;
}

// --- Init ---
init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();
    // Transparent background to show CSS gradient
    scene.background = null;

    // Camera
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.2, 2.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.minDistance = 0.5;
    controls.maxDistance = 10;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-2, 5, -3);
    scene.add(backLight);

    // Grid (Subtle)
    const gridHelper = new THREE.GridHelper(4, 20, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.05;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Skeleton Group
    skeletonGroup = new THREE.Group();
    scene.add(skeletonGroup);

    // Create default skeleton
    createSkeleton();

    // Events
    window.addEventListener('resize', onWindowResize);
    
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    // UI Buttons
    document.getElementById('pose-select').addEventListener('change', (e) => {
        loadPose(e.target.value);
    });
    document.getElementById('btn-export-png').addEventListener('click', exportPNG);
    document.getElementById('btn-export-json').addEventListener('click', exportJSON);

    // Load initial pose
    loadPose('sample');
}

function createSkeleton() {
    // Create Joints
    const jointGeometry = new THREE.SphereGeometry(0.04, 32, 32);
    for (let i = 0; i < JOINT_NAMES.length; i++) {
        const baseColor = new THREE.Color(getJointColor(i));
        const jointMaterial = new THREE.MeshStandardMaterial({ 
            color: baseColor, 
            roughness: 0.3, 
            metalness: 0.2 
        });
        const joint = new THREE.Mesh(jointGeometry, jointMaterial);
        // Default position
        joint.position.set(0, 1.5 - i * 0.05, 0);
        joint.userData.index = i;
        joint.userData.name = JOINT_NAMES[i];
        joint.userData.baseColor = baseColor;
        skeletonGroup.add(joint);
        joints.push(joint);
        
        targetScales.set(joint, 1.0);
        targetColors.set(joint, baseColor.clone());
    }

    // Create Bones
    const boneGeometry = new THREE.CylinderGeometry(0.015, 0.015, 1, 8);
    boneGeometry.rotateX(Math.PI / 2);

    for (let i = 0; i < CONNECTIONS.length; i++) {
        const [idxA, idxB] = CONNECTIONS[i];
        const color = getConnectionColor(i);
        const boneMaterial = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.4,
            metalness: 0.1 
        });
        
        const bone = new THREE.Mesh(boneGeometry, boneMaterial);
        skeletonGroup.add(bone);
        bones.push({ line: bone, idxA, idxB });
    }
    updateBones();
}

function updateBones() {
    for (let i = 0; i < bones.length; i++) {
        const { line: mesh, idxA, idxB } = bones[i];
        const pA = joints[idxA].position;
        const pB = joints[idxB].position;
        
        const distance = pA.distanceTo(pB);
        if (distance < 0.001) {
            mesh.visible = false;
        } else {
            mesh.visible = true;
            mesh.position.copy(pA).lerp(pB, 0.5);
            mesh.lookAt(pB);
            mesh.scale.set(1, 1, distance);
        }
    }
}

// --- Interaction ---

function getIntersects(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(joints);
}

function onPointerDown(event) {
    const intersects = getIntersects(event);
    if (intersects.length > 0) {
        controls.enabled = false;
        selectedJoint = intersects[0].object;
        isDragging = true;
        
        // Setup drag plane facing camera
        dragPlane.setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(dragPlane.normal),
            selectedJoint.position
        );
        
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            offset.copy(intersection).sub(selectedJoint.position);
        }
        
        targetScales.set(selectedJoint, 1.3);
        targetColors.set(selectedJoint, new THREE.Color(0xffffff));
        
        document.body.style.cursor = 'grabbing';
    }
}

function onPointerMove(event) {
    if (isDragging && selectedJoint) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        
        if (raycaster.ray.intersectPlane(dragPlane, intersection)) {
            selectedJoint.position.copy(intersection.sub(offset));
            updateBones();
        }
    } else {
        // Hover effect
        const intersects = getIntersects(event);
        if (intersects.length > 0) {
            document.body.style.cursor = 'grab';
            const joint = intersects[0].object;
            
            if (hoveredJoint !== joint) {
                if (hoveredJoint && hoveredJoint !== selectedJoint) {
                    targetScales.set(hoveredJoint, 1.0);
                    targetColors.set(hoveredJoint, hoveredJoint.userData.baseColor.clone());
                }
                hoveredJoint = joint;
                if (hoveredJoint !== selectedJoint) {
                    targetScales.set(hoveredJoint, 1.15);
                    targetColors.set(hoveredJoint, hoveredJoint.userData.baseColor.clone().addScalar(0.2));
                }
            }
        } else {
            document.body.style.cursor = 'default';
            if (hoveredJoint && hoveredJoint !== selectedJoint) {
                targetScales.set(hoveredJoint, 1.0);
                targetColors.set(hoveredJoint, hoveredJoint.userData.baseColor.clone());
                hoveredJoint = null;
            }
        }
    }
}

function onPointerUp() {
    if (selectedJoint) {
        targetScales.set(selectedJoint, hoveredJoint === selectedJoint ? 1.15 : 1.0);
        targetColors.set(selectedJoint, hoveredJoint === selectedJoint ? selectedJoint.userData.baseColor.clone().addScalar(0.2) : selectedJoint.userData.baseColor.clone());
        selectedJoint = null;
    }
    isDragging = false;
    controls.enabled = true;
    if (!hoveredJoint) {
        document.body.style.cursor = 'default';
    } else {
        document.body.style.cursor = 'grab';
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Smoothly interpolate scales and colors
    joints.forEach(joint => {
        const targetScale = targetScales.get(joint);
        const currentScale = joint.scale.x;
        const newScale = currentScale + (targetScale - currentScale) * 0.15;
        joint.scale.setScalar(newScale);
        
        const targetColor = targetColors.get(joint);
        joint.material.color.lerp(targetColor, 0.15);
    });
    
    renderer.render(scene, camera);
}

// --- Actions ---

async function loadPose(poseName = 'sample') {
    try {
        const response = await fetch(`/poses/${poseName}.json`);
        if (!response.ok) throw new Error('Failed to load pose');
        const data = await response.json();
        
        JOINT_NAMES.forEach((name, i) => {
            if (data[name]) {
                const [x, y, z] = data[name];
                joints[i].position.set(x, y, z);
            }
        });
        updateBones();
    } catch (err) {
        console.error('Error loading pose:', err);
    }
}

function exportPNG() {
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL("image/png");
    
    const link = document.createElement('a');
    link.download = 'pose.png';
    link.href = dataURL;
    link.click();
}

function exportJSON() {
    const data = {};
    joints.forEach(joint => {
        data[joint.userData.name] = [
            parseFloat(joint.position.x.toFixed(3)),
            parseFloat(joint.position.y.toFixed(3)),
            parseFloat(joint.position.z.toFixed(3))
        ];
    });
    
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = 'pose.json';
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
}
