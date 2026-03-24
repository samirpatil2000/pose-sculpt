import * as THREE from 'three';

/**
 * Maps pairs of MediaPipe landmarks → GLB bone names.
 */
export const BONE_MAP = [
  // Left leg
  { bone: 'LeftUpLeg',   from: 'left_hip',      to: 'left_knee' },
  { bone: 'LeftLeg',     from: 'left_knee',      to: 'left_ankle' },

  // Right leg
  { bone: 'RightUpLeg',  from: 'right_hip',      to: 'right_knee' },
  { bone: 'RightLeg',    from: 'right_knee',      to: 'right_ankle' },

  // Left arm
  { bone: 'LeftArm',     from: 'left_shoulder',  to: 'left_elbow' },
  { bone: 'LeftForeArm', from: 'left_elbow',      to: 'left_wrist' },

  // Right arm
  { bone: 'RightArm',    from: 'right_shoulder', to: 'right_elbow' },
  { bone: 'RightForeArm',from: 'right_elbow',    to: 'right_wrist' },

  // Head (uses a virtual 'neck' joint)
  { bone: 'Head',        from: 'neck',           to: 'nose' },
];

const PROCESSING_ORDER = [
  'LeftUpLeg', 'LeftLeg',
  'RightUpLeg', 'RightLeg',
  'LeftArm', 'LeftForeArm',
  'RightArm', 'RightForeArm',
  'Head',
];

let restPose = null;

export function captureRestPose(boneRefs) {
  restPose = {};
  const rootBone = boneRefs['Hips'];
  if (rootBone) rootBone.updateWorldMatrix(true, true);

  for (const { bone: boneName } of BONE_MAP) {
    const bone = boneRefs[boneName];
    if (!bone) continue;

    const restLocalQuat = bone.quaternion.clone();
    const restWorldQuat = new THREE.Quaternion();
    bone.getWorldQuaternion(restWorldQuat);

    const boneLocalDir = new THREE.Vector3(0, 1, 0);
    const restWorldDir = boneLocalDir.clone().applyQuaternion(restWorldQuat).normalize();

    restPose[boneName] = { restLocalQuat, restWorldQuat, restWorldDir };
  }

  if (rootBone) {
    restPose['Hips'] = {
      restLocalQuat: rootBone.quaternion.clone(),
      restPosition: rootBone.position.clone(),
    };
  }
}

/**
 * Apply joint positions to a skinned GLB model's skeleton.
 * @param {Object} boneRefs - Map of bone name → THREE.Bone
 * @param {Object} poseData - The new nested { landmarks, worldLandmarks } structure
 */
export function applyPoseToModel(boneRefs, poseData) {
  if (!boneRefs || !poseData) return;
  
  // Extract world landmarks and convert to Vector3 as needed
  // MediaPipe world landmarks are in meters, centered at hips.
  // Our model coordinates are in cm, so we scale by 100.
  const wl = poseData.worldLandmarks || poseData.landmarks;
  if (!wl) return;

  const jointPositions = {};
  for (const [name, data] of Object.entries(wl)) {
      // MediaPipe: Y is down, Z is depth (negative is closer to camera)
      // Three.js: Y is up, Z is toward camera
      // So we use: x, -y, -z
      jointPositions[name] = new THREE.Vector3(data.x, -data.y, -data.z);
  }

  // Calculate virtual 'neck' joint (midpoint of shoulders)
  if (jointPositions.left_shoulder && jointPositions.right_shoulder) {
    jointPositions.neck = new THREE.Vector3()
      .addVectors(jointPositions.left_shoulder, jointPositions.right_shoulder)
      .multiplyScalar(0.5);
  }

  if (!restPose) captureRestPose(boneRefs);

  // 1. Reset rotations
  for (const { bone: boneName } of BONE_MAP) {
    const bone = boneRefs[boneName];
    if (bone && restPose[boneName]) {
      bone.quaternion.copy(restPose[boneName].restLocalQuat);
    }
  }
  if (boneRefs['Hips'] && restPose['Hips']) {
    boneRefs['Hips'].quaternion.copy(restPose['Hips'].restLocalQuat);
    boneRefs['Hips'].position.copy(restPose['Hips'].restPosition);
  }

  if (boneRefs['Hips']) boneRefs['Hips'].updateWorldMatrix(true, true);

  // 2. Apply hip position (root translation)
  if (boneRefs['Hips'] && jointPositions.left_hip && jointPositions.right_hip) {
    const hipCenter = new THREE.Vector3()
      .addVectors(jointPositions.left_hip, jointPositions.right_hip)
      .multiplyScalar(0.5);

    const scale = 100;
    boneRefs['Hips'].position.set(
      hipCenter.x * scale,
      hipCenter.y * scale,
      hipCenter.z * scale
    );
    boneRefs['Hips'].updateWorldMatrix(true, true);
  }

  // 3. Process bones
  for (const boneName of PROCESSING_ORDER) {
    const mapping = BONE_MAP.find(m => m.bone === boneName);
    if (!mapping) continue;

    const bone = boneRefs[boneName];
    const rest = restPose[boneName];
    if (!bone || !rest) continue;

    const fromPos = jointPositions[mapping.from];
    const toPos = jointPositions[mapping.to];
    if (!fromPos || !toPos) continue;

    const targetDir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();
    const restDir = rest.restWorldDir;
    const deltaWorldQuat = new THREE.Quaternion().setFromUnitVectors(restDir, targetDir);
    const newWorldQuat = deltaWorldQuat.clone().multiply(rest.restWorldQuat);

    bone.parent.updateWorldMatrix(true, false);
    const parentWorldQuat = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuat);

    const newLocalQuat = parentWorldQuat.clone().invert().multiply(newWorldQuat);
    bone.quaternion.copy(newLocalQuat);
    bone.updateWorldMatrix(false, true);
  }
}
