import { useState, useCallback, useRef } from 'react';
import { BlurDetectionService } from '../services/BlurDetectionService';
import {
  debugError,
  debugLog,
  debugTime,
  debugTimeEnd,
  getDebugSessionId,
  nextDebugId,
  summarizeCanvas,
  summarizeError
} from '../utils/debug';

export function useBlurDetector(config) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const service = useRef(new BlurDetectionService(config?.blur || {}));

  debugLog('blur', 'useBlurDetector render', {
    sessionId: getDebugSessionId(),
    isProcessing,
    hasResult: !!result
  });

  const detectBlur = useCallback(async (cv, imageData) => {
    const blurId = nextDebugId('blur');
    const timerLabel = `blur:${blurId}`;
    debugTime(timerLabel);
    debugLog('blur', 'detectBlur called', {
      sessionId: getDebugSessionId(),
      blurId,
      hasCv: !!cv,
      image: summarizeCanvas(imageData),
      isProcessingBefore: isProcessing
    });
    setIsProcessing(true);
    try {
      const result = service.current.detectBlur(cv, imageData);
      setResult(result);
      debugLog('blur', 'detectBlur resolved', {
        sessionId: getDebugSessionId(),
        blurId,
        status: result?.status,
        score: result?.score,
        ratio: result?.ratio,
        patchesAnalyzed: result?.patchesAnalyzed
      });
      return result;
    } catch (error) {
      debugError('blur', 'detectBlur failed', {
        sessionId: getDebugSessionId(),
        blurId,
        error: summarizeError(error)
      });
      throw error;
    } finally {
      setIsProcessing(false);
      debugTimeEnd(timerLabel);
    }
  }, [isProcessing]);

  return {
    detectBlur,
    isProcessing,
    result
  };
}
