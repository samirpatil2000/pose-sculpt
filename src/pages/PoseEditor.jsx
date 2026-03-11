import React, { useRef, useState } from 'react';
import { usePoseEditor } from '../hooks/usePoseEditor';
import { useModelPreview } from '../hooks/useModelPreview';
import { JOINT_NAMES } from '../utils/poseConfig';

export default function PoseEditor() {
    const containerRef = useRef(null);
    const fileInputRef = useRef(null);
    const modelContainerRef = useRef(null);
    const [showModal, setShowModal] = useState(false);

    const { loadPose, exportPNG, exportJSON, importJSON, getJointData } = usePoseEditor(containerRef);
    const { applyPose, zoomIn, zoomOut } = useModelPreview(modelContainerRef);

    const handlePoseSelect = (e) => {
        const val = e.target.value;
        if (val) loadPose(val);
    };

    const handleFileChange = (e) => {
        if (e.target.files.length > 0) {
            importJSON(e.target.files[0]);
            e.target.value = '';
        }
    };

    const handleView3D = () => {
        setShowModal(true);
        // Get current joint positions and apply to 3D model after modal opens
        const poseData = getJointData();
        if (poseData) {
            setTimeout(() => applyPose(poseData), 400);
        }
    };

    const modalStyles = {
        overlay: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.25s ease' },
        content: { position: 'relative', width: '90vw', maxWidth: 900, height: '75vh', background: '#111114', borderRadius: 20, border: '1px solid var(--glass-border)', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' },
        header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(to bottom, rgba(17,17,20,0.95), transparent)' },
        title: { fontSize: 14, fontWeight: 600, color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: 8 },
        controls: { display: 'flex', gap: 6 },
        zoomBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', fontSize: 16, fontWeight: 600, transition: 'all 0.2s ease' },
        closeBtn: { background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-color)', fontSize: 18, transition: 'all 0.2s ease' },
        modelContainer: { width: '100%', height: '100%' },
    };

    return (
        <>
            <div id="canvas-container" ref={containerRef} style={{ width: '100vw', height: '100vh', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>
            
            <div className="ui-panel" style={{
                position: 'absolute', top: 60, right: 24, zIndex: 10,
                background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)', borderRadius: 20,
                padding: 20, boxShadow: '0 8px 32px rgba(0, 0, 0, 0.05)',
                display: 'flex', flexDirection: 'column', gap: 12, minWidth: 160
            }}>
                <h1 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-color)' }}>Pose Editor</h1>
                
                <p style={{ fontSize: 12, fontWeight: 600, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 0' }}>Select Pose</p>
                
                <select 
                    style={{
                        appearance: 'none', background: 'var(--btn-bg)', border: '1px solid var(--btn-border)',
                        borderRadius: 12, padding: '10px 36px 10px 14px', fontSize: 13, fontWeight: 500,
                        color: 'var(--text-color)', cursor: 'pointer', outline: 'none', width: '100%',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23f0f0f2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center'
                    }}
                    onChange={handlePoseSelect}
                    defaultValue="sample"
                >
                    <option value="sample" style={{ background: '#2c2c30', color: 'var(--text-color)' }}>Standing</option>
                    <option value="t-pose" style={{ background: '#2c2c30', color: 'var(--text-color)' }}>T-Pose</option>
                    <option value="action-hero" style={{ background: '#2c2c30', color: 'var(--text-color)' }}>Action Hero</option>
                    <option value="sitting" style={{ background: '#2c2c30', color: 'var(--text-color)' }}>Sitting</option>
                    <option value="walking" style={{ background: '#2c2c30', color: 'var(--text-color)' }}>Walking</option>
                </select>
                
                <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }}></div>
                
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".json,application/json" 
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
                
                <button className="btn" onClick={() => fileInputRef.current?.click()}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Import JSON
                </button>
                
                <button className="btn" onClick={exportPNG}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    Export PNG
                </button>
                
                <button className="btn" onClick={exportJSON}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Export JSON
                </button>

                <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }}></div>

                <button 
                    className="btn" 
                    onClick={handleView3D}
                    style={{ background: 'linear-gradient(135deg, #4da3ff 0%, #6c63ff 100%)', border: 'none', color: '#fff' }}
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    View 3D Preview
                </button>
            </div>

            {/* 3D Model Modal */}
            {showModal && (
                <div style={modalStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div style={modalStyles.content}>
                        <div style={modalStyles.header}>
                            <span style={modalStyles.title}>
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                3D Pose Preview
                            </span>
                            <div style={modalStyles.controls}>
                                <button style={modalStyles.zoomBtn} onClick={zoomIn} title="Zoom In">+</button>
                                <button style={modalStyles.zoomBtn} onClick={zoomOut} title="Zoom Out">−</button>
                                <button style={modalStyles.closeBtn} onClick={() => setShowModal(false)} title="Close">✕</button>
                            </div>
                        </div>
                        <div ref={modelContainerRef} style={modalStyles.modelContainer} />
                    </div>
                </div>
            )}

            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </>
    );
}
