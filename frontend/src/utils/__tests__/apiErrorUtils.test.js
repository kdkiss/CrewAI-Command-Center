import { getApiErrorMessage, isLikelyNetworkError } from '../apiErrorUtils';

describe('isLikelyNetworkError', () => {
  it('treats 502 responses as network errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 502',
      response: { status: 502 },
    };

    expect(isLikelyNetworkError(error)).toBe(true);
  });

  it('does not treat generic 500 responses as network errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 500',
      response: { status: 500 },
    };

    expect(isLikelyNetworkError(error)).toBe(false);
  });
});

describe('getApiErrorMessage', () => {
  it('suggests checking the backend connection for 502 errors', () => {
    const error = {
      isAxiosError: true,
      message: 'Request failed with status code 502',
      config: { url: '/system/stats' },
      response: {
        status: 502,
        data: {},
      },
    };

    const message = getApiErrorMessage(error, {
      apiBase: 'http://backend:8001/api',
      defaultMessage: 'Request failed. Please try again.',
    });

    expect(message).toContain('Unable to reach the backend service at http://backend:8001/api/system/stats');
  });
});
