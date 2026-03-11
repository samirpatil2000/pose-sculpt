import React, { useState, useRef } from 'react';
import { usePoseExtractor } from '../hooks/usePoseExtractor';
import Toast from '../components/Toast';

export default function PoseExtractor() {
    const [fileState, setFileState] = useState({ stage: 'upload', previewUrl: null });
    const [currentResult, setCurrentResult] = useState(null);
    const [currentFormat, setCurrentFormat] = useState('app');
    
    const imgRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const toastRef = useRef(null);

    const { isReady, isLoading, statusText, setStatusText, setIsLoading, detectPose, getFormattedJson } = usePoseExtractor();

    const handleFile = (file) => {
        if (!file.type.startsWith('image/')) {
            toastRef.current?.show('Please upload an image file');
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
            // Wait loop logic can be minimal here as the hook ensures isReady
        }
        
        if (imgRef.current && canvasRef.current) {
            canvasRef.current.width = imgRef.current.naturalWidth;
            canvasRef.current.height = imgRef.current.naturalHeight;
            const res = await detectPose(imgRef.current, canvasRef.current);
            if (res && res.result) {
                setCurrentResult(res.result);
            }
        }
    };

    const resetUI = () => {
        setFileState({ stage: 'upload', previewUrl: null });
        setCurrentResult(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        setStatusText('Ready — upload an image');
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

    // --- Inline Styles (Moved from extract.html) ---
    const styles = {
        main: { maxWidth: 1100, margin: '80px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 400px', gap: 24, paddingBottom: 40 },
        card: { background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)', display: 'flex', flexDirection: 'column' },
        cardTitle: { fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 },
        uploadArea: { border: '2px dashed var(--dashed-border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.3s ease', background: 'var(--subtle-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
        previewWrapper: { position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', margin: '0 auto' },
        previewImg: { width: '100%', display: 'block' },
        canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' },
        statusBar: { marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'var(--subtle-bg)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' },
        jsonOutput: { flex: 1, background: 'var(--subtle-bg)', border: '1px solid var(--subtle-border)', borderRadius: 14, padding: 16, fontFamily: '"SF Mono", "Fira Code", Menlo, monospace', fontSize: 12, color: 'var(--muted)', whiteSpace: 'pre-wrap', overflowY: 'auto', margin: 0, transition: 'color 0.3s ease', maxHeight: '500px' },
        formatToggle: { display: 'flex', background: 'var(--subtle-bg)', borderRadius: 10, padding: 3, marginBottom: 12 },
        toggleBtn: (active) => ({ flex: 1, background: active ? 'var(--btn-bg)' : 'none', border: 'none', padding: '8px 12px', fontSize: 12, fontWeight: 500, color: active ? 'var(--text-color)' : 'var(--muted)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.25s ease', boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none' }),
        jsonActions: { display: 'flex', gap: 8, marginBottom: 12 }
    };

    return (
        <>
            <main style={styles.main}>
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Input Image</h2>
                    
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        accept="image/*" 
                        style={{ display: 'none' }}
                        onChange={(e) => { if (e.target.files.length) handleFile(e.target.files[0]); }}
                    />

                    {fileState.stage === 'upload' ? (
                        <div 
                            style={styles.uploadArea} 
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, color: 'var(--accent-color)', opacity: 0.8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-color)' }}>Drop an image here or <strong>browse</strong></p>
                        </div>
                    ) : (
                        <div style={styles.previewWrapper}>
                            <img ref={imgRef} src={fileState.previewUrl} style={styles.previewImg} onLoad={onImageLoad} alt="Preview" />
                            <canvas ref={canvasRef} style={styles.canvas} />
                        </div>
                    )}

                    <div style={styles.statusBar}>
                        {isLoading && <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
                        <span>{statusText}</span>
                        {fileState.stage === 'preview' && (
                            <button className="btn" onClick={resetUI} style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                Try Another
                            </button>
                        )}
                    </div>
                </div>

                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Pose Output</h2>
                    <div style={styles.formatToggle}>
                        <button style={styles.toggleBtn(currentFormat === 'app')} onClick={() => setCurrentFormat('app')}>App Format (18 joints)</button>
                        <button style={styles.toggleBtn(currentFormat === 'raw')} onClick={() => setCurrentFormat('raw')}>Raw MediaPipe (33)</button>
                    </div>
                    <div style={styles.jsonActions}>
                        <button className="btn" disabled={!hasData} onClick={copyToClipboard} style={{ flex: 1 }}>
                            Copy JSON
                        </button>
                        <button className="btn" disabled={!hasData} onClick={downloadJson} style={{ flex: 1 }}>
                            Download
                        </button>
                    </div>
                    <pre style={{ ...styles.jsonOutput, color: hasData ? 'var(--text-color)' : 'var(--muted)' }}>
                        {hasData ? JSON.stringify(displayJson, null, 2) : 'Upload an image to extract pose landmarks…'}
                    </pre>
                </div>
            </main>
            <Toast ref={toastRef} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
