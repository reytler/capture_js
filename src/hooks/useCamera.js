import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraService } from '../services/CameraService';
import {
  debugError,
  debugLog,
  debugTime,
  debugTimeEnd,
  getDebugSessionId,
  nextDebugId,
  summarizeError,
  summarizeStream,
  summarizeVideo
} from '../utils/debug';

export function useCamera(config) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const videoRef = useRef(null);
  const cameraService = useRef(new CameraService());

  debugLog('camera', 'useCamera render', {
    sessionId: getDebugSessionId(),
    hasStream: !!stream,
    facingMode,
    isLoading,
    hasVideoRef: !!videoRef.current
  });

  const startCamera = useCallback(async () => {
    const actionId = nextDebugId('camera-start');
    const timerLabel = `camera-start:${actionId}`;
    debugTime(timerLabel);
    debugLog('camera', 'startCamera called', {
      sessionId: getDebugSessionId(),
      actionId,
      constraints: config?.camera || {},
      video: summarizeVideo(videoRef.current)
    });
    setIsLoading(true);
    setError(null);
    try {
      const constraints = config?.camera || {};
      const newStream = await cameraService.current.startCamera(constraints);
      setStream(newStream);
      setFacingMode(cameraService.current.getFacingMode());
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      debugLog('camera', 'startCamera resolved', {
        sessionId: getDebugSessionId(),
        actionId,
        stream: summarizeStream(newStream),
        facingMode: cameraService.current.getFacingMode(),
        videoAttached: !!videoRef.current
      });
    } catch (err) {
      debugError('camera', 'startCamera failed', {
        sessionId: getDebugSessionId(),
        actionId,
        error: summarizeError(err)
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
      debugTimeEnd(timerLabel);
    }
  }, [config]);

  const stopCamera = useCallback(() => {
    debugLog('camera', 'stopCamera called', {
      sessionId: getDebugSessionId(),
      hasStream: !!cameraService.current.stream,
      videoAttached: !!videoRef.current
    });
    cameraService.current.stopCamera();
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const actionId = nextDebugId('camera-switch');
    const timerLabel = `camera-switch:${actionId}`;
    debugTime(timerLabel);
    debugLog('camera', 'switchCamera called', {
      sessionId: getDebugSessionId(),
      actionId,
      currentFacingMode: facingMode,
      video: summarizeVideo(videoRef.current)
    });
    setIsLoading(true);
    try {
      const newFacingMode = await cameraService.current.switchCamera();
      setFacingMode(newFacingMode);
      if (videoRef.current && cameraService.current.stream) {
        videoRef.current.srcObject = cameraService.current.stream;
      }
      debugLog('camera', 'switchCamera resolved', {
        sessionId: getDebugSessionId(),
        actionId,
        newFacingMode,
        stream: summarizeStream(cameraService.current.stream)
      });
    } catch (err) {
      debugError('camera', 'switchCamera failed', {
        sessionId: getDebugSessionId(),
        actionId,
        error: summarizeError(err)
      });
      setError(err.message);
    } finally {
      setIsLoading(false);
      debugTimeEnd(timerLabel);
    }
  }, [facingMode]);

  const captureFrame = useCallback(() => {
    debugLog('camera', 'captureFrame called', {
      sessionId: getDebugSessionId(),
      video: summarizeVideo(videoRef.current)
    });
    const canvas = cameraService.current.captureFrame(videoRef.current);
    debugLog('camera', 'captureFrame resolved', {
      sessionId: getDebugSessionId(),
      canvas: { width: canvas.width, height: canvas.height }
    });
    return canvas;
  }, []);

  useEffect(() => {
    debugLog('camera', 'useCamera mounted', {
      sessionId: getDebugSessionId()
    });
    return () => {
      debugLog('camera', 'useCamera cleanup', {
        sessionId: getDebugSessionId()
      });
      cameraService.current.stopCamera();
    };
  }, []);

  return {
    videoRef,
    stream,
    facingMode,
    error,
    isLoading,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
    isActive: !!stream
  };
}
