import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useImageQueue } from '../hooks/useImageQueue';
import { useBlurDetector } from '../hooks/useBlurDetector';
import { CameraView } from './CameraView';
import { FramingOverlay } from './FramingOverlay';
import { ProcessingQueue } from './ProcessingQueue';
import { ResultPreview } from './ResultPreview';
import { FramingService } from '../services/FramingService';
import { loadOpenCV } from '../utils/opencvLoader';
import {
  debugError,
  debugGroup,
  debugGroupEnd,
  debugLog,
  debugTime,
  debugTimeEnd,
  debugWarn,
  getDebugSessionId,
  nextDebugId,
  summarizeCanvas,
  summarizeError,
  summarizeVideo
} from '../utils/debug';

function summarizeCvModuleShape(cvModule) {
  return {
    type: typeof cvModule,
    isFunction: typeof cvModule === 'function',
    hasMat: !!cvModule?.Mat,
    hasThen: typeof cvModule?.then === 'function',
    constructorName: cvModule?.constructor?.name || null
  };
}

export function CaptureQuality({ config = {}, onImageAccepted, onImageRejected }) {
  const [cv, setCv] = useState(null);
  const [cvLoading, setCvLoading] = useState(true);
  const [cvError, setCvError] = useState(null);
  const [framingResult, setFramingResult] = useState(null);
  const [processedResult, setProcessedResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const canvasRef = useRef(null);

  const camera = useCamera(config);
  const queue = useImageQueue(config);
  const blurDetector = useBlurDetector(config);

  debugLog('capture-quality', 'render', {
    sessionId: getDebugSessionId(),
    cvLoading,
    hasCv: !!cv,
    cvError,
    cameraActive: camera.isActive,
    queueLength: queue.queue.length,
    processingCount: queue.queue.filter((item) => item.status === 'processing').length,
    showResult
  });

  const loadCvModule = useCallback(async () => {
    const cvLoadId = nextDebugId('cv-retry');
    debugGroup('loader-ui', `retry ${cvLoadId}`, {
      sessionId: getDebugSessionId()
    });
    setCv(null);
    setCvError(null);
    setCvLoading(true);

    try {
      debugLog('loader-ui', 'retry awaiting OpenCV handoff', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
      const cvModule = await loadOpenCV();
      debugLog('loader-ui', 'retry received OpenCV module', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        cvModule: summarizeCvModuleShape(cvModule)
      });
      debugLog('loader-ui', 'retry before setCv', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        cvModule: summarizeCvModuleShape(cvModule)
      });
      setCv(() => cvModule);
      debugLog('loader-ui', 'retry after setCv', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
      debugLog('loader-ui', 'retry resolved', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasMat: !!cvModule?.Mat
      });
    } catch (err) {
      debugError('loader-ui', 'retry failed', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        error: summarizeError(err)
      });
      setCvError(err?.message || 'Failed to load local OpenCV assets');
    } finally {
      debugLog('loader-ui', 'retry before setCvLoading false', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
      setCvLoading(false);
      debugLog('loader-ui', 'retry after setCvLoading false', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
      debugLog('loader-ui', 'retry finished', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        cvLoading: false
      });
      debugGroupEnd();
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const cvLoadId = nextDebugId('cv-mount');

    const load = async () => {
      debugGroup('loader-ui', `mount load ${cvLoadId}`, {
        sessionId: getDebugSessionId(),
        isMounted
      });
      setCv(null);
      setCvError(null);
      setCvLoading(true);
      debugLog('loader-ui', 'mount effect started load', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });

      try {
        debugLog('loader-ui', 'mount awaiting OpenCV handoff', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          isMounted
        });
        const cvModule = await loadOpenCV();
        debugLog('loader-ui', 'mount received OpenCV module', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          isMounted,
          cvModule: summarizeCvModuleShape(cvModule)
        });
        if (isMounted) {
          debugLog('loader-ui', 'mount before setCv', {
            sessionId: getDebugSessionId(),
            cvLoadId,
            isMounted,
            cvModule: summarizeCvModuleShape(cvModule)
          });
          setCv(() => cvModule);
          debugLog('loader-ui', 'mount after setCv', {
            sessionId: getDebugSessionId(),
            cvLoadId,
            isMounted
          });
        }
        debugLog('loader-ui', 'mount load resolved', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          isMounted,
          hasMat: !!cvModule?.Mat
        });
      } catch (err) {
        debugError('loader-ui', 'mount load failed', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          isMounted,
          error: summarizeError(err)
        });
        if (isMounted) {
          setCvError(err?.message || 'Failed to load local OpenCV assets');
        }
      } finally {
        if (isMounted) {
          debugLog('loader-ui', 'mount before setCvLoading false', {
            sessionId: getDebugSessionId(),
            cvLoadId,
            isMounted
          });
          setCvLoading(false);
          debugLog('loader-ui', 'mount after setCvLoading false', {
            sessionId: getDebugSessionId(),
            cvLoadId,
            isMounted
          });
        }
        debugLog('loader-ui', 'mount load finished', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          isMounted,
          cvLoading: false
        });
        debugGroupEnd();
      }
    };

    load();

    return () => {
      isMounted = false;
      debugWarn('loader-ui', 'mount load cleanup', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        isMounted
      });
    };
  }, []);

  const processImage = useCallback(async (imageData, onProgress) => {
    if (!cv) throw new Error('OpenCV not loaded');

    const processId = nextDebugId('process');
    const timerLabel = `process:${processId}`;

    debugGroup('process', `process image ${processId}`, {
      sessionId: getDebugSessionId(),
      image: summarizeCanvas(imageData),
      framingEnabled: config?.framing?.enabled !== false,
      blurEnabled: config?.blur?.enabled !== false
    });
    debugTime(timerLabel);

    const result = { framing: null, blur: null, finalStatus: 'REJECTED', rejectionReasons: [] };

    let currentImageData = imageData;
    let shouldCleanupCanvas = false;

    try {
      if (config?.framing?.enabled !== false) {
        debugLog('process', 'starting framing stage', {
          sessionId: getDebugSessionId(),
          processId,
          progress: 20,
          image: summarizeCanvas(currentImageData)
        });
        onProgress(20);
        const framingService = new FramingService(config?.framing || {});
        const framing = framingService.detectDocument(cv, currentImageData);

        let correctedImageDataUrl = null;
        if (framing.correctedImage) {
          const correctedCanvas = document.createElement('canvas');
          cv.imshow(correctedCanvas, framing.correctedImage);
          currentImageData = correctedCanvas;
          shouldCleanupCanvas = true;
          correctedImageDataUrl = correctedCanvas.toDataURL('image/jpeg');
          framing.correctedImage.delete();
        }

        result.framing = {
          status: framing.status,
          corners: framing.corners,
          validation: framing.validation,
          correctedImage: correctedImageDataUrl
        };

        setFramingResult({
          status: framing.status,
          corners: framing.corners,
          validation: framing.validation,
          correctedImage: null
        });

        if (framing.status === 'NO_DOCUMENT') {
          result.rejectionReasons.push('No document detected');
        } else if (framing.status === 'INVALID') {
          result.rejectionReasons.push('Invalid framing');
          if (framing.validation?.details) {
            result.rejectionReasons.push(...framing.validation.details);
          }
        }

        debugLog('process', 'framing stage finished', {
          sessionId: getDebugSessionId(),
          processId,
          framingStatus: framing.status,
          hasCorners: !!framing.corners,
          validation: framing.validation,
          correctedImageGenerated: !!correctedImageDataUrl
        });

        onProgress(50);
      }

      if (config?.blur?.enabled !== false) {
        debugLog('process', 'starting blur stage', {
          sessionId: getDebugSessionId(),
          processId,
          progress: 50,
          image: summarizeCanvas(currentImageData)
        });
        const blurResult = await blurDetector.detectBlur(cv, currentImageData);
        result.blur = blurResult;

        if (blurResult.status === 'REJECTED') {
          result.rejectionReasons.push('Image is blurry');
        }

        debugLog('process', 'blur stage finished', {
          sessionId: getDebugSessionId(),
          processId,
          blurStatus: blurResult.status,
          blurScore: blurResult.score,
          blurRatio: blurResult.ratio,
          patchesAnalyzed: blurResult.patchesAnalyzed,
          blurMapCount: blurResult.blurMap?.length
        });

        onProgress(90);
      }

      result.finalStatus = result.rejectionReasons.length === 0 ? 'ACCEPTED' : 'REJECTED';
      onProgress(100);
      debugLog('process', 'process finished', {
        sessionId: getDebugSessionId(),
        processId,
        finalStatus: result.finalStatus,
        rejectionReasons: result.rejectionReasons
      });

      return result;
    } catch (error) {
      debugError('process', 'process failed', {
        sessionId: getDebugSessionId(),
        processId,
        error: summarizeError(error)
      });
      throw error;
    } finally {
      if (shouldCleanupCanvas && currentImageData !== imageData) {
        const canvas = currentImageData;
        setTimeout(() => canvas.width = canvas.height = 0, 0);
      }
      debugTimeEnd(timerLabel);
      debugGroupEnd();
    }
  }, [cv, config, blurDetector]);

  useEffect(() => {
    const pendingItems = queue.queue.filter(i => i.status === 'pending');
    debugLog('queue-ui', 'queue effect scan', {
      sessionId: getDebugSessionId(),
      pendingCount: pendingItems.length,
      processingCount: queue.queue.filter((item) => item.status === 'processing').length,
      completedCount: queue.queue.filter((item) => item.status === 'completed').length
    });
    if (pendingItems.length > 0 && !queue.queue.some(i => i.status === 'processing')) {
      debugLog('queue-ui', 'triggering queue processing', {
        sessionId: getDebugSessionId(),
        pendingCount: pendingItems.length
      });
      queue.processQueue(processImage);
    }
  }, [queue.queue, processImage, queue]);

  const handleCapture = useCallback(() => {
    const captureId = nextDebugId('capture');
    debugGroup('capture', `capture ${captureId}`, {
      sessionId: getDebugSessionId(),
      cameraActive: camera.isActive,
      video: summarizeVideo(camera.videoRef.current)
    });

    if (!camera.isActive) {
      debugWarn('capture', 'capture ignored because camera is inactive', {
        sessionId: getDebugSessionId(),
        captureId
      });
      debugGroupEnd();
      return;
    }

    const canvas = camera.captureFrame();
    if (canvasRef.current) {
      canvasRef.current.getContext('2d').drawImage(canvas, 0, 0);
    }
    const queueId = queue.addToQueue(canvas);
    debugLog('capture', 'capture queued', {
      sessionId: getDebugSessionId(),
      captureId,
      queueId,
      canvas: summarizeCanvas(canvas),
      hiddenCanvas: summarizeCanvas(canvasRef.current)
    });
    debugGroupEnd();
  }, [camera, queue]);

  const handleResultClose = useCallback(() => {
    setShowResult(false);
    setProcessedResult(null);
  }, []);

  useEffect(() => {
    const completed = queue.queue.find(i => i.status === 'completed' && !i.result?.handled);
    debugLog('result', 'result effect scan', {
      sessionId: getDebugSessionId(),
      queueLength: queue.queue.length,
      hasUnhandledCompleted: !!completed
    });
    if (completed) {
      completed.result.handled = true;
      setProcessedResult(completed.result);
      setShowResult(true);
      debugLog('result', 'showing processed result', {
        sessionId: getDebugSessionId(),
        queueId: completed.id,
        finalStatus: completed.result.finalStatus
      });

      if (completed.result.finalStatus === 'ACCEPTED' && onImageAccepted) {
        debugLog('result', 'calling onImageAccepted', {
          sessionId: getDebugSessionId(),
          queueId: completed.id
        });
        onImageAccepted(completed.result);
      } else if (completed.result.finalStatus === 'REJECTED' && onImageRejected) {
        debugWarn('result', 'calling onImageRejected', {
          sessionId: getDebugSessionId(),
          queueId: completed.id
        });
        onImageRejected(completed.result);
      }
    }
  }, [queue.queue, onImageAccepted, onImageRejected]);

  if (cvLoading) {
    debugLog('capture-quality', 'render branch loading', {
      sessionId: getDebugSessionId(),
      cvLoading,
      hasCv: !!cv,
      cvError
    });
    return <div className="loading">Loading local OpenCV assets...</div>;
  }

  if (cvError) {
    debugLog('capture-quality', 'render branch error', {
      sessionId: getDebugSessionId(),
      cvLoading,
      hasCv: !!cv,
      cvError
    });
    return (
      <div className="opencv-error">
        <h3>Failed to load OpenCV</h3>
        <p>{cvError}</p>
        <p>OpenCV is configured to load only from the local <code>public/opencv.js</code> and <code>public/opencv_js.wasm</code> assets.</p>
        <button onClick={loadCvModule}>Retry</button>
      </div>
    );
  }

  if (!cv) {
    debugLog('capture-quality', 'render branch no-cv', {
      sessionId: getDebugSessionId(),
      cvLoading,
      hasCv: !!cv,
      cvError
    });
    return <div className="opencv-error">OpenCV not available</div>;
  }

  debugLog('capture-quality', 'render branch main-app', {
    sessionId: getDebugSessionId(),
    cvLoading,
    hasCv: !!cv,
    cvError,
    cameraActive: camera.isActive,
    queueLength: queue.queue.length,
    showResult
  });

  return (
    <div className="capture-quality">
      <div className="camera-section">
        <CameraView
          videoRef={camera.videoRef}
          isActive={camera.isActive}
          facingMode={camera.facingMode}
          onSwitchCamera={camera.switchCamera}
          onCapture={handleCapture}
          isLoading={camera.isLoading}
        >
          <FramingOverlay framing={framingResult} videoRef={camera.videoRef} />
        </CameraView>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <ProcessingQueue queue={queue.queue} />
      {showResult && (
        <ResultPreview result={processedResult} onClose={handleResultClose} />
      )}
      {!camera.isActive && (
        <button onClick={() => camera.startCamera()} className="start-camera-btn">
          Start Camera
        </button>
      )}
    </div>
  );
}
