import { useState, useRef, useEffect } from 'react';
import { FilesetResolver, PoseLandmarker, DrawingUtils } from '@mediapipe/tasks-vision';
import { toAppFormat, toRawFormat } from '../utils/poseConfig';

export function usePoseExtractor() {
    const [poseLandmarker, setPoseLandmarker] = useState(null);
    const [isReady, setIsReady] = useState(false);
    const [statusText, setStatusText] = useState('Loading MediaPipe model…');
    const [isLoading, setIsLoading] = useState(true);
    const [modelType, setModelType] = useState('full'); // lite, full, heavy
    
    const visionRef = useRef(null);
    const runningModeRef = useRef('IMAGE');
    const animationFrameRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const initMediaPipe = async () => {
            setIsLoading(true);
            setStatusText(`Loading ${modelType} model…`);
            try {
                if (!visionRef.current) {
                    visionRef.current = await FilesetResolver.forVisionTasks(
                        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
                    );
                }
                const vision = visionRef.current;
                
                if (poseLandmarker) {
                    try { poseLandmarker.close(); } catch (e) {}
                }

                const landmarker = await PoseLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${modelType}/float16/1/pose_landmarker_${modelType}.task`,
                        delegate: 'GPU'
                    },
                    runningMode: runningModeRef.current,
                    numPoses: 1
                });
                
                if (isMounted) {
                    setPoseLandmarker(landmarker);
                    setIsReady(true);
                    setStatusText('Ready — select input');
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
        
        return () => { 
            isMounted = false; 
            stopProcessing();
        };
    }, [modelType]);

    const enableMode = async (mode) => {
        if (!poseLandmarker) return false;
        if (runningModeRef.current !== mode) {
            await poseLandmarker.setOptions({ runningMode: mode });
            runningModeRef.current = mode;
        }
        return true;
    };

    const detectPose = async (imgElement, canvasElement) => {
        if (!poseLandmarker) return { result: null, error: 'Not ready' };
        
        setIsLoading(true);
        setStatusText('Detecting pose…');
        await enableMode('IMAGE');

        try {
            const result = poseLandmarker.detect(imgElement);
            
            if (!result.landmarks || result.landmarks.length === 0) {
                setStatusText('No pose detected — try another image');
                setIsLoading(false);
                return { result: null, formattedData: null };
            }

            const ctx = canvasElement.getContext('2d');
            ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            const drawingUtils = new DrawingUtils(ctx);
            
            for (const landmarks of result.landmarks) {
                drawingUtils.drawLandmarks(landmarks, {
                    radius: (data) => DrawingUtils.lerp(data.from?.z || 0, -0.15, 0.1, 5, 1),
                    color: '#FF0071',
                    fillColor: '#FF007188'
                });
                drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
                    color: '#00E1FF',
                    lineWidth: 3
                });
            }

            setStatusText(`Detected pose — ${result.landmarks[0].length} landmarks`);
            setIsLoading(false);
            return { result };
        } catch (err) {
            console.error('Detection error:', err);
            setStatusText('Detection failed. Check console.');
            setIsLoading(false);
            return { result: null, error: err };
        }
    };

    const startProcessing = async (videoElement, canvasElement, onFrame) => {
        if (!poseLandmarker) return false;
        await enableMode('VIDEO');
        
        const ctx = canvasElement.getContext('2d');
        let lastVideoTime = -1;
        
        const renderLoop = () => {
            if (videoElement.currentTime !== lastVideoTime && videoElement.readyState >= 2) {
                lastVideoTime = videoElement.currentTime;
                let startTimeMs = performance.now();
                const result = poseLandmarker.detectForVideo(videoElement, startTimeMs);
                
                ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                if (result.landmarks && result.landmarks.length > 0) {
                    const drawingUtils = new DrawingUtils(ctx);
                    for (const landmarks of result.landmarks) {
                        drawingUtils.drawLandmarks(landmarks, {
                            radius: (data) => DrawingUtils.lerp(data.from?.z || 0, -0.15, 0.1, 5, 1),
                            color: '#FF0071',
                            fillColor: '#FF007188'
                        });
                        drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
                            color: '#00E1FF',
                            lineWidth: 3
                        });
                    }
                    if (onFrame) onFrame(result);
                    setStatusText(`Tracking pose — ${result.landmarks[0].length} landmarks`);
                } else {
                    setStatusText('No pose detected');
                }
            }
            animationFrameRef.current = requestAnimationFrame(renderLoop);
        };
        
        animationFrameRef.current = requestAnimationFrame(renderLoop);
        return true;
    };

    const stopProcessing = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setStatusText('Ready — select input');
    };

    const getFormattedJson = (result, format) => {
        if (!result || !result.landmarks || result.landmarks.length === 0) return null;
        if (format === 'app') {
            return toAppFormat(result.landmarks[0], result.worldLandmarks?.[0]);
        } else {
            return toRawFormat(result.landmarks, result.worldLandmarks);
        }
    };

    return { 
        isReady, isLoading, statusText, setStatusText, setIsLoading, 
        modelType, setModelType,
        detectPose, startProcessing, stopProcessing, getFormattedJson 
    };
}
