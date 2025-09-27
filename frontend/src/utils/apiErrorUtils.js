const trimSlashes = (value) => value.replace(/\/+$/, '');
const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);
const collapseSlashes = (value) => value.replace(/\/{2,}/g, '/');
const isAbsoluteUrl = (value) => /^([a-z][a-z\d+\-.]*:)?\/\//i.test(value);

const joinUrlSegments = (base, path) => {
  const normalizedBase = base ? trimSlashes(base) : '';
  if (!path) {
    return normalizedBase || null;
  }

  if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
    return path;
  }

  const normalizedPath = ensureLeadingSlash(path);

  if (isAbsoluteUrl(normalizedBase)) {
    const absoluteBase = normalizedBase.startsWith('//') ? `http:${normalizedBase}` : normalizedBase;
    try {
      const parsed = new URL(absoluteBase);
      const basePath = trimSlashes(parsed.pathname || '');
      if (basePath && normalizedPath.startsWith(basePath)) {
        return `${parsed.origin}${normalizedPath}`;
      }

      const combinedPath = collapseSlashes(`${basePath}${normalizedPath}`);
      return `${parsed.origin}${combinedPath}`;
    } catch (error) {
      return `${normalizedBase}${normalizedPath}`;
    }
  }

  if (normalizedBase) {
    if (normalizedBase.startsWith('/')) {
      if (
        normalizedPath.startsWith(`${normalizedBase}/`) ||
        normalizedPath === normalizedBase
      ) {
        return normalizedPath;
      }

      return collapseSlashes(`${normalizedBase}${normalizedPath}`);
    }

    return `${normalizedBase}${normalizedPath}`;
  }

  if (typeof window !== 'undefined' && window?.location?.origin) {
    const origin = trimSlashes(window.location.origin);
    return `${origin}${normalizedPath}`;
  }

  return path;
};

export const inferApiEndpoint = (error, apiBase) => {
  const config = error?.config || {};
  const baseURL = apiBase || config.baseURL || '';
  const url = config.url;

  if (url) {
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) {
      return url;
    }

    return joinUrlSegments(baseURL, url);
  }

  if (baseURL) {
    return trimSlashes(baseURL);
  }

  return null;
};

export const isLikelyNetworkError = (error) => {
  if (!error) {
    return false;
  }

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return true;
  }

  const status = error.response?.status;
  if (status && [502, 503, 504].includes(Number(status))) {
    return true;
  }

  if (error.response) {
    return false;
  }

  if (error.isAxiosError && error.request) {
    return true;
  }

  if (error.request && typeof window !== 'undefined') {
    return true;
  }

  return false;
};

export const getApiErrorMessage = (error, { defaultMessage = 'Request failed. Please try again.', apiBase } = {}) => {
  const fallback = defaultMessage || 'Request failed. Please try again.';

  if (!error) {
    return fallback;
  }

  const responseData = error.response?.data;
  const detail =
    (responseData && (responseData.detail || responseData.message)) ||
    error.message;

  if (detail && !isLikelyNetworkError(error)) {
    return detail;
  }

  if (isLikelyNetworkError(error)) {
    const endpoint = inferApiEndpoint(error, apiBase);
    const connectionMessage = endpoint
      ? `Unable to reach the backend service at ${endpoint}. Please make sure it is running and accessible from your browser.`
      : 'Unable to reach the backend service. Please make sure it is running and accessible from your browser.';

    return fallback ? `${fallback} ${connectionMessage}`.trim() : connectionMessage;
  }

  if (detail) {
    return detail;
  }

  return fallback;
};
