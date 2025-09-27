const CANCELLATION_TOKENS = new Set([
  'canceled',
  'cancelled',
  'cancelerror',
  'cancelederror',
  'cancellederror',
  'cancelation',
  'cancellation',
  'aborterror'
]);

const isCancellationReasonString = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (CANCELLATION_TOKENS.has(normalized)) {
    return true;
  }

  return (
    normalized.startsWith('canceled:') ||
    normalized.startsWith('cancelled:') ||
    normalized.includes(' operation was canceled') ||
    normalized.includes(' operation was cancelled') ||
    normalized.endsWith(' canceled') ||
    normalized.endsWith(' cancelled') ||
    normalized.includes('request aborted') ||
    normalized.includes('operation canceled') ||
    normalized.includes('operation cancelled')
  );
};

const GLOBAL_HANDLER_MARKER = '__crew_command_center_cancellation_handler_installed__';
let handlerInstalled = false;

export const installGlobalCancellationHandler = () => {
  if (handlerInstalled || typeof window === 'undefined') {
    return;
  }

  if (window[GLOBAL_HANDLER_MARKER]) {
    handlerInstalled = true;
    return;
  }

  const handleUnhandledRejection = (event) => {
    if (!event) {
      return;
    }

    const { reason } = event;
    if (!reason) {
      return;
    }

    const candidates = [];

    if (typeof reason === 'string') {
      candidates.push(reason);
    } else if (typeof reason === 'object') {
      if (typeof reason.name === 'string') {
        candidates.push(reason.name);
      }
      if (typeof reason.message === 'string') {
        candidates.push(reason.message);
      }
      if (typeof reason.code === 'string') {
        candidates.push(reason.code);
      }
      if (typeof reason.toString === 'function') {
        const stringified = reason.toString();
        if (typeof stringified === 'string' && stringified && stringified !== '[object Object]') {
          candidates.push(stringified);
        }
      }
    }

    if (candidates.some(isCancellationReasonString)) {
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      return;
    }
  };

  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  window[GLOBAL_HANDLER_MARKER] = true;
  handlerInstalled = true;
};

export default installGlobalCancellationHandler;
