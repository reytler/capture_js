import React from 'react';

export function ResultPreview({ result, onClose }) {
  if (!result) return null;

  return (
    <div className="result-preview">
      <div className="result-header">
        <h3>Result</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>
      <div className={`result-status ${result.finalStatus === 'ACCEPTED' ? 'accepted' : 'rejected'}`}>
        {result.finalStatus || 'UNKNOWN'}
      </div>
      {result.framing && (
        <div className="result-section">
          <h4>Framing</h4>
          <p>Status: {result.framing.status}</p>
          {result.framing.validation && (
            <div>
              <p>Aspect Ratio: {result.framing.validation.aspectRatio?.toFixed(2)}</p>
              <p>Fill Ratio: {result.framing.validation.fillRatio?.toFixed(2)}</p>
              {result.framing.validation.details.length > 0 && (
                <ul>
                  {result.framing.validation.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
      {result.blur && (
        <div className="result-section">
          <h4>Blur Detection</h4>
          <p>Status: {result.blur.status}</p>
          <p>Score: {result.blur.score?.toFixed(3)}</p>
          <p>Ratio: {result.blur.ratio?.toFixed(3)}</p>
        </div>
      )}
      {result.rejectionReasons && result.rejectionReasons.length > 0 && (
        <div className="result-section">
          <h4>Rejection Reasons</h4>
          <ul>
            {result.rejectionReasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
