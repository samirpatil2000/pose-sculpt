import * as THREE from 'three';

/**
 * Maps pairs of app joints → GLB bone names.
 * `from` and `to` are joint names from our 18-joint pose format.
 * The bone should point from `from` towards `to`.
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

  // Head
  { bone: 'Head',        from: 'neck',           to: 'nose' },
];

// Processing order: parents before children
const PROCESSING_ORDER = [
  'LeftUpLeg', 'LeftLeg',
  'RightUpLeg', 'RightLeg',
  'LeftArm', 'LeftForeArm',
  'RightArm', 'RightForeArm',
  'Head',
];

// Rest pose data captured from the T-pose
let restPose = null;

/**
 * Capture the rest (T-pose) state of each mapped bone.
 * Must be called once when the GLB model first loads.
 */
export function captureRestPose(boneRefs) {
  restPose = {};

  // Ensure all world matrices are current
  const rootBone = boneRefs['Hips'];
  if (rootBone) {
    rootBone.updateWorldMatrix(true, true);
  }

  for (const { bone: boneName } of BONE_MAP) {
    const bone = boneRefs[boneName];
    if (!bone) continue;

    // Store rest local quaternion
    const restLocalQuat = bone.quaternion.clone();

    // Store rest world quaternion
    const restWorldQuat = new THREE.Quaternion();
    bone.getWorldQuaternion(restWorldQuat);

    // Compute rest world direction:
    // All bones in this model point along local Y-axis (0,1,0).
    // Transform that to world space to get the bone's rest direction.
    const boneLocalDir = new THREE.Vector3(0, 1, 0);
    const restWorldDir = boneLocalDir.clone().applyQuaternion(restWorldQuat).normalize();

    restPose[boneName] = { restLocalQuat, restWorldQuat, restWorldDir };
  }

  // Also capture Hips rest
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
 * @param {Object} jointPositions - Map of joint name → THREE.Vector3
 */
export function applyPoseToModel(boneRefs, jointPositions) {
  if (!boneRefs || !jointPositions) return;

  // Capture rest pose on first call
  if (!restPose) {
    captureRestPose(boneRefs);
  }

  // 1. Reset ALL mapped bones to their rest-pose rotations
  for (const { bone: boneName } of BONE_MAP) {
    const bone = boneRefs[boneName];
    if (bone && restPose[boneName]) {
      bone.quaternion.copy(restPose[boneName].restLocalQuat);
    }
  }

  // Reset Hips
  if (boneRefs['Hips'] && restPose['Hips']) {
    boneRefs['Hips'].quaternion.copy(restPose['Hips'].restLocalQuat);
    boneRefs['Hips'].position.copy(restPose['Hips'].restPosition);
  }

  // Update all world matrices after reset
  if (boneRefs['Hips']) {
    boneRefs['Hips'].updateWorldMatrix(true, true);
  }

  // 2. Apply hip position (root translation)
  if (boneRefs['Hips'] && jointPositions['left_hip'] && jointPositions['right_hip']) {
    const hipCenter = new THREE.Vector3()
      .addVectors(jointPositions['left_hip'], jointPositions['right_hip'])
      .multiplyScalar(0.5);

    // Scale: the model is in centimeter units, our pose data is in ~meter-ish units
    // The Hips rest position Y is ~79.6 (cm). Standing pose hip Y is ~0.8 (our units).
    // So scale factor is roughly 79.6 / 0.8 ≈ 100
    const scale = 100;
    boneRefs['Hips'].position.set(
      hipCenter.x * scale,
      hipCenter.y * scale,
      hipCenter.z * scale
    );
    boneRefs['Hips'].updateWorldMatrix(true, true);
  }

  // 3. Process each bone in hierarchy order
  for (const boneName of PROCESSING_ORDER) {
    const mapping = BONE_MAP.find(m => m.bone === boneName);
    if (!mapping) continue;

    const bone = boneRefs[boneName];
    const rest = restPose[boneName];
    if (!bone || !rest) continue;

    const fromPos = jointPositions[mapping.from];
    const toPos = jointPositions[mapping.to];
    if (!fromPos || !toPos) continue;

    // Target direction in world space
    const targetDir = new THREE.Vector3().subVectors(toPos, fromPos).normalize();

    // The bone's rest direction in world space (captured from T-pose)
    const restDir = rest.restWorldDir;

    // World-space rotation from rest direction to target direction
    const deltaWorldQuat = new THREE.Quaternion().setFromUnitVectors(restDir, targetDir);

    // New desired world quaternion = delta * restWorld
    const newWorldQuat = deltaWorldQuat.clone().multiply(rest.restWorldQuat);

    // Convert to local space: localQuat = inv(currentParentWorld) * newWorldQuat
    bone.parent.updateWorldMatrix(true, false);
    const parentWorldQuat = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWorldQuat);

    const newLocalQuat = parentWorldQuat.clone().invert().multiply(newWorldQuat);
    bone.quaternion.copy(newLocalQuat);

    // Update this bone's world matrix so children see the new transform
    bone.updateWorldMatrix(false, true);
  }
}
