# AGENTS.md - Capture Quality

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (Vite, port 5173)
npm run build        # Build for production (vite build)
npm run preview      # Preview production build locally
```

No test framework is currently configured. To add testing:

```bash
npm install --save-dev vitest @testing-library/react jsdom
```

Then add to package.json:
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:run": "vitest run"
  }
}
```

Run a single test file:
```bash
npx vitest run src/hooks/useCamera.test.js
```

## Code Style Guidelines

### File Structure

- **Components**: `src/components/` - React components with `.jsx` extension
- **Hooks**: `src/hooks/` - Custom hooks with `use` prefix, `.js` extension
- **Services**: `src/services/` - Class-based services, `.js` extension
- **Config**: `src/config/` - Configuration objects
- **Utils**: `src/utils/` - Utility functions and constants
- **Styles**: `src/styles/` - CSS files with CSS variables in `variables.css`

### Naming Conventions

- **Components**: PascalCase (e.g., `CaptureQuality.jsx`, `CameraView.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useCamera.js`, `useBlurDetector.js`)
- **Services**: PascalCase with `Service` suffix (e.g., `CameraService.js`, `BlurDetectionService.js`)
- **Constants**: UPPER_SNAKE_CASE for exported constants (e.g., `FRAMING_CONFIG`, `BLUR_CONFIG`)
- **CSS Classes**: kebab-case (e.g., `.capture-quality`, `.camera-section`)

### Imports

Order imports as follows:
1. React and external libraries
2. Relative imports for components/hooks/services
3. Local styles

```javascript
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { someLib } from 'external-lib';

import { useCamera } from '../hooks/useCamera';
import { CameraService } from '../services/CameraService';

import './styles/main.css';
```

Use named imports over default imports when possible. Use object destructuring for props.

### Formatting

- Use 2 spaces for indentation
- Use semicolons at end of statements
- Use single quotes for strings
- No trailing commas in objects/arrays
- Max line length: reasonable (no enforced limit, but aim for readability)

### Types

This project uses plain JavaScript (no TypeScript). Add JSDoc comments for complex functions:

```javascript
/**
 * Detects blur in an image using SVD analysis
 * @param {Object} cv - OpenCV instance
 * @param {HTMLCanvasElement} imageData - Canvas with image data
 * @returns {Object} Blur detection result
 */
detectBlur(cv, imageData) { ... }
```

### React Patterns

- Use functional components with hooks
- Use `useCallback` for event handlers passed to child components
- Use `useRef` for mutable values that don't trigger re-renders (e.g., service instances)
- Use `useEffect` with proper cleanup functions
- Handle loading and error states explicitly in components

```javascript
export function MyComponent({ config, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const serviceRef = useRef(new SomeService());

  const handleAction = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await serviceRef.current.doWork();
      onComplete?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onComplete]);

  return ( ... );
}
```

### Error Handling

- Use try/catch/finally blocks for async operations
- Always clean up resources (OpenCV Mats) in `finally` blocks
- Set error state and display user-friendly messages
- Log errors to console with `console.error` for debugging

```javascript
try {
  const result = await someAsyncOperation();
  return result;
} catch (err) {
  console.error('Operation failed:', err);
  throw new Error(`Failed: ${err.message}`);
} finally {
  resource.delete(); // Cleanup OpenCV resources
}
```

### OpenCV Usage

- Load OpenCV dynamically using `loadOpenCV()` from `utils/opencvLoader.js`
- Always call `.delete()` on OpenCV Mat objects after use
- Use `cv.imshow(canvas, mat)` to render Mats to canvas
- Use `cv.imread(canvas)` to read image data from canvas

### CSS

- Use CSS variables defined in `src/styles/variables.css`
- Keep component-specific styles in `main.css` or create separate files
- Use responsive design with media queries
- Use flexbox/grid for layouts

### Git Practices

- Do not commit without explicit user request
- Do not push to remote unless asked
- Never use `git add -A` or `git add .` without user confirmation
- Check `git status` before committing
