import {
  debugError,
  debugGroup,
  debugGroupEnd,
  debugLog,
  debugTime,
  debugTimeEnd,
  debugWarn,
  getDebugSessionId
} from '../utils/debug';

export class QueueService {
  constructor(config = {}) {
    this.maxQueueSize = config.maxQueueSize || 50;
    this.queue = [];
    this.processing = false;
    this.onProgress = null;
    this.onComplete = null;
  }

  add(item) {
    debugLog('queue-service', 'add called', {
      sessionId: getDebugSessionId(),
      currentLength: this.queue.length,
      maxQueueSize: this.maxQueueSize,
      imageWidth: item?.width,
      imageHeight: item?.height
    });
    if (this.queue.length >= this.maxQueueSize) {
      debugWarn('queue-service', 'queue full', {
        sessionId: getDebugSessionId(),
        currentLength: this.queue.length,
        maxQueueSize: this.maxQueueSize
      });
      return false;
    }
    const queueItem = {
      id: Date.now() + Math.random(),
      data: item,
      status: 'pending',
      progress: 0,
      result: null,
      error: null
    };
    this.queue.push(queueItem);
    debugLog('queue-service', 'item added', {
      sessionId: getDebugSessionId(),
      queueId: queueItem.id,
      newLength: this.queue.length
    });
    return queueItem.id;
  }

  getQueue() {
    return [...this.queue];
  }

  getPendingCount() {
    return this.queue.filter(item => item.status === 'pending').length;
  }

  getProcessedCount() {
    return this.queue.filter(item => item.status === 'completed' || item.status === 'failed').length;
  }

  async processQueue(processor) {
    if (this.processing) {
      debugWarn('queue-service', 'processQueue ignored because processing is already active', {
        sessionId: getDebugSessionId(),
        queueLength: this.queue.length
      });
      return;
    }

    debugGroup('queue-service', 'processQueue start', {
      sessionId: getDebugSessionId(),
      queueLength: this.queue.length,
      pendingCount: this.getPendingCount()
    });
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.find(i => i.status === 'pending');
      if (!item) break;

      const timerLabel = `process:${item.id}`;

      debugLog('queue-service', 'processing next item', {
        sessionId: getDebugSessionId(),
        queueId: item.id,
        queueLength: this.queue.length,
        pendingCount: this.getPendingCount()
      });

      item.status = 'processing';
      item.progress = 0;

      try {
        debugTime(timerLabel);
        if (this.onProgress) this.onProgress(item);
        const result = await processor(item.data, (progress) => {
          item.progress = progress;
          if ([0, 20, 50, 90, 100].includes(progress)) {
            debugLog('queue-service', 'processor progress update', {
              sessionId: getDebugSessionId(),
              queueId: item.id,
              progress
            });
          }
          if (this.onProgress) this.onProgress(item);
        });
        item.result = result;
        item.status = 'completed';
        item.progress = 100;
        debugLog('queue-service', 'processor resolved', {
          sessionId: getDebugSessionId(),
          queueId: item.id,
          finalStatus: result?.finalStatus,
          rejectionReasons: result?.rejectionReasons
        });
      } catch (err) {
        item.error = err.message;
        item.status = 'failed';
        debugError('queue-service', 'processor failed', {
          sessionId: getDebugSessionId(),
          queueId: item.id,
          message: err.message,
          stack: err.stack
        });
      } finally {
        debugTimeEnd(timerLabel);
      }

      if (this.onProgress) this.onProgress(item);
      if (this.onComplete) this.onComplete(item);
    }

    this.processing = false;
    debugLog('queue-service', 'processQueue finished', {
      sessionId: getDebugSessionId(),
      queueLength: this.queue.length,
      processedCount: this.getProcessedCount()
    });
    debugGroupEnd();
  }

  clear() {
    debugWarn('queue-service', 'clearing queue', {
      sessionId: getDebugSessionId(),
      previousLength: this.queue.length
    });
    this.queue = [];
  }

  remove(id) {
    debugLog('queue-service', 'removing queue item', {
      sessionId: getDebugSessionId(),
      queueId: id,
      existed: this.queue.some((item) => item.id === id)
    });
    this.queue = this.queue.filter(item => item.id !== id);
  }
}
