import {
  debugLog,
  debugTime,
  debugTimeEnd,
  getDebugSessionId,
  nextDebugId
} from '../utils/debug';

export class BlurDetectionService {
  constructor(config = {}) {
    this.config = {
      patchSize: 27,
      kValue: 1,
      bkThreshold: 0.64,
      blurRatioThreshold: 0.35,
      kmeansAttempts: 3,
      kmeansMaxIter: 100,
      ...config
    };
  }

  detectBlur(cv, imageData) {
    const blurId = nextDebugId('blur-service');
    const timerLabel = `blur-service:${blurId}`;
    debugTime(timerLabel);
    debugLog('blur-service', 'detectBlur start', {
      sessionId: getDebugSessionId(),
      blurId,
      imageWidth: imageData?.width,
      imageHeight: imageData?.height,
      config: this.config
    });
    const src = cv.imread(imageData);
    const gray = new cv.Mat();
    const corrected = new cv.Mat();

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.medianBlur(gray, corrected, 5);
      debugLog('blur-service', 'preprocessing complete', {
        sessionId: getDebugSessionId(),
        blurId,
        rows: corrected.rows,
        cols: corrected.cols
      });

      const foregroundMask = this.segmentForeground(cv, corrected);

      const patchSize = this.config.patchSize;
      const blurRatioThreshold = this.config.blurRatioThreshold;

      let blurredPatches = 0;
      let totalForegroundPatches = 0;
      let patchesVisited = 0;
      let patchesSkippedLowForeground = 0;
      const blurMap = [];

      for (let y = 0; y < corrected.rows - patchSize; y += patchSize) {
        for (let x = 0; x < corrected.cols - patchSize; x += patchSize) {
          patchesVisited++;
          const patch = corrected.roi(new cv.Rect(x, y, patchSize, patchSize));
          const maskPatch = foregroundMask.roi(new cv.Rect(x, y, patchSize, patchSize));

          const foregroundPixels = cv.countNonZero(maskPatch);
          if (foregroundPixels < patchSize * patchSize * 0.5) {
            patchesSkippedLowForeground++;
            patch.delete();
            maskPatch.delete();
            continue;
          }

          totalForegroundPatches++;

          const isBlurred = this.analyzePatchSVD(cv, patch);
          if (isBlurred) blurredPatches++;

          blurMap.push({
            x, y,
            blurred: isBlurred,
            width: patchSize,
            height: patchSize
          });

          patch.delete();
          maskPatch.delete();
        }
      }

      foregroundMask.delete();

      const blurRatio = totalForegroundPatches > 0 ? blurredPatches / totalForegroundPatches : 0;
      const isBlurred = blurRatio >= blurRatioThreshold;
      debugLog('blur-service', 'detectBlur result', {
        sessionId: getDebugSessionId(),
        blurId,
        patchSize,
        patchesVisited,
        patchesSkippedLowForeground,
        patchesAnalyzed: totalForegroundPatches,
        blurredPatches,
        blurRatio,
        status: isBlurred ? 'REJECTED' : 'ACCEPTED'
      });

        return {
         score: blurRatio,
         ratio: blurRatio,
         status: isBlurred ? 'REJECTED' : 'ACCEPTED',
         blurMap,
         patchesAnalyzed: totalForegroundPatches
       };
    } finally {
      src.delete();
      gray.delete();
      corrected.delete();
      debugTimeEnd(timerLabel);
    }
  }

  segmentForeground(cv, gray) {
    const segmentId = nextDebugId('segment');
    const timerLabel = `segment:${segmentId}`;
    debugTime(timerLabel);
    debugLog('blur-service', 'segmentForeground start', {
      sessionId: getDebugSessionId(),
      segmentId,
      rows: gray.rows,
      cols: gray.cols
    });
    const samples = new cv.Mat(gray.rows * gray.cols, 1, cv.CV_32FC1);

    for (let i = 0; i < gray.rows; i++) {
      for (let j = 0; j < gray.cols; j++) {
        samples.data32F[i * gray.cols + j] = gray.data[i * gray.step + j];
      }
    }

    const labels = new cv.Mat(gray.rows * gray.cols, 1, cv.CV_32SC1);
    const criteria = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS + cv.TERM_CRITERIA_MAX_ITER,
      this.config.kmeansMaxIter,
      1.0
    );

    const centers = new cv.Mat();
    cv.kmeans(samples, 2, labels, criteria, this.config.kmeansAttempts, cv.KMEANS_RANDOM_CENTERS, centers);

    const fgCenter = centers.data32F[0] > centers.data32F[1] ? 0 : 1;
    const foregroundMask = new cv.Mat(gray.rows, gray.cols, cv.CV_8UC1);
    let foregroundCount = 0;

    for (let i = 0; i < labels.rows; i++) {
      foregroundMask.data[i] = labels.data32S[i] === fgCenter ? 255 : 0;
      if (foregroundMask.data[i] === 255) {
        foregroundCount++;
      }
    }

    debugLog('blur-service', 'segmentForeground result', {
      sessionId: getDebugSessionId(),
      segmentId,
      sampleCount: samples.rows,
      centers: Array.from(centers.data32F),
      fgCenter,
      foregroundCount,
      foregroundRatio: foregroundCount / labels.rows
    });

    samples.delete();
    labels.delete();
    centers.delete();
    debugTimeEnd(timerLabel);

    return foregroundMask;
  }

  analyzePatchSVD(cv, patch) {
    const patchFloat = new cv.Mat();
    patch.convertTo(patchFloat, cv.CV_32F);

    const singularValues = new cv.Mat();

    try {
      cv.SVD.compute(patchFloat, singularValues);

      const totalValues = singularValues.rows;
      const k = this.config.kValue;

      let sumAll = 0;
      for (let i = 0; i < totalValues; i++) {
        sumAll += singularValues.data32F[i];
      }

      if (sumAll === 0) return false;

      let sumK = 0;
      for (let i = 0; i < Math.min(k, totalValues); i++) {
        sumK += singularValues.data32F[i];
      }

      const bk = sumK / sumAll;
      return bk >= this.config.bkThreshold;
    } finally {
      patchFloat.delete();
      singularValues.delete();
    }
  }
}
