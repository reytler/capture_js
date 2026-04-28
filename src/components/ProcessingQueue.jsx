import React from 'react';

export function ProcessingQueue({ queue }) {
  if (queue.length === 0) return null;

  return (
    <div className="processing-queue">
      <h3>Processing Queue ({queue.length})</h3>
      <div className="queue-items">
        {queue.map(item => (
          <div key={item.id} className={`queue-item ${item.status}`}>
            <div className="queue-item-header">
              <span className="queue-item-id">Image {item.id.toString().slice(-4)}</span>
              <span className={`queue-item-status ${item.status}`}>{item.status}</span>
            </div>
            {item.status === 'processing' && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${item.progress}%` }} />
              </div>
            )}
            {item.status === 'completed' && item.result && (
              <div className="queue-item-result">
                {item.result.finalStatus || (item.result.status || 'UNKNOWN')}
              </div>
            )}
            {item.status === 'failed' && (
              <div className="queue-item-error">{item.error}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
