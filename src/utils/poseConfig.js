export const MP_LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index"
];

// For the Pose Editor, we now use all 33 native landmarks
export const JOINT_NAMES = [...MP_LANDMARK_NAMES];

// Standard MediaPipe Pose Connections (33 landmarks)
export const CONNECTIONS = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [12, 11], [15, 21], [15, 17], [15, 19], [17, 19], [16, 22], [16, 18], [16, 20], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
    [0, 1], [0, 4], [1, 2], [2, 3], [3, 7], [4, 5], [5, 6], [6, 8], [9, 10]
];

export function getJointColor(index) {
    if (index <= 10) return 0x9c27b0; // head/face: purple
    if ([12, 14, 16, 18, 20, 22].includes(index)) return 0xcddc39; // right arm: lime
    if ([11, 13, 15, 17, 19, 21].includes(index)) return 0x4caf50; // left arm: green
    if ([24, 26, 28, 30, 32].includes(index)) return 0xffb300; // right leg: amber
    if ([23, 25, 27, 29, 31].includes(index)) return 0x00bcd4; // left leg: cyan
    return 0xffffff;
}

/**
 * Formats MediaPipe results into the nested { landmarks, worldLandmarks } structure.
 * @param {Array} landmarks - Screen-space landmarks
 * @param {Array} worldLandmarks - Meter-space world landmarks
 */
export function toAppFormat(landmarks, worldLandmarks) {
    if (!landmarks) return null;
    
    const formatted = {
        landmarks: {},
        worldLandmarks: {}
    };

    for (let i = 0; i < landmarks.length; i++) {
        const name = MP_LANDMARK_NAMES[i] || `landmark_${i}`;
        const lm = landmarks[i];
        formatted.landmarks[name] = {
            x: parseFloat(lm.x.toFixed(6)),
            y: parseFloat(lm.y.toFixed(6)),
            z: parseFloat(lm.z.toFixed(6)),
            visibility: parseFloat((lm.visibility || 0).toFixed(4))
        };
        
        if (worldLandmarks && worldLandmarks[i]) {
            const wl = worldLandmarks[i];
            formatted.worldLandmarks[name] = {
                x: parseFloat(wl.x.toFixed(6)),
                y: parseFloat(wl.y.toFixed(6)),
                z: parseFloat(wl.z.toFixed(6)),
                visibility: parseFloat((wl.visibility || 0).toFixed(4))
            };
        }
    }
    
    return formatted;
}

/** Legacy support - actually same as toAppFormat now but handles array of results */
export function toRawFormat(landmarks, worldLandmarks) {
    if (!landmarks) return null;
    if (Array.isArray(landmarks[0])) {
        return landmarks.map((l, i) => toAppFormat(l, worldLandmarks?.[i]));
    }
    return toAppFormat(landmarks, worldLandmarks);
}
