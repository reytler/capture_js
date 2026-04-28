export const FRAMING_CONFIG = {
  cannyThreshold1: 50,
  cannyThreshold2: 150,
  minContourArea: 50000,
  aspectRatioTolerance: 0.10,
  angleTolerance: 0.15,
  sideRatioTolerance: 0.20,
  maxSkewAngle: 15,
  minFillRatio: 0.40,
  maxFillRatio: 0.95,
  documentTypes: {
    A4: { width: 210, height: 297, ratio: 210 / 297 },
    LETTER: { width: 216, height: 279, ratio: 216 / 279 },
    ID: { width: 85.6, height: 54, ratio: 85.6 / 54 }
  }
};

export const BLUR_CONFIG = {
  patchSize: 27,
  kValue: 1,
  bkThreshold: 0.64,
  blurRatioThreshold: 0.35,
  kmeansAttempts: 3,
  kmeansMaxIter: 100
};

export const QUEUE_CONFIG = {
  maxConcurrent: 1,
  maxQueueSize: 50
};
