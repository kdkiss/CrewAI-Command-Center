import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { getApiErrorMessage } from '../utils/apiErrorUtils';
import { API_BASE } from '../config/apiConfig';

const API_ENDPOINT = `${API_BASE}/system/stats`;

const isAxiosAbortError = (error) =>
  axios.isCancel?.(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';

const defaultOptions = {
  pollingInterval: 5000,
  enabled: true,
  socket: null,
  socketEvent: 'system_stats'
};

export const useSystemStats = (options = {}) => {
  const { pollingInterval, enabled, socket, socketEvent } = { ...defaultOptions, ...options };
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled));
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortControllerRef = useRef(null);

  const handleSuccess = useCallback((payload) => {
    if (!payload) {
      return;
    }

    const status = payload.status || 'success';
    if (status === 'error') {
      setError(new Error(payload.message || 'Unable to load system statistics'));
    } else {
      setError(null);
    }

    const normalizedPayload = {
      ...payload,
      latency:
        payload && Object.prototype.hasOwnProperty.call(payload, 'latency')
          ? payload.latency
          : null,
      errorRate:
        payload && Object.prototype.hasOwnProperty.call(payload, 'errorRate')
          ? payload.errorRate
          : payload?.error_rate ?? null
    };

    setStats(normalizedPayload);
    setLastUpdated(new Date());
  }, []);

  const fetchStats = useCallback(
    async ({ skipLoadingState = false } = {}) => {
      if (!enabled) {
        return;
      }

      if (!skipLoadingState) {
        setIsLoading(true);
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data } = await axios.get(API_ENDPOINT, { signal: controller.signal });
        handleSuccess(data);
      } catch (err) {
        if (isAxiosAbortError(err) || controller.signal.aborted) {
          return;
        }

        const errorMessage = getApiErrorMessage(err, {
          defaultMessage: 'Failed to fetch system statistics.',
          apiBase: API_BASE
        });
        setError(new Error(errorMessage));
      } finally {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [enabled, handleSuccess]
  );

  useEffect(() => {
    if (enabled) {
      fetchStats();
    } else {
      setIsLoading(false);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, fetchStats]);

  useEffect(() => {
    if (!enabled || !pollingInterval) {
      return undefined;
    }

    const id = setInterval(() => {
      fetchStats({ skipLoadingState: true });
    }, pollingInterval);

    return () => {
      clearInterval(id);
    };
  }, [enabled, pollingInterval, fetchStats]);

  useEffect(() => {
    if (!socket || !socketEvent) {
      return undefined;
    }

    const handleSocketUpdate = (payload) => {
      handleSuccess(payload);
    };

    socket.on(socketEvent, handleSocketUpdate);
    return () => {
      socket.off(socketEvent, handleSocketUpdate);
    };
  }, [socket, socketEvent, handleSuccess]);

  return {
    stats,
    error,
    isLoading,
    lastUpdated,
    refresh: () => fetchStats({ skipLoadingState: false })
  };
};

export default useSystemStats;
