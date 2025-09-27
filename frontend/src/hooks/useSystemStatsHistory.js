import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import { API_BASE } from '../config/apiConfig';

const HISTORY_ENDPOINT = `${API_BASE}/system/stats/history`;
const DEFAULT_WINDOW = '1h';
const KNOWN_WINDOWS = ['1h', '24h'];

const isAxiosAbortError = (error) =>
  axios.isCancel?.(error) || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED';

const parseTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};

const parseNumeric = (value) => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeHistoryPayload = (payload, fallbackWindow = DEFAULT_WINDOW) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const rawWindow = typeof payload.window === 'string' ? payload.window : fallbackWindow;
  const window = KNOWN_WINDOWS.includes(rawWindow) ? rawWindow : fallbackWindow;

  const availableWindows = Array.isArray(payload.available_windows)
    ? payload.available_windows
    : Array.isArray(payload.availableWindows)
      ? payload.availableWindows
      : KNOWN_WINDOWS;

  const metricsSource = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {};
  const datasets = {};
  let sampleCount = 0;

  Object.entries(metricsSource).forEach(([metricKey, samples]) => {
    if (!Array.isArray(samples)) {
      return;
    }

    const normalizedSamples = samples
      .map((sample) => {
        const timestamp = parseTimestamp(sample?.timestamp ?? sample?.time ?? sample?.[0]);
        const value = parseNumeric(sample?.value ?? sample?.[1]);

        if (!timestamp || value == null) {
          return null;
        }

        return { timestamp, value };
      })
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (normalizedSamples.length > 0) {
      datasets[metricKey] = normalizedSamples;
      sampleCount += normalizedSamples.length;
    }
  });

  const oldestTimestamp = parseTimestamp(payload.oldest_timestamp);
  const newestTimestamp = parseTimestamp(payload.newest_timestamp);

  return {
    window,
    availableWindows,
    datasets,
    sampleCount,
    oldestTimestamp,
    newestTimestamp,
    status: payload.status || null
  };
};

const defaultOptions = {
  window: DEFAULT_WINDOW,
  enabled: true,
  initialData: null
};

export const useSystemStatsHistory = (options = {}) => {
  const { window: initialWindow, enabled, initialData } = { ...defaultOptions, ...options };
  const [selectedWindow, setSelectedWindow] = useState(
    KNOWN_WINDOWS.includes(initialWindow) ? initialWindow : DEFAULT_WINDOW
  );
  const [history, setHistory] = useState(() =>
    initialData ? normalizeHistoryPayload(initialData, initialWindow) : null
  );
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(enabled) && !history);
  const [lastUpdated, setLastUpdated] = useState(null);

  const abortControllerRef = useRef(null);
  const historyRef = useRef(history);
  historyRef.current = history;

  const fetchHistory = useCallback(
    async ({
      window: overrideWindow,
      skipLoadingState = false
    } = {}) => {
      if (!enabled) {
        return null;
      }

      const targetWindow = overrideWindow || selectedWindow || DEFAULT_WINDOW;

      if (!skipLoadingState) {
        setIsLoading(true);
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const { data } = await axios.get(HISTORY_ENDPOINT, {
          params: { window: targetWindow },
          signal: controller.signal
        });

        const normalized = normalizeHistoryPayload(data, targetWindow) ?? null;
        setHistory(normalized);
        setError(null);
        setLastUpdated(new Date());
        return normalized;
      } catch (err) {
        if (controller.signal.aborted || isAxiosAbortError(err)) {
          return null;
        }

        const detail = err?.response?.data?.detail;
        const message = detail || err?.message || 'Failed to load system history';
        setError(new Error(message));
        return null;
      } finally {
        if (!skipLoadingState) {
          setIsLoading(false);
        }
      }
    },
    [enabled, selectedWindow]
  );

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      abortControllerRef.current?.abort();
      return undefined;
    }

    const skipLoadingState = Boolean(historyRef.current) && historyRef.current.window === selectedWindow;
    fetchHistory({ window: selectedWindow, skipLoadingState }).catch(() => {});

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [enabled, selectedWindow, fetchHistory]);

  useEffect(() => {
    if (!initialData) {
      return;
    }

    const normalized = normalizeHistoryPayload(initialData, selectedWindow);
    setHistory(normalized);
    setError(null);
  }, [initialData, selectedWindow]);

  const availableWindows = history?.availableWindows || KNOWN_WINDOWS;

  const hasData = useMemo(
    () => Boolean(history) && Object.values(history.datasets || {}).some(samples => samples.length > 0),
    [history]
  );

  return {
    history,
    datasets: history?.datasets || {},
    availableWindows,
    window: selectedWindow,
    setWindow: setSelectedWindow,
    hasData,
    sampleCount: history?.sampleCount ?? 0,
    isLoading,
    lastUpdated,
    error,
    refresh: () => fetchHistory({ window: selectedWindow }),
    setError
  };
};

export default useSystemStatsHistory;
