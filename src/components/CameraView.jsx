import React from 'react';

export function CameraView({ videoRef, isActive, facingMode, onSwitchCamera, onCapture, isLoading, children }) {
  return (
    <div className="camera-view">
      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
          style={{ display: isActive ? 'block' : 'none' }}
        />
        {!isActive && (
          <div className="camera-placeholder">
            <p>Camera not active</p>
          </div>
        )}
        {children}
      </div>
      <div className="camera-controls">
        <button onClick={onCapture} disabled={!isActive || isLoading} className="capture-btn">
          Capture
        </button>
        <button onClick={onSwitchCamera} disabled={isLoading} className="switch-camera-btn">
          Switch to {facingMode === 'environment' ? 'Front' : 'Rear'}
        </button>
      </div>
    </div>
  );
}
