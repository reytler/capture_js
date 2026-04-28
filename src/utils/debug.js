const globalState = typeof window !== 'undefined'
  ? (window.__CQ_DEBUG_STATE__ ||= {
      sessionId: `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      counters: {}
    })
  : {
      sessionId: 'server',
      counters: {}
    };

function isDebugEnabled() {
  if (typeof window !== 'undefined' && typeof window.__CQ_DEBUG__ === 'boolean') {
    return window.__CQ_DEBUG__;
  }

  return import.meta.env.DEV;
}

function formatPrefix(scope) {
  return `[CQ][${scope}]`;
}

function emit(method, scope, message, data) {
  if (!isDebugEnabled()) {
    return;
  }

  const prefix = formatPrefix(scope);
  if (data === undefined) {
    console[method](`${prefix} ${message}`);
    return;
  }

  console[method](`${prefix} ${message}`, data);
}

export function nextDebugId(prefix) {
  const nextValue = (globalState.counters[prefix] || 0) + 1;
  globalState.counters[prefix] = nextValue;
  return `${prefix}-${nextValue}`;
}

export function getDebugSessionId() {
  return globalState.sessionId;
}

export function debugLog(scope, message, data) {
  emit('log', scope, message, data);
}

export function debugWarn(scope, message, data) {
  emit('warn', scope, message, data);
}

export function debugError(scope, message, data) {
  emit('error', scope, message, data);
}

export function debugGroup(scope, message, data) {
  if (!isDebugEnabled()) {
    return;
  }

  const prefix = formatPrefix(scope);
  if (data === undefined) {
    console.groupCollapsed(`${prefix} ${message}`);
    return;
  }

  console.groupCollapsed(`${prefix} ${message}`, data);
}

export function debugGroupEnd() {
  if (!isDebugEnabled()) {
    return;
  }

  console.groupEnd();
}

export function debugTime(label) {
  if (!isDebugEnabled()) {
    return;
  }

  console.time(label);
}

export function debugTimeEnd(label) {
  if (!isDebugEnabled()) {
    return;
  }

  console.timeEnd(label);
}

export function summarizeError(error) {
  if (!error) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

export function summarizeCanvas(canvas) {
  if (!canvas) {
    return null;
  }

  return {
    width: canvas.width,
    height: canvas.height
  };
}

export function summarizeVideo(video) {
  if (!video) {
    return null;
  }

  return {
    readyState: video.readyState,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    clientWidth: video.clientWidth,
    clientHeight: video.clientHeight
  };
}

export function summarizeStream(stream) {
  if (!stream) {
    return null;
  }

  const tracks = stream.getTracks().map((track) => ({
    kind: track.kind,
    label: track.label,
    readyState: track.readyState,
    enabled: track.enabled
  }));

  return {
    id: stream.id,
    active: stream.active,
    trackCount: tracks.length,
    tracks
  };
}
