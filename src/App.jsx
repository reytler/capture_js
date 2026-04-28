import React from 'react';
import { CaptureQuality } from './components/CaptureQuality';
import { defaultConfig } from './config/defaultConfig';
import { debugLog, debugWarn, getDebugSessionId } from './utils/debug';
import './styles/main.css';

function App() {
  debugLog('boot', 'App render', {
    sessionId: getDebugSessionId(),
    framingEnabled: defaultConfig.framing?.enabled !== false,
    blurEnabled: defaultConfig.blur?.enabled !== false,
    queueMaxSize: defaultConfig.queue?.maxQueueSize,
    preferredFacing: defaultConfig.camera?.preferredFacing
  });

  const handleImageAccepted = (result) => {
    debugLog('result', 'image accepted callback', {
      sessionId: getDebugSessionId(),
      finalStatus: result?.finalStatus,
      rejectionReasons: result?.rejectionReasons,
      framingStatus: result?.framing?.status,
      blurStatus: result?.blur?.status,
      blurScore: result?.blur?.score
    });
  };

  const handleImageRejected = (result) => {
    debugWarn('result', 'image rejected callback', {
      sessionId: getDebugSessionId(),
      finalStatus: result?.finalStatus,
      rejectionReasons: result?.rejectionReasons,
      framingStatus: result?.framing?.status,
      blurStatus: result?.blur?.status,
      blurScore: result?.blur?.score
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Capture Quality Demo</h1>
      </header>
      <main className="app-main">
        <CaptureQuality
          config={defaultConfig}
          onImageAccepted={handleImageAccepted}
          onImageRejected={handleImageRejected}
        />
      </main>
    </div>
  );
}

export default App;
