export const JOINT_NAMES = [
    "nose","neck","right_shoulder","right_elbow","right_wrist",
    "left_shoulder","left_elbow","left_wrist",
    "right_hip","right_knee","right_ankle",
    "left_hip","left_knee","left_ankle",
    "right_eye","left_eye","right_ear","left_ear"
];

export const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [1,5],[5,6],[6,7],
    [1,8],[8,9],[9,10],
    [1,11],[11,12],[12,13],
    [0,14],[0,15],[14,16],[15,17]
];

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

export const APP_JOINT_MAP = {
    nose: { idx: 0 },
    neck: { avg: [11, 12] },            // avg of left_shoulder + right_shoulder
    right_shoulder: { idx: 12 },
    right_elbow: { idx: 14 },
    right_wrist: { idx: 16 },
    left_shoulder: { idx: 11 },
    left_elbow: { idx: 13 },
    left_wrist: { idx: 15 },
    right_hip: { idx: 24 },
    right_knee: { idx: 26 },
    right_ankle: { idx: 28 },
    left_hip: { idx: 23 },
    left_knee: { idx: 25 },
    left_ankle: { idx: 27 },
    right_eye: { idx: 5 },
    left_eye: { idx: 2 },
    right_ear: { idx: 8 },
    left_ear: { idx: 7 }
};

export function getJointColor(index) {
    if (index === 0 || index >= 14) return 0x9c27b0; // head/face: purple
    if (index >= 2 && index <= 4) return 0xcddc39; // right arm: lime
    if (index >= 5 && index <= 7) return 0x4caf50; // left arm: green
    if (index >= 8 && index <= 10) return 0xffb300; // right leg: amber
    if (index >= 11 && index <= 13) return 0x00bcd4; // left leg: cyan
    if (index === 1) return 0x0000ff; // neck: blue
    return 0xffffff;
}

export function toAppFormat(landmarks, worldLandmarks) {
    const wl = worldLandmarks || landmarks;

    // Convert to Three.js coords (Y-up, negate Y and Z)
    const converted = {};
    for (const [jointName, mapping] of Object.entries(APP_JOINT_MAP)) {
        if (mapping.idx !== undefined) {
            const lm = wl[mapping.idx];
            converted[jointName] = [lm.x, -lm.y, -lm.z];
        } else if (mapping.avg) {
            const a = wl[mapping.avg[0]];
            const b = wl[mapping.avg[1]];
            converted[jointName] = [
                (a.x + b.x) / 2,
                -(a.y + b.y) / 2,
                -(a.z + b.z) / 2
            ];
        }
    }

    // Offset so feet are at Y=0 and hips are centered
    const allY = Object.values(converted).map(c => c[1]);
    const minY = Math.min(...allY);
    const hipX = (converted.left_hip[0] + converted.right_hip[0]) / 2;
    const hipZ = (converted.left_hip[2] + converted.right_hip[2]) / 2;

    const result = {};
    for (const [jointName, coords] of Object.entries(converted)) {
        result[jointName] = [
            parseFloat((coords[0] - hipX).toFixed(3)),
            parseFloat((coords[1] - minY).toFixed(3)),
            parseFloat((coords[2] - hipZ).toFixed(3))
        ];
    }
    return result;
}

export function toRawFormat(landmarks, worldLandmarks) {
    const poses = [];
    for (let p = 0; p < landmarks.length; p++) {
        const pose = { landmarks: {}, worldLandmarks: {} };
        for (let i = 0; i < landmarks[p].length; i++) {
            const name = MP_LANDMARK_NAMES[i] || `landmark_${i}`;
            const lm = landmarks[p][i];
            pose.landmarks[name] = {
                x: parseFloat(lm.x.toFixed(6)),
                y: parseFloat(lm.y.toFixed(6)),
                z: parseFloat(lm.z.toFixed(6)),
                visibility: parseFloat(lm.visibility.toFixed(4))
            };
            if (worldLandmarks && worldLandmarks[p]) {
                const wl = worldLandmarks[p][i];
                pose.worldLandmarks[name] = {
                    x: parseFloat(wl.x.toFixed(6)),
                    y: parseFloat(wl.y.toFixed(6)),
                    z: parseFloat(wl.z.toFixed(6)),
                    visibility: parseFloat(wl.visibility.toFixed(4))
                };
            }
        }
        poses.push(pose);
    }
    return poses.length === 1 ? poses[0] : poses;
}
