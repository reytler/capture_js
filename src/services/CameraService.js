import { debugError, debugLog, debugWarn, getDebugSessionId, summarizeError } from '../utils/debug';

export class CameraService {
  constructor() {
    this.stream = null;
    this.facingMode = 'environment';
  }

  async requestPermission() {
    debugLog('camera-service', 'requestPermission start', {
      sessionId: getDebugSessionId()
    });
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      debugLog('camera-service', 'requestPermission granted', {
        sessionId: getDebugSessionId(),
        trackCount: tempStream.getTracks().length
      });
      tempStream.getTracks().forEach(track => track.stop());
      return true;
    } catch (err) {
      debugError('camera-service', 'requestPermission failed', {
        sessionId: getDebugSessionId(),
        error: summarizeError(err)
      });
      throw new Error('Camera permission denied');
    }
  }

  async startCamera(constraints = {}) {
    debugLog('camera-service', 'startCamera entry', {
      sessionId: getDebugSessionId(),
      hadExistingStream: !!this.stream,
      requestedConstraints: constraints,
      currentFacingMode: this.facingMode
    });
    if (this.stream) {
      this.stopCamera();
    }

    const videoConstraints = {
      width: constraints.width || { ideal: 1920 },
      height: constraints.height || { ideal: 1080 },
      facingMode: constraints.facingMode || this.facingMode
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: false
    });

    this.stream = stream;
    debugLog('camera-service', 'startCamera resolved', {
      sessionId: getDebugSessionId(),
      trackCount: stream.getTracks().length,
      trackSettings: stream.getVideoTracks()[0]?.getSettings?.(),
      trackLabel: stream.getVideoTracks()[0]?.label,
      facingMode: this.facingMode
    });
    return stream;
  }

  stopCamera() {
    if (this.stream) {
      debugLog('camera-service', 'stopCamera stopping tracks', {
        sessionId: getDebugSessionId(),
        trackCount: this.stream.getTracks().length
      });
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      debugLog('camera-service', 'stopCamera completed', {
        sessionId: getDebugSessionId()
      });
    }
  }

  async switchCamera() {
    const previousFacingMode = this.facingMode;
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    debugLog('camera-service', 'switchCamera toggled facing mode', {
      sessionId: getDebugSessionId(),
      previousFacingMode,
      nextFacingMode: this.facingMode,
      hadActiveStream: !!this.stream
    });
    if (this.stream) {
      await this.startCamera({ facingMode: this.facingMode });
    }
    return this.facingMode;
  }

  captureFrame(videoElement) {
    if (!videoElement || !videoElement.videoWidth) {
      debugWarn('camera-service', 'captureFrame received invalid video element', {
        sessionId: getDebugSessionId(),
        hasVideoElement: !!videoElement,
        videoWidth: videoElement?.videoWidth,
        videoHeight: videoElement?.videoHeight,
        readyState: videoElement?.readyState
      });
      throw new Error('Invalid video element');
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    debugLog('camera-service', 'captureFrame created canvas', {
      sessionId: getDebugSessionId(),
      width: canvas.width,
      height: canvas.height
    });
    return canvas;
  }

  getFacingMode() {
    return this.facingMode;
  }

  isActive() {
    return !!this.stream;
  }
}
