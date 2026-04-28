import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { debugLog, getDebugSessionId } from './utils/debug';

debugLog('boot', 'render root', {
  sessionId: getDebugSessionId(),
  strictMode: true,
  rootExists: !!document.getElementById('root'),
  timestamp: new Date().toISOString()
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
