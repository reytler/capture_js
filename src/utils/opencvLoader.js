import {
  debugError,
  debugGroup,
  debugGroupEnd,
  debugLog,
  debugTime,
  debugTimeEnd,
  debugWarn,
  getDebugSessionId,
  nextDebugId,
  summarizeError
} from './debug';

let cvReady = false;
let cvLoadPromise = null;

const OPENCV_SCRIPT_ID = 'opencv-local-script';
const OPENCV_TIMEOUT_MS = 30000;
const OPENCV_SCRIPT_FILE = 'opencv.js';
const OPENCV_WASM_FILE = 'opencv_js.wasm';

function isCVReady() {
  return typeof window !== 'undefined' && window.cv && typeof window.cv.Mat === 'function';
}

function getBaseAssetPath() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function getOpenCVScriptPath() {
  return `${getBaseAssetPath()}${OPENCV_SCRIPT_FILE}`;
}

function getOpenCVWasmPath() {
  return `${getBaseAssetPath()}${OPENCV_WASM_FILE}`;
}

function resetLoadState({ removeScript = false, resetModule = false } = {}) {
  debugWarn('loader', 'reset load state', {
    sessionId: getDebugSessionId(),
    removeScript,
    resetModule,
    hadCv: !!window.cv,
    hadModule: !!window.Module
  });
  cvReady = false;
  cvLoadPromise = null;
  window.cv = undefined;

  if (resetModule) {
    delete window.Module;
  }

  if (removeScript) {
    const script = document.getElementById(OPENCV_SCRIPT_ID);
    if (script) {
      script.onload = null;
      script.onerror = null;
      script.remove();
    }
  }
}

export function loadOpenCV() {
  const cvLoadId = nextDebugId('cv-load');
  const timerLabel = `cv-load:${cvLoadId}`;

  debugGroup('loader', `loadOpenCV ${cvLoadId}`, {
    sessionId: getDebugSessionId(),
    cvReady,
    hasWindowCv: !!window.cv,
    hasExistingPromise: !!cvLoadPromise,
    scriptPath: getOpenCVScriptPath(),
    wasmPath: getOpenCVWasmPath(),
    basePath: getBaseAssetPath()
  });

  if (isCVReady()) {
    cvReady = true;
    debugLog('loader', 'resolved immediately from existing window.cv', {
      sessionId: getDebugSessionId(),
      cvLoadId
    });
    debugGroupEnd();
    return Promise.resolve(window.cv);
  }

  if (cvLoadPromise) {
    debugWarn('loader', 'reusing existing cvLoadPromise', {
      sessionId: getDebugSessionId(),
      cvLoadId
    });
    debugGroupEnd();
    return cvLoadPromise;
  }

  cvLoadPromise = new Promise((resolve, reject) => {
    debugTime(timerLabel);
    let settled = false;
    const previousModule = window.Module;
    const moduleConfig = previousModule || {};
    const previousRuntimeInitialized = previousModule?.onRuntimeInitialized;
    const previousOnAbort = previousModule?.onAbort;
    let script = document.getElementById(OPENCV_SCRIPT_ID);

    debugLog('loader', 'created loader promise', {
      sessionId: getDebugSessionId(),
      cvLoadId,
      previousModuleExists: previousModule !== undefined,
      previousRuntimeInitializedExists: typeof previousRuntimeInitialized === 'function',
      previousOnAbortExists: typeof previousOnAbort === 'function',
      scriptAlreadyPresent: !!script
    });

    const restoreModule = () => {
      if (window.Module !== moduleWithHandlers) {
        debugWarn('loader', 'skipped module restore because global Module changed', {
          sessionId: getDebugSessionId(),
          cvLoadId
        });
        return;
      }

      if (previousModule === undefined) {
        delete window.Module;
        debugLog('loader', 'removed temporary window.Module', {
          sessionId: getDebugSessionId(),
          cvLoadId
        });
        return;
      }

      window.Module = previousModule;
      debugLog('loader', 'restored previous window.Module', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
    };

    const cleanup = () => {
      if (script) {
        script.onload = null;
        script.onerror = null;
      }

      restoreModule();
      debugLog('loader', 'cleanup complete', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasScript: !!script
      });
    };

    const finalizeResolve = (cvModule) => {
      if (settled) {
        return;
      }

      if (!cvModule || typeof cvModule.Mat !== 'function') {
        finalizeReject(new Error('OpenCV.js loaded but did not initialize correctly'));
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      cvReady = true;
      window.cv = cvModule;
      debugLog('loader', 'OpenCV resolved', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasMat: !!cvModule?.Mat,
        cvEqualsWindowCv: cvModule === window.cv
      });
      debugTimeEnd(timerLabel);
      debugGroupEnd();
      resolve(cvModule);
    };

    const finalizeReject = (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      resetLoadState({ removeScript: true, resetModule: true });
      debugError('loader', 'OpenCV rejected', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        error: summarizeError(error)
      });
      debugTimeEnd(timerLabel);
      debugGroupEnd();
      reject(error);
    };

    const resolveFromWindowCV = () => {
      if (isCVReady()) {
        debugLog('loader', 'window.cv ready immediately', {
          sessionId: getDebugSessionId(),
          cvLoadId
        });
        finalizeResolve(window.cv);
        return true;
      }

      if (window.cv && typeof window.cv.then === 'function') {
        debugLog('loader', 'window.cv is thenable, attaching callback', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          hasMat: !!window.cv.Mat
        });
        try {
          window.cv.then((cvModule) => {
            const resolvedModule = cvModule || window.cv;
            if (resolvedModule) {
              window.cv = resolvedModule;
            }
            debugLog('loader', 'thenable callback fired', {
              sessionId: getDebugSessionId(),
              cvLoadId,
              resolvedHasMat: !!resolvedModule?.Mat
            });
            finalizeResolve(resolvedModule);
          });
        } catch (error) {
          finalizeReject(error instanceof Error ? error : new Error('OpenCV.js failed to resolve'));
        }

        return true;
      }

      debugWarn('loader', 'window.cv not ready and not thenable', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasWindowCv: !!window.cv,
        windowCvType: typeof window.cv
      });
      return false;
    };

    const runtimeInitializedHandler = () => {
      debugLog('loader', 'onRuntimeInitialized fired', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasWindowCv: !!window.cv,
        windowCvType: typeof window.cv
      });
      previousRuntimeInitialized?.();

      if (resolveFromWindowCV()) {
        return;
      }

      finalizeReject(new Error('OpenCV.js runtime initialized without a usable window.cv module'));
    };

    const timeoutId = window.setTimeout(() => {
      debugError('loader', 'loader timed out', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        timeoutMs: OPENCV_TIMEOUT_MS,
        scriptPath: getOpenCVScriptPath(),
        wasmPath: getOpenCVWasmPath(),
        hasWindowCv: !!window.cv
      });
      finalizeReject(new Error(`Timed out waiting for local OpenCV assets to initialize from ${getOpenCVScriptPath()} and ${getOpenCVWasmPath()}`));
    }, OPENCV_TIMEOUT_MS);

    const abortHandler = (what) => {
      previousOnAbort?.(what);

      const message = typeof what === 'string' && what ? what : 'OpenCV.js aborted during initialization';
      debugError('loader', 'OpenCV abort handler fired', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        abortValue: what,
        message
      });
      finalizeReject(new Error(message));
    };

    const moduleWithHandlers = {
      ...moduleConfig,
      locateFile: (path, prefix) => {
        const resolvedPath = path.endsWith('.wasm')
          ? getOpenCVWasmPath()
          : typeof moduleConfig.locateFile === 'function'
            ? moduleConfig.locateFile(path, prefix)
            : `${new URL(path, prefix || getOpenCVScriptPath()).toString()}`;

        debugLog('loader', 'locateFile', {
          sessionId: getDebugSessionId(),
          cvLoadId,
          requestedPath: path,
          prefix,
          resolvedPath,
          isWasm: path.endsWith('.wasm')
        });

        if (path.endsWith('.wasm')) {
          return resolvedPath;
        }

        if (typeof moduleConfig.locateFile === 'function') {
          return resolvedPath;
        }

        return resolvedPath;
      },
      onRuntimeInitialized: runtimeInitializedHandler,
      onAbort: abortHandler
    };

    window.Module = moduleWithHandlers;
    debugLog('loader', 'assigned temporary window.Module', {
      sessionId: getDebugSessionId(),
      cvLoadId
    });

    if (resolveFromWindowCV()) {
      debugLog('loader', 'resolved from existing window.cv after module assignment', {
        sessionId: getDebugSessionId(),
        cvLoadId
      });
      return;
    }

    const handleScriptError = () => {
      debugError('loader', 'script failed to load', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        scriptSrc: getOpenCVScriptPath()
      });
      finalizeReject(new Error(`Failed to load local OpenCV.js from ${getOpenCVScriptPath()}`));
    };

    const handleScriptLoad = () => {
      debugLog('loader', 'script.onload fired', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        hasWindowCv: !!window.cv,
        windowCvType: typeof window.cv
      });
      if (!resolveFromWindowCV() && !window.cv) {
        finalizeReject(new Error('OpenCV.js script loaded but window.cv was not created'));
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = OPENCV_SCRIPT_ID;
      script.async = true;
      script.type = 'text/javascript';
      script.src = getOpenCVScriptPath();
      script.onerror = handleScriptError;
      script.onload = handleScriptLoad;

      debugLog('loader', 'injecting local OpenCV script', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        scriptId: OPENCV_SCRIPT_ID,
        scriptSrc: script.src,
        async: script.async
      });
      document.head.appendChild(script);
      return;
    }

    if (!resolveFromWindowCV()) {
      debugWarn('loader', 'rebinding handlers to existing OpenCV script', {
        sessionId: getDebugSessionId(),
        cvLoadId,
        scriptSrc: script.src
      });
      script.onload = handleScriptLoad;
      script.onerror = handleScriptError;
    }
  });

  return cvLoadPromise;
}

export function isOpenCVReady() {
  return cvReady && isCVReady();
}
