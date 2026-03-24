import React, { useState, useRef, useEffect } from 'react';
import { usePoseExtractor } from '../hooks/usePoseExtractor';
import { useModelPreview } from '../hooks/useModelPreview';
import Toast from '../components/Toast';

export default function PoseExtractor() {
    const [inputMode, setInputMode] = useState('image'); // 'image' | 'webcam' | 'video'
    const [fileState, setFileState] = useState({ stage: 'upload', previewUrl: null });
    const [currentResult, setCurrentResult] = useState(null);
    const [currentFormat, setCurrentFormat] = useState('app');
    const [showModal, setShowModal] = useState(false);
    
    const imgRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const videoFileInputRef = useRef(null);
    const toastRef = useRef(null);
    const modelContainerRef = useRef(null);
    const latestResultRef = useRef(null);

    const { 
        isReady, isLoading, statusText, setStatusText, setIsLoading, 
        modelType, setModelType,
        detectPose, startProcessing, stopProcessing, getFormattedJson 
    } = usePoseExtractor();
    
    const { applyPose, zoomIn, zoomOut } = useModelPreview(modelContainerRef);

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        stopProcessing();
    };

    useEffect(() => {
        if (inputMode === 'webcam') {
            resetUI();
            startCamera();
        } else {
            stopCamera();
            resetUI();
        }
        return () => stopCamera();
    }, [inputMode]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            toastRef.current?.show('Camera access denied');
            setStatusText('Camera access denied');
        }
    };

    const handleFile = (file, type) => {
        if (!file.type.startsWith(`${type}/`)) {
            toastRef.current?.show(`Please upload a ${type} file`);
            return;
        }
        const url = URL.createObjectURL(file);
        setFileState({ stage: 'preview', previewUrl: url });
        setCurrentResult(null);
    };

    const onImageLoad = async () => {
        if (!isReady) {
            setStatusText('Model still loading…');
            setIsLoading(true);
        }
        if (imgRef.current && canvasRef.current) {
            canvasRef.current.width = imgRef.current.naturalWidth;
            canvasRef.current.height = imgRef.current.naturalHeight;
            const res = await detectPose(imgRef.current, canvasRef.current);
            if (res && res.result) setCurrentResult(res.result);
        }
    };

    const onVideoLoadedMetadata = () => {
        if (videoRef.current && canvasRef.current) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
        }
    };

    const onVideoPlay = () => {
        setCurrentResult(null); // Clear previous capture
        if (videoRef.current && canvasRef.current) {
            startProcessing(videoRef.current, canvasRef.current, (res) => {
                latestResultRef.current = res;
            });
        }
    };

    const onVideoPause = () => {
        stopProcessing();
    };

    const capturePose = () => {
        if (latestResultRef.current) {
            if (videoRef.current) {
                videoRef.current.pause(); // Pauses video or webcam display
            }
            setCurrentResult(latestResultRef.current);
            toastRef.current?.show('Pose captured!');
            stopProcessing();
            setStatusText('Pose captured!');
        } else {
            toastRef.current?.show('No pose detected yet');
        }
    };

    const resumeVideo = () => {
        if (videoRef.current) {
            videoRef.current.play();
        }
    };

    useEffect(() => {
        if (!showModal || !currentResult) return;
        const appData = getFormattedJson(currentResult, 'app');
        if (appData) {
            const timer = setTimeout(() => applyPose(appData), 300);
            return () => clearTimeout(timer);
        }
    }, [showModal, currentResult]);

    const resetUI = () => {
        setFileState({ stage: 'upload', previewUrl: null });
        setCurrentResult(null);
        latestResultRef.current = null;
        setShowModal(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (videoFileInputRef.current) videoFileInputRef.current.value = '';
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        if (inputMode === 'webcam' && isReady) {
            setStatusText('Starting camera...');
            resumeVideo();
        } else {
            setStatusText(isReady ? 'Ready — select input' : 'Loading model…');
        }
    };

    const displayJson = getFormattedJson(currentResult, currentFormat);
    const hasData = !!displayJson;

    const copyToClipboard = () => {
        if (!hasData) return;
        navigator.clipboard.writeText(JSON.stringify(displayJson, null, 2))
            .then(() => toastRef.current?.show('Copied to clipboard'))
            .catch(() => toastRef.current?.show('Failed to copy'));
    };

    const downloadJson = () => {
        if (!hasData) return;
        const filename = currentFormat === 'app' ? 'pose.json' : 'pose_raw.json';
        const blob = new Blob([JSON.stringify(displayJson, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    };

    const styles = {
        main: { maxWidth: 1100, margin: '80px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 400px', gap: 24, paddingBottom: 40 },
        card: { background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column' },
        cardTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
        uploadArea: { border: '2px dashed var(--dashed-border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', background: 'var(--subtle-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
        previewWrapper: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', margin: '0 auto', maxHeight: 450, width: '100%', display: 'flex', justifyContent: 'center' },
        previewMedia: { width: '100%', maxHeight: 450, objectFit: 'contain', display: 'block' },
        canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', objectFit: 'contain' },
        statusBar: { marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--subtle-bg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' },
        jsonOutput: { flex: 1, background: 'var(--subtle-bg)', border: '1px solid var(--subtle-border)', borderRadius: 14, padding: 16, fontFamily: '"SF Mono", "Fira Code", Menlo, monospace', fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', overflowY: 'auto', margin: 0, transition: 'color 0.3s ease', maxHeight: '500px' },
        formatToggle: { display: 'flex', background: 'var(--subtle-bg)', borderRadius: 10, padding: 3, marginBottom: 12 },
        toggleBtn: (active) => ({ flex: 1, background: active ? 'var(--btn-bg)' : 'none', border: 'none', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: active ? 'var(--text-color)' : 'var(--muted)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.25s ease', boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none' }),
        jsonActions: { display: 'flex', gap: 8, marginBottom: 12 },
        actionBtn: { background: 'linear-gradient(135deg, #4da3ff 0%, #6c63ff 100%)', border: 'none', borderRadius: 12, padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.3s ease', marginTop: 12, boxShadow: '0 4px 15px rgba(77, 163, 255, 0.3)' },
        modalOverlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.25s ease' },
        modalContent: { position: 'relative', width: '90vw', maxWidth: 900, height: '75vh', background: '#111114', borderRadius: 20, border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' },
        modalHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(17,17,20,0.95), transparent)' },
        modalTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 },
        closeBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', fontSize: 18, transition: 'all 0.2s ease' },
        zoomControls: { display: 'flex', gap: 6 },
        zoomBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', fontSize: 16, fontWeight: 600, transition: 'all 0.2s ease' },
        modelContainer: { width: '100%', height: '100%' },
        tabBar: { display: 'flex', gap: 8, marginBottom: 16, background: 'var(--subtle-bg)', padding: 4, borderRadius: 12 },
        tabBtn: (active) => ({ flex: 1, padding: '8px', background: active ? 'var(--btn-bg)' : 'transparent', border: '1px solid', borderColor: active ? 'var(--btn-border)' : 'transparent', borderRadius: 8, color: active ? 'var(--text-color)' : 'var(--muted)', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s ease' }),
        modelSelect: { background: 'var(--subtle-bg)', border: '1px solid var(--subtle-border)', color: 'var(--text-color)', padding: '6px 12px', borderRadius: 8, fontSize: 12, outline: 'none', cursor: 'pointer' }
    };

    return (
        <>
            <main style={styles.main}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>
                        Input Source
                        <select value={modelType} onChange={e => setModelType(e.target.value)} style={styles.modelSelect}>
                            <option value="lite">Lite Model (Fast)</option>
                            <option value="full">Full Model (Balanced)</option>
                            <option value="heavy">Heavy Model (Accurate)</option>
                        </select>
                    </div>
                    
                    <div style={styles.tabBar}>
                        {['image', 'webcam', 'video'].map(mode => (
                            <button key={mode} style={styles.tabBtn(inputMode === mode)} onClick={() => setInputMode(mode)}>
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                    </div>

                    <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files.length) handleFile(e.target.files[0], 'image'); }} />
                    <input type="file" ref={videoFileInputRef} accept="video/*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files.length) handleFile(e.target.files[0], 'video'); }} />

                    {inputMode === 'image' && (
                        fileState.stage === 'upload' ? (
                            <div style={styles.uploadArea} onClick={() => fileInputRef.current?.click()}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, color: 'var(--accent-color)', opacity: 0.8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-color)' }}>Drop an image here or <strong>browse</strong></p>
                            </div>
                        ) : (
                            <div style={styles.previewWrapper}>
                                <img ref={imgRef} src={fileState.previewUrl} style={styles.previewMedia} onLoad={onImageLoad} alt="Preview" />
                                <canvas ref={canvasRef} style={styles.canvas} />
                            </div>
                        )
                    )}

                    {inputMode === 'video' && (
                        fileState.stage === 'upload' ? (
                            <div style={styles.uploadArea} onClick={() => videoFileInputRef.current?.click()}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, color: 'var(--accent-color)', opacity: 0.8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-color)' }}>Drop a video here or <strong>browse</strong></p>
                            </div>
                        ) : (
                            <div style={styles.previewWrapper}>
                                <video ref={videoRef} src={fileState.previewUrl} style={styles.previewMedia} onLoadedMetadata={onVideoLoadedMetadata} onPlay={onVideoPlay} onPause={onVideoPause} controls loop muted playsInline />
                                <canvas ref={canvasRef} style={styles.canvas} />
                            </div>
                        )
                    )}

                    {inputMode === 'webcam' && (
                        <div style={styles.previewWrapper}>
                            <video ref={videoRef} style={styles.previewMedia} onLoadedMetadata={onVideoLoadedMetadata} onPlay={onVideoPlay} onPause={onVideoPause} autoPlay playsInline muted />
                            <canvas ref={canvasRef} style={styles.canvas} />
                        </div>
                    )}

                    <div style={styles.statusBar}>
                        {isLoading && <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
                        <span>{statusText}</span>
                        {(fileState.stage === 'preview' || inputMode === 'webcam') && (
                            <button className="btn" onClick={resetUI} style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Reset
                            </button>
                        )}
                    </div>

                    {(inputMode === 'webcam' || inputMode === 'video') && fileState.stage !== 'upload' && !hasData && (
                         <button style={styles.actionBtn} onClick={capturePose}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                            Capture Pose
                        </button>
                    )}

                    {hasData && (
                        <button 
                            style={styles.actionBtn} 
                            onClick={() => setShowModal(true)}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                            View in 3D Model
                        </button>
                    )}
                </div>

                <div style={styles.card}>
                    <h2 style={{...styles.cardTitle, justifyContent: 'flex-start'}}>Pose Output JSON</h2>
                    <div style={styles.formatToggle}>
                        <button style={styles.toggleBtn(currentFormat === 'app')} onClick={() => setCurrentFormat('app')}>App Format (18 joints)</button>
                        <button style={styles.toggleBtn(currentFormat === 'raw')} onClick={() => setCurrentFormat('raw')}>Raw MediaPipe (33)</button>
                    </div>
                    <div style={styles.jsonActions}>
                        <button className="btn" disabled={!hasData} onClick={copyToClipboard} style={{ flex: 1 }}>Copy</button>
                        <button className="btn" disabled={!hasData} onClick={downloadJson} style={{ flex: 1 }}>Download</button>
                    </div>
                    <pre style={{ ...styles.jsonOutput, color: hasData ? 'var(--text-color)' : 'var(--muted)' }}>
                        {hasData ? JSON.stringify(displayJson, null, 2) : 'Pose data will appear here once captured...'}
                    </pre>
                </div>
            </main>

            {/* 3D Model Modal */}
            {showModal && (
                <div style={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div style={styles.modalContent}>
                        <div style={styles.modalHeader}>
                            <span style={styles.modalTitle}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                3D Pose Preview
                            </span>
                            <div style={styles.zoomControls}>
                                <button style={styles.zoomBtn} onClick={zoomIn} title="Zoom In">+</button>
                                <button style={styles.zoomBtn} onClick={zoomOut} title="Zoom Out">−</button>
                                <button style={styles.closeBtn} onClick={() => setShowModal(false)} title="Close">✕</button>
                            </div>
                        </div>
                        <div ref={modelContainerRef} style={styles.modelContainer} />
                    </div>
                </div>
            )}

            <Toast ref={toastRef} />
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </>
    );
}
