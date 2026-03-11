import { useState, useRef, useEffect } from 'react';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { toAppFormat, toRawFormat } from '../utils/poseConfig';

export function usePoseExtractor() {
    const [poseLandmarker, setPoseLandmarker] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [statusText, setStatusText] = useState('Loading MediaPipe model…');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const initMediaPipe = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                );
                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
                        delegate: 'GPU'
                    },
                    runningMode: 'IMAGE',
                    numPoses: 1
                });
                if (isMounted) {
                    setPoseLandmarker(landmarker);
                    setIsReady(true);
                    setStatusText('Ready — upload an image');
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('MediaPipe init error:', err);
                if (isMounted) {
                    setStatusText('Failed to load model. Check console.');
                    setIsLoading(false);
                }
            }
        };
        initMediaPipe();
        return () => { isMounted = false; };
    }, []);

    const detectPose = async (imgElement, canvasElement) => {
        if (!poseLandmarker) return null;
        
        setIsLoading(true);
        setStatusText('Detecting pose…');

        try {
            const result = poseLandmarker.detect(imgElement);
            
            if (!result.landmarks || result.landmarks.length === 0) {
                setStatusText('No pose detected — try another image');
                setIsLoading(false);
                return { result: null, formattedData: null };
            }

            // Draw Landmarks
            const ctx = canvasElement.getContext('2d');
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
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

            setStatusText(`Detected ${result.landmarks.length} pose(s) — ${result.landmarks[0].length} landmarks`);
            setIsLoading(false);
            return { result };
        } catch (err) {
            console.error('Detection error:', err);
            setStatusText('Detection failed. Check console.');
            setIsLoading(false);
            return { result: null, error: err };
        }
    };

    const getFormattedJson = (result, format) => {
        if (!result || !result.landmarks || result.landmarks.length === 0) return null;
        if (format === 'app') {
            return toAppFormat(result.landmarks[0], result.worldLandmarks?.[0]);
        } else {
            return toRawFormat(result.landmarks, result.worldLandmarks);
        }
    };

    return { isReady, isLoading, statusText, setStatusText, setIsLoading, detectPose, getFormattedJson };
}
