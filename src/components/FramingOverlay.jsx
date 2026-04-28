import React from 'react';

export function FramingOverlay({ framing, videoRef }) {
  if (!framing || !framing.corners || framing.status === 'NO_DOCUMENT') {
    return null;
  }

  const video = videoRef?.current;
  if (!video) return null;

  const scaleX = video.clientWidth / video.videoWidth;
  const scaleY = video.clientHeight / video.videoHeight;

  const points = framing.corners.map(c => ({
    x: c.x * scaleX,
    y: c.y * scaleY
  }));

  const color = framing.status === 'VALID' ? '#28a745' : '#dc3545';

  return (
    <svg className="framing-overlay" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    }}>
      <polygon
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="3"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="5" fill={color} />
      ))}
    </svg>
  );
}
