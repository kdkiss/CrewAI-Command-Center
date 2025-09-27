const DEFAULT_API_BASE = '/api';
const DEFAULT_SOCKET_PATH = '/socket.io';

const getEnvValue = (value) => {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
};

const isAbsoluteUrl = (value) => typeof value === 'string' && (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value) || value.startsWith('//'));

const ensureLeadingSlash = (value) => {
  if (!value) {
    return '/';
  }
  return value.startsWith('/') ? value : `/${value}`;
};

const trimTrailingSlashes = (value) => value.replace(/\/+$/, '');

const collapseSlashes = (value) => value.replace(/\/{2,}/g, '/');

const removeApiSuffix = (path) => (path.endsWith('/api') ? path.slice(0, -4) : path);

const deriveRelativePath = (pathname, { defaultPath = DEFAULT_API_BASE } = {}) => {
  const trimmed = trimTrailingSlashes(pathname || '');
  if (!trimmed) {
    return defaultPath;
  }

  const normalized = ensureLeadingSlash(trimmed);
  return normalized === '/' ? '' : normalized;
};

const shouldFallbackToSameOrigin = (hostname) => {
  if (typeof window === 'undefined') {
    return false;
  }

  if (!hostname) {
    return false;
  }

  const browserHostname = window?.location?.hostname;
  if (!browserHostname || hostname === browserHostname) {
    return false;
  }

  if (hostname === 'localhost') {
    return false;
  }

  if (hostname.includes('.')) {
    return false;
  }

  return true;
};

const buildSocketPathFromBase = (basePath) => {
  if (!basePath) {
    return DEFAULT_SOCKET_PATH;
  }

  const trimmed = trimTrailingSlashes(removeApiSuffix(basePath));
  if (!trimmed || trimmed === '/') {
    return DEFAULT_SOCKET_PATH;
  }

  const normalized = ensureLeadingSlash(trimmed);
  return collapseSlashes(`${normalized}/socket.io`);
};

const sanitizeSocketPath = (path) => {
  if (!path) {
    return DEFAULT_SOCKET_PATH;
  }

  const trimmed = trimTrailingSlashes(path);
  if (!trimmed) {
    return DEFAULT_SOCKET_PATH;
  }

  const normalized = ensureLeadingSlash(trimmed);
  return normalized === '/' ? DEFAULT_SOCKET_PATH : collapseSlashes(normalized);
};

export const normalizeApiBase = (rawApiBase = process.env.REACT_APP_API_BASE_URL) => {
  const baseUrl = getEnvValue(rawApiBase);

  if (!baseUrl) {
    return DEFAULT_API_BASE;
  }

  if (isAbsoluteUrl(baseUrl)) {
    const normalized = baseUrl.startsWith('//') ? `http:${baseUrl}` : baseUrl;

    try {
      const parsed = new URL(normalized);

      if (shouldFallbackToSameOrigin(parsed.hostname)) {
        return trimTrailingSlashes(deriveRelativePath(parsed.pathname, { defaultPath: DEFAULT_API_BASE }));
      }

      const combinedPath = trimTrailingSlashes(parsed.pathname || '');
      if (!combinedPath) {
        return trimTrailingSlashes(parsed.origin);
      }

      return `${parsed.origin}${combinedPath.startsWith('/') ? combinedPath : `/${combinedPath}`}`;
    } catch (error) {
      console.warn('Failed to parse REACT_APP_API_BASE_URL. Falling back to default API base.', error);
      return DEFAULT_API_BASE;
    }
  }

  const normalizedRelative = trimTrailingSlashes(ensureLeadingSlash(baseUrl));
  return normalizedRelative === '/' ? '' : normalizedRelative;
};

export const API_BASE = normalizeApiBase().replace(/\/$/, '');

const resolveFromWsUrl = (rawWsUrl) => {
  const wsUrl = getEnvValue(rawWsUrl);
  if (!wsUrl) {
    return null;
  }

  if (isAbsoluteUrl(wsUrl)) {
    const normalized = wsUrl.startsWith('//') ? `http:${wsUrl}` : wsUrl;

    try {
      const parsed = new URL(normalized);
      const path = sanitizeSocketPath(parsed.pathname);

      if (shouldFallbackToSameOrigin(parsed.hostname)) {
        return { url: null, options: { path } };
      }

      return { url: parsed.origin, options: { path } };
    } catch (error) {
      console.warn('Failed to parse REACT_APP_WS_URL. Falling back to same-origin socket path.', error);
      return { url: null, options: { path: sanitizeSocketPath(wsUrl) } };
    }
  }

  return { url: null, options: { path: sanitizeSocketPath(wsUrl) } };
};

const resolveFromApiBase = (rawApiBase) => {
  const normalizedBase = normalizeApiBase(rawApiBase);

  if (!normalizedBase) {
    return { url: null, options: { path: DEFAULT_SOCKET_PATH } };
  }

  if (isAbsoluteUrl(normalizedBase)) {
    const normalized = normalizedBase.startsWith('//') ? `http:${normalizedBase}` : normalizedBase;

    try {
      const parsed = new URL(normalized);
      const path = buildSocketPathFromBase(parsed.pathname || '');

      if (typeof window !== 'undefined' && window?.location?.origin === parsed.origin) {
        return { url: null, options: { path } };
      }

      return { url: parsed.origin, options: { path } };
    } catch (error) {
      console.warn('Failed to parse API base URL while resolving Socket.IO path. Falling back to default socket path.', error);
      return { url: null, options: { path: DEFAULT_SOCKET_PATH } };
    }
  }

  const relativePath = normalizedBase.startsWith('/') ? normalizedBase : `/${normalizedBase}`;
  return { url: null, options: { path: buildSocketPathFromBase(relativePath) } };
};

export const resolveSocketOptions = ({
  apiBase = API_BASE,
  wsUrl = process.env.REACT_APP_WS_URL
} = {}) => {
  const explicitWs = resolveFromWsUrl(wsUrl);
  if (explicitWs) {
    return explicitWs;
  }

  const inferredFromApi = resolveFromApiBase(apiBase);
  if (inferredFromApi) {
    return inferredFromApi;
  }

  return { url: null, options: { path: DEFAULT_SOCKET_PATH } };
};

export const SOCKET_OPTIONS = resolveSocketOptions();

export {
  DEFAULT_API_BASE,
  DEFAULT_SOCKET_PATH,
  buildSocketPathFromBase,
  sanitizeSocketPath,
  shouldFallbackToSameOrigin
};
