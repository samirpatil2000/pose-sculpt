import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';

// ── MediaPipe 33 landmark names ──
const MP_LANDMARK_NAMES = [
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

// ── Mapping from app's 18-joint format to MediaPipe indices ──
// App joints: nose, neck(avg shoulders), r_shoulder, r_elbow, r_wrist,
//             l_shoulder, l_elbow, l_wrist, r_hip, r_knee, r_ankle,
//             l_hip, l_knee, l_ankle, r_eye, l_eye, r_ear, l_ear
const APP_JOINT_MAP = {
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

// ── DOM ──
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const previewWrapper = document.getElementById('preview-wrapper');
const previewImg = document.getElementById('preview-img');
const overlayCanvas = document.getElementById('overlay-canvas');
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('status-text');
const jsonOutput = document.getElementById('json-output');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');
const formatToggle = document.getElementById('format-toggle');
const btnRetry = document.getElementById('btn-retry');
const toast = document.getElementById('toast');

// ── State ──
let poseLandmarker = null;
let currentResult = null;
let currentFormat = 'app';

// ── Init MediaPipe ──
async function initMediaPipe() {
    setStatus('Loading MediaPipe model…', true);
    try {
        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                delegate: 'GPU'
            },
            runningMode: 'IMAGE',
            numPoses: 1
        });
        setStatus('Ready — upload an image', false);
    } catch (err) {
        console.error('MediaPipe init error:', err);
        setStatus('Failed to load model. Check console.', false);
    }
}

// ── Upload Handling ──
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

// Drag & Drop
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file');
        return;
    }

    // Show preview
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    previewWrapper.style.display = 'block';
    uploadArea.style.display = 'none';

    previewImg.onload = async () => {
        // Size canvas to match image
        overlayCanvas.width = previewImg.naturalWidth;
        overlayCanvas.height = previewImg.naturalHeight;

        if (!poseLandmarker) {
            setStatus('Model still loading…', true);
            await waitForModel();
        }

        await detectPose();
    };
}

async function waitForModel() {
    while (!poseLandmarker) {
        await new Promise(r => setTimeout(r, 200));
    }
}

async function detectPose() {
    setStatus('Detecting pose…', true);

    try {
        const result = poseLandmarker.detect(previewImg);
        currentResult = result;

        if (!result.landmarks || result.landmarks.length === 0) {
            setStatus('No pose detected — try another image', false);
            jsonOutput.textContent = 'No pose detected in this image.';
            jsonOutput.classList.remove('has-data');
            return;
        }

        // Draw landmarks on canvas
        drawLandmarks(result);

        // Display JSON
        updateJsonDisplay();

        // Enable buttons
        btnCopy.disabled = false;
        btnDownload.disabled = false;
        btnRetry.style.display = 'flex';

        setStatus(`Detected ${result.landmarks.length} pose(s) — ${result.landmarks[0].length} landmarks`, false);
    } catch (err) {
        console.error('Detection error:', err);
        setStatus('Detection failed. Check console.', false);
    }
}

// ── Drawing ──
function drawLandmarks(result) {
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const drawingUtils = new DrawingUtils(ctx);

    for (const landmarks of result.landmarks) {
        drawingUtils.drawLandmarks(landmarks, {
            radius: (data) => DrawingUtils.lerp(data.from.z, -0.15, 0.1, 5, 1),
            color: '#FF0071',
            fillColor: '#FF007188'
        });
        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
            color: '#00E1FF',
            lineWidth: 3
        });
    }
}

// ── JSON Formatting ──
function toAppFormat(landmarks, worldLandmarks) {
    const wl = worldLandmarks || landmarks;

    // Step 1: Convert all relevant landmarks to Three.js coords (Y-up, negate Y and Z)
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

    // Step 2: Find the lowest Y (feet) to use as ground, and center X on hips
    const allY = Object.values(converted).map(c => c[1]);
    const minY = Math.min(...allY);
    const hipX = (converted.left_hip[0] + converted.right_hip[0]) / 2;
    const hipZ = (converted.left_hip[2] + converted.right_hip[2]) / 2;

    // Step 3: Offset so feet are at Y=0 and hips are centered on X=0, Z=0
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

function toRawFormat(landmarks, worldLandmarks) {
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

function getFormattedJson() {
    if (!currentResult || !currentResult.landmarks || currentResult.landmarks.length === 0) return null;

    if (currentFormat === 'app') {
        return toAppFormat(currentResult.landmarks[0], currentResult.worldLandmarks?.[0]);
    } else {
        return toRawFormat(currentResult.landmarks, currentResult.worldLandmarks);
    }
}

function updateJsonDisplay() {
    const data = getFormattedJson();
    if (!data) return;

    jsonOutput.textContent = JSON.stringify(data, null, 2);
    jsonOutput.classList.add('has-data');
}

// ── Format Toggle ──
formatToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-format]');
    if (!btn) return;

    formatToggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFormat = btn.dataset.format;
    updateJsonDisplay();
});

// ── Actions ──
btnCopy.addEventListener('click', () => {
    const data = getFormattedJson();
    if (!data) return;
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        .then(() => showToast('Copied to clipboard'))
        .catch(() => showToast('Failed to copy'));
});

btnDownload.addEventListener('click', () => {
    const data = getFormattedJson();
    if (!data) return;

    const filename = currentFormat === 'app' ? 'pose.json' : 'pose_raw.json';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
});

// ── Retry ──
btnRetry.addEventListener('click', () => {
    // Reset state
    currentResult = null;
    fileInput.value = '';

    // Reset UI
    previewWrapper.style.display = 'none';
    uploadArea.style.display = '';
    btnCopy.disabled = true;
    btnDownload.disabled = true;
    btnRetry.style.display = 'none';
    jsonOutput.textContent = 'Upload an image to extract pose landmarks…';
    jsonOutput.classList.remove('has-data');

    // Clear canvas
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    setStatus('Ready — upload an image', false);
});

// ── Helpers ──
function setStatus(msg, loading) {
    statusText.textContent = msg;
    spinner.style.display = loading ? 'block' : 'none';
}

function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Start ──
initMediaPipe();
