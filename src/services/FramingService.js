import {
  debugLog,
  debugTime,
  debugTimeEnd,
  debugWarn,
  getDebugSessionId,
  nextDebugId
} from '../utils/debug';

export class FramingService {
  constructor(config = {}) {
    this.config = {
      cannyThreshold1: 50,
      cannyThreshold2: 150,
      minContourArea: 50000,
      aspectRatioTolerance: 0.10,
      sideRatioTolerance: 0.20,
      maxSkewAngle: 15,
      minFillRatio: 0.40,
      maxFillRatio: 0.95,
      ...config
    };
    this.documentTypes = {
      A4: { width: 210, height: 297, ratio: 210 / 297 },
      LETTER: { width: 216, height: 279, ratio: 216 / 279 },
      ID: { width: 85.6, height: 54, ratio: 85.6 / 54 }
    };
  }

  detectDocument(cv, imageData) {
    const framingId = nextDebugId('framing');
    const timerLabel = `framing:${framingId}`;
    debugTime(timerLabel);
    debugLog('framing', 'detectDocument start', {
      sessionId: getDebugSessionId(),
      framingId,
      imageWidth: imageData?.width,
      imageHeight: imageData?.height,
      config: this.config
    });
    const src = cv.imread(imageData);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    let bestContour = null;

    try {
      debugLog('framing', 'image loaded into Mat', {
        sessionId: getDebugSessionId(),
        framingId,
        rows: src.rows,
        cols: src.cols,
        type: src.type()
      });
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.Canny(gray, edges, this.config.cannyThreshold1, this.config.cannyThreshold2, 3, false);
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      debugLog('framing', 'findContours finished', {
        sessionId: getDebugSessionId(),
        framingId,
        contourCount: contours.size()
      });

      let bestArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        if (area > this.config.minContourArea && area > bestArea) {
          const peri = cv.arcLength(contour, true);
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, 0.02 * peri, true);
          if (approx.rows === 4) {
            if (bestContour) bestContour.delete();
            bestContour = approx;
            bestArea = area;
            debugLog('framing', 'found new best contour', {
              sessionId: getDebugSessionId(),
              framingId,
              contourIndex: i,
              area,
              perimeter: peri,
              approxRows: approx.rows
            });
          } else {
            approx.delete();
          }
        }
        contour.delete();
      }

      if (!bestContour) {
        debugWarn('framing', 'no document contour found', {
          sessionId: getDebugSessionId(),
          framingId
        });
        return {
          status: 'NO_DOCUMENT',
          corners: null,
          validation: null,
          correctedImage: null
        };
      }

      const corners = this.extractCorners(cv, bestContour);
      const validation = this.validateFraming(cv, corners, src.cols, src.rows);
      let correctedImage = null;
      debugLog('framing', 'framing validation complete', {
        sessionId: getDebugSessionId(),
        framingId,
        corners,
        validation
      });

      if (validation.valid) {
        correctedImage = this.correctPerspective(cv, src, corners);
        debugLog('framing', 'perspective correction generated', {
          sessionId: getDebugSessionId(),
          framingId,
          rows: correctedImage.rows,
          cols: correctedImage.cols
        });
      }

      return {
        status: validation.valid ? 'VALID' : 'INVALID',
        corners,
        validation,
        correctedImage
      };
    } finally {
      if (bestContour) bestContour.delete();
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      debugTimeEnd(timerLabel);
    }
  }

  extractCorners(cv, contour) {
    const points = [];
    for (let i = 0; i < 4; i++) {
      points.push({
        x: contour.data32S[i * 2],
        y: contour.data32S[i * 2 + 1]
      });
    }

    const center = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    center.x /= 4;
    center.y /= 4;

    const sorted = points.sort((a, b) => {
      const angleA = Math.atan2(a.y - center.y, a.x - center.x);
      const angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });

    debugLog('framing', 'extractCorners', {
      sessionId: getDebugSessionId(),
      points,
      sorted
    });

    return sorted;
  }

  validateFraming(cv, corners, imageWidth, imageHeight) {
    const validation = {
      valid: false,
      aspectRatio: null,
      angles: [],
      sideRatios: null,
      skewAngle: null,
      fillRatio: null,
      details: []
    };

    const widthTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const widthBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
    const heightLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    const heightRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

    const avgWidth = (widthTop + widthBottom) / 2;
    const avgHeight = (heightLeft + heightRight) / 2;
    const aspectRatio = avgWidth / avgHeight;

    validation.aspectRatio = aspectRatio;

    const tolerance = this.config.aspectRatioTolerance;
    const expectedRatios = Object.values(this.documentTypes).map(d => d.ratio);
    const matchedRatio = expectedRatios.find(r => Math.abs(aspectRatio - r) / r < tolerance);

    if (!matchedRatio) {
      validation.details.push('Aspect ratio out of tolerance');
    }

    for (let i = 0; i < 4; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % 4];
      const angle = Math.abs(Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI);
      validation.angles.push(angle);
    }

    const maxSide = Math.max(widthTop, widthBottom, heightLeft, heightRight);
    const minSide = Math.min(widthTop, widthBottom, heightLeft, heightRight);
    const sideRatio = maxSide / minSide;
    validation.sideRatios = sideRatio;

    if (sideRatio > 1 + this.config.sideRatioTolerance) {
      validation.details.push('Side ratio out of tolerance');
    }

    const diagonal1 = Math.atan2(corners[2].y - corners[0].y, corners[2].x - corners[0].x);
    const diagonal2 = Math.atan2(corners[3].y - corners[1].y, corners[3].x - corners[1].x);
    let skewAngle = Math.abs(diagonal1 - diagonal2) * 180 / Math.PI;
    if (skewAngle > 90) skewAngle = 180 - skewAngle;
    validation.skewAngle = skewAngle;

    if (skewAngle > this.config.maxSkewAngle) {
      validation.details.push('Skew angle too high');
    }

    const cornersMat = new cv.Mat(4, 1, cv.CV_32SC2);
    for (let i = 0; i < 4; i++) {
      cornersMat.data32S[i * 2] = Math.round(corners[i].x);
      cornersMat.data32S[i * 2 + 1] = Math.round(corners[i].y);
    }
    const documentArea = cv.contourArea(cornersMat);
    const imageArea = imageWidth * imageHeight;
    const fillRatio = documentArea / imageArea;
    validation.fillRatio = fillRatio;
    cornersMat.delete();

    if (fillRatio < this.config.minFillRatio || fillRatio > this.config.maxFillRatio) {
      validation.details.push('Fill ratio out of range');
    }

    validation.valid = validation.details.length === 0;
    if (!validation.valid) {
      debugWarn('framing', 'validateFraming invalid result', {
        sessionId: getDebugSessionId(),
        corners,
        imageWidth,
        imageHeight,
        widthTop,
        widthBottom,
        heightLeft,
        heightRight,
        aspectRatio,
        matchedRatio,
        angles: validation.angles,
        sideRatio,
        skewAngle,
        documentArea,
        imageArea,
        fillRatio,
        details: validation.details
      });
    } else {
      debugLog('framing', 'validateFraming valid result', {
        sessionId: getDebugSessionId(),
        aspectRatio,
        sideRatio,
        skewAngle,
        fillRatio
      });
    }
    return validation;
  }

  correctPerspective(cv, src, corners) {
    const widthTop = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const widthBottom = Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y);
    const heightLeft = Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y);
    const heightRight = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);

    const maxWidth = Math.max(widthTop, widthBottom);
    const maxHeight = Math.max(heightLeft, heightRight);

    const srcPoints = new cv.Mat(4, 1, cv.CV_32FC2);
    const dstPoints = new cv.Mat(4, 1, cv.CV_32FC2);

    for (let i = 0; i < 4; i++) {
      srcPoints.data32F[i * 2] = corners[i].x;
      srcPoints.data32F[i * 2 + 1] = corners[i].y;
    }

    dstPoints.data32F[0] = 0;
    dstPoints.data32F[1] = 0;
    dstPoints.data32F[2] = maxWidth;
    dstPoints.data32F[3] = 0;
    dstPoints.data32F[4] = maxWidth;
    dstPoints.data32F[5] = maxHeight;
    dstPoints.data32F[6] = 0;
    dstPoints.data32F[7] = maxHeight;

    const transform = cv.getPerspectiveTransform(srcPoints, dstPoints);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, transform, new cv.Size(Math.round(maxWidth), Math.round(maxHeight)));
    debugLog('framing', 'correctPerspective complete', {
      sessionId: getDebugSessionId(),
      corners,
      maxWidth,
      maxHeight,
      outputRows: dst.rows,
      outputCols: dst.cols
    });

    srcPoints.delete();
    dstPoints.delete();
    transform.delete();

    return dst;
  }
}
