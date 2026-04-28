import { useState, useCallback, useEffect, useRef } from 'react';
import { QueueService } from '../services/QueueService';
import { debugLog, debugWarn, getDebugSessionId } from '../utils/debug';

export function useImageQueue(config) {
  const [queue, setQueue] = useState([]);
  const queueService = useRef(null);

  if (!queueService.current) {
    queueService.current = new QueueService(config?.queue);
    debugLog('queue', 'created QueueService instance', {
      sessionId: getDebugSessionId(),
      config: config?.queue
    });
  }

  useEffect(() => {
    const service = queueService.current;
    debugLog('queue', 'registering queue callbacks', {
      sessionId: getDebugSessionId()
    });
    service.onProgress = (item) => {
      debugLog('queue', 'onProgress callback', {
        sessionId: getDebugSessionId(),
        queueId: item.id,
        status: item.status,
        progress: item.progress,
        queueLength: service.getQueue().length
      });
      setQueue([...service.getQueue()]);
    };
    service.onComplete = (item) => {
      debugLog('queue', 'onComplete callback', {
        sessionId: getDebugSessionId(),
        queueId: item.id,
        status: item.status,
        hasResult: !!item.result,
        error: item.error
      });
      setQueue([...service.getQueue()]);
    };
    return () => {
      debugLog('queue', 'clearing queue callbacks', {
        sessionId: getDebugSessionId()
      });
      service.onProgress = null;
      service.onComplete = null;
    };
  }, []);

  const addToQueue = useCallback((imageData) => {
    const id = queueService.current.add(imageData);
    if (!id) {
      debugWarn('queue', 'addToQueue failed because queue is full', {
        sessionId: getDebugSessionId(),
        queueLength: queueService.current.getQueue().length,
        imageWidth: imageData?.width,
        imageHeight: imageData?.height
      });
    } else {
      debugLog('queue', 'addToQueue succeeded', {
        sessionId: getDebugSessionId(),
        queueId: id,
        imageWidth: imageData?.width,
        imageHeight: imageData?.height
      });
    }
    setQueue([...queueService.current.getQueue()]);
    return id;
  }, []);

  const processQueue = useCallback(async (processor) => {
    debugLog('queue', 'processQueue requested from hook', {
      sessionId: getDebugSessionId(),
      queueLength: queueService.current.getQueue().length
    });
    await queueService.current.processQueue(processor);
  }, []);

  const clearQueue = useCallback(() => {
    debugWarn('queue', 'clearQueue called', {
      sessionId: getDebugSessionId(),
      queueLength: queueService.current.getQueue().length
    });
    queueService.current.clear();
    setQueue([]);
  }, []);

  return {
    queue,
    addToQueue,
    processQueue,
    clearQueue,
    getPendingCount: () => queueService.current.getPendingCount(),
    getProcessedCount: () => queueService.current.getProcessedCount()
  };
}
