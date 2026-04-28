import { FRAMING_CONFIG, BLUR_CONFIG, QUEUE_CONFIG } from '../utils/constants';

export const defaultConfig = {
  camera: {
    preferredFacing: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  },
  framing: {
    enabled: true,
    ...FRAMING_CONFIG
  },
  blur: {
    enabled: true,
    ...BLUR_CONFIG
  },
  queue: {
    ...QUEUE_CONFIG
  },
  theme: {
    primaryColor: '#007bff',
    successColor: '#28a745',
    errorColor: '#dc3545',
    warningColor: '#ffc107',
    backgroundColor: '#ffffff',
    textColor: '#333333'
  }
};
