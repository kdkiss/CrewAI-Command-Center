import React, { useMemo } from 'react';
import {
  Activity,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Cpu,
  MemoryStick,
  Clock
} from 'lucide-react';
import useSystemStatsHistory from '../../../hooks/useSystemStatsHistory';

const clampPercentage = (value) => {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value)));
};

const formatUptime = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) {
    return 'Unavailable';
  }

  const totalSeconds = Math.max(0, Number(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(' ');
};

const formatLastUpdated = (date) => {
  if (!date) {
    return 'Never';
  }

  const now = Date.now();
  const diffSeconds = Math.round((now - date.getTime()) / 1000);

  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return date.toLocaleString();
};

const formatLatencyValue = (value) => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  const numericValue = Number(value);
  if (numericValue >= 1000) {
    const seconds = numericValue / 1000;
    return seconds >= 10 ? `${seconds.toFixed(1)} s` : `${seconds.toFixed(2)} s`;
  }

  if (numericValue >= 100) {
    return `${Math.round(numericValue)} ms`;
  }

  if (numericValue >= 10) {
    return `${numericValue.toFixed(1)} ms`;
  }

  return `${numericValue.toFixed(2)} ms`;
};

const describeWindowShort = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.max(1, Math.round(seconds))}s`;
  }

  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes}m`;
  }

  const hours = seconds / 3600;
  return `${hours >= 10 ? Math.round(hours) : hours.toFixed(1)}h`;
};

const describeWindowPhrase = (seconds) => {
  if (seconds == null || Number.isNaN(seconds)) {
    return 'the rolling observation window';
  }

  if (seconds < 60) {
    const value = Math.max(1, Math.round(seconds));
    return `the last ${value} second${value === 1 ? '' : 's'}`;
  }

  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `the last ${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `the last ${hours} hour${hours === 1 ? '' : 's'}`;
};

const ServiceStatusCard = ({ statusLabel, healthy, latencyStats, errorStats }) => {
  const windowSeconds = errorStats.windowSeconds ?? latencyStats.windowSeconds ?? null;
  const windowDescription = windowSeconds ? `Rolling ${describeWindowShort(windowSeconds)} window` : 'Rolling metrics window';
  const sampleLabel =
    typeof latencyStats.sampleSize === 'number' && latencyStats.sampleSize > 0
      ? `${latencyStats.sampleSize} sampled request${latencyStats.sampleSize === 1 ? '' : 's'}`
      : 'Awaiting metrics';

  const latencyTooltip = `Average FastAPI response time calculated across requests from ${describeWindowPhrase(windowSeconds)}.`;
  const p95Tooltip = `95th percentile response time for API requests observed during ${describeWindowPhrase(windowSeconds)}.`;
  const errorTooltip = `Percentage of API requests that returned 4xx or 5xx responses during ${describeWindowPhrase(windowSeconds)}.`;

  const errorHighlight = typeof errorStats.ratio === 'number' && errorStats.ratio >= 0.05;
  const errorRateValue =
    errorStats.percent == null || Number.isNaN(errorStats.percent)
      ? '—'
      : `${errorStats.percent.toFixed(errorStats.percent >= 10 ? 1 : 2)}%`;
  const hasRequestCounts = typeof errorStats.requests === 'number' && errorStats.requests > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-white p-2 text-blue-600 shadow-sm dark:bg-slate-950">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Service Status</p>
          <p className={`text-xl font-semibold ${healthy ? 'text-green-600' : 'text-red-600'}`}>{statusLabel}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{windowDescription}</p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between" title={latencyTooltip}>
          <span className="text-gray-500 dark:text-gray-400">Avg Latency</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{formatLatencyValue(latencyStats.averageMs)}</span>
        </div>
        {latencyStats.p95Ms != null && !Number.isNaN(latencyStats.p95Ms) && (
          <div className="flex items-center justify-between" title={p95Tooltip}>
            <span className="text-gray-500 dark:text-gray-400">p95 Latency</span>
            <span className="text-gray-900 dark:text-gray-100">{formatLatencyValue(latencyStats.p95Ms)}</span>
          </div>
        )}
        <div className="flex items-center justify-between" title={errorTooltip}>
          <span className="text-gray-500 dark:text-gray-400">Error Rate</span>
          <span className={errorHighlight ? 'font-semibold text-red-600' : 'font-medium text-gray-900 dark:text-gray-100'}>{errorRateValue}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Samples</span>
          <span>
            {hasRequestCounts
              ? `${Math.round(errorStats.requests)} req · ${errorStats.errors ?? 0} error${errorStats.errors === 1 ? '' : 's'}`
              : sampleLabel}
          </span>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sublabel, progress, progressColor = 'bg-blue-500' }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-white p-2 text-blue-600 shadow-sm dark:bg-slate-950">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      </div>
    </div>
    {sublabel && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{sublabel}</p>}
    {typeof progress === 'number' && !Number.isNaN(progress) && (
      <div className="mt-3 h-2 rounded-full bg-white dark:bg-slate-950">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${progressColor}`}
          style={{ width: `${clampPercentage(progress)}%` }}
        />
      </div>
    )}
  </div>
);

const METRIC_CONFIG = {
  'cpu.usage': {
    label: 'CPU Usage',
    color: '#2563eb',
    unit: '%'
  },
  'memory.percent': {
    label: 'Memory Usage',
    color: '#059669',
    unit: '%'
  }
};

const sanitizeMetricKey = (metricKey) => metricKey.replace(/[^a-zA-Z0-9]+/g, '_');

const formatWindowLabel = (windowKey) => {
  switch (windowKey) {
    case '24h':
      return '24 Hours';
    case '1h':
      return '1 Hour';
    default:
      return windowKey;
  }
};

const formatTickLabel = (timestampMs, windowKey) => {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timeOptions = { hour: '2-digit', minute: '2-digit' };
  if (windowKey === '24h') {
    return date.toLocaleTimeString([], timeOptions);
  }

  return date.toLocaleTimeString([], timeOptions);
};

const formatTooltipLabel = (timestampMs) => {
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
};

const SimpleLineChart = ({ data, series, historyWindow, className }) => {
  const hasSeries = Array.isArray(series) && series.length > 0;
  const hasData = Array.isArray(data) && data.length > 0;

  const width = 800;
  const height = 240;
  const margin = { top: 16, right: 24, bottom: 32, left: 48 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const allTimestamps = hasData
    ? data
        .map(point => (typeof point.timestampMs === 'number' ? point.timestampMs : null))
        .filter(timestamp => timestamp != null && !Number.isNaN(timestamp))
    : [];

  if (!hasSeries || !allTimestamps.length) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className ?? 'h-full w-full'} role="img" aria-label="Historical metrics chart">
        <rect x="0" y="0" width={width} height={height} fill="#f9fafb" />
        <text x="50%" y="50%" textAnchor="middle" fill="#9ca3af" fontSize="14">
          Historical data unavailable
        </text>
      </svg>
    );
  }

  const xMin = Math.min(...allTimestamps);
  const xMax = Math.max(...allTimestamps);
  const xRange = xMax - xMin || 1;
  const xScale = (value) => margin.left + ((value - xMin) / xRange) * innerWidth;

  const numericValues = [];
  data.forEach(point => {
    series.forEach(({ dataKey }) => {
      const value = point[dataKey];
      if (typeof value === 'number' && !Number.isNaN(value)) {
        numericValues.push(value);
      }
    });
  });

  const maxObserved = numericValues.length ? Math.max(...numericValues) : 100;
  const yMax = Math.max(100, Math.ceil(maxObserved / 10) * 10);
  const yMin = 0;
  const yRange = yMax - yMin || 1;
  const yScale = (value) => margin.top + innerHeight - ((value - yMin) / yRange) * innerHeight;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, index) => (yMax / yTickCount) * index);

  const uniqueTimes = Array.from(new Set(allTimestamps)).sort((a, b) => a - b);
  const desiredXTicks = Math.min(5, uniqueTimes.length);
  const xTicks = [];
  if (desiredXTicks <= 1) {
    xTicks.push(uniqueTimes[0]);
  } else {
    const step = (uniqueTimes.length - 1) / (desiredXTicks - 1);
    for (let index = 0; index < desiredXTicks; index += 1) {
      const tickIndex = Math.round(index * step);
      xTicks.push(uniqueTimes[tickIndex]);
    }
  }

  const describedSeries = series.map(item => item.label).join(' and ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className ?? 'h-full w-full'}
      role="img"
      aria-label={`Historical metrics chart for ${describedSeries || 'system performance'}`}
    >
      <rect x="0" y="0" width={width} height={height} fill="#f9fafb" />
      <desc>{`Line chart showing ${describedSeries || 'system performance metrics'} over time.`}</desc>
      <rect
        x={margin.left}
        y={margin.top}
        width={innerWidth}
        height={innerHeight}
        fill="#ffffff"
        stroke="#e5e7eb"
      />
      {yTicks.map(tickValue => {
        const yPosition = yScale(tickValue);
        return (
          <g key={`y-${tickValue}`}>
            <line
              x1={margin.left}
              x2={margin.left + innerWidth}
              y1={yPosition}
              y2={yPosition}
              stroke="#e5e7eb"
              strokeDasharray="4 4"
            />
            <text
              x={margin.left - 8}
              y={yPosition + 4}
              textAnchor="end"
              fill="#6b7280"
              fontSize="12"
            >
              {`${Math.round(tickValue)}%`}
            </text>
          </g>
        );
      })}
      <line
        x1={margin.left}
        x2={margin.left + innerWidth}
        y1={margin.top + innerHeight}
        y2={margin.top + innerHeight}
        stroke="#d1d5db"
      />
      {xTicks.map(tickValue => {
        const xPosition = xScale(tickValue);
        return (
          <g key={`x-${tickValue}`}>
            <line
              x1={xPosition}
              x2={xPosition}
              y1={margin.top}
              y2={margin.top + innerHeight}
              stroke="#f3f4f6"
            />
            <text
              x={xPosition}
              y={margin.top + innerHeight + 20}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="12"
            >
              {formatTickLabel(tickValue, historyWindow)}
            </text>
          </g>
        );
      })}
      {series.map(({ metricKey, dataKey, color, label }) => {
        const points = data
          .map(point => {
            const value = point[dataKey];
            if (typeof value !== 'number' || Number.isNaN(value)) {
              return null;
            }
            return {
              timestampMs: point.timestampMs,
              value
            };
          })
          .filter(Boolean);

        if (!points.length) {
          return null;
        }

        const pathData = points
          .map((point, index) => {
            const x = xScale(point.timestampMs);
            const y = yScale(point.value);
            return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ');

        return (
          <g key={metricKey}>
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map(point => {
              const cx = xScale(point.timestampMs);
              const cy = yScale(point.value);
              return (
                <circle key={`${metricKey}-${point.timestampMs}`} cx={cx} cy={cy} r={3} fill="#ffffff" stroke={color} strokeWidth={1.5}>
                  <title>{`${label}: ${Math.round(point.value)}% · ${formatTooltipLabel(point.timestampMs)}`}</title>
                </circle>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
};

const SystemStatsPanel = ({ stats, isLoading, error, onRefresh, lastUpdated }) => {
  const status = error ? 'error' : stats?.status || 'unknown';
  const healthy = status === 'success' || status === 'healthy';
  const statusClasses = healthy
    ? 'border-green-200 bg-green-50 text-green-700'
    : status === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-yellow-200 bg-yellow-50 text-yellow-700';

  const statusLabel = error
    ? 'Error'
    : status === 'success'
      ? 'Healthy'
      : status === 'error'
        ? 'Error'
        : status.charAt(0).toUpperCase() + status.slice(1);

  const cpuUsage = stats?.cpu?.usage;
  const memoryPercent = stats?.memory?.percent;
  const memoryUsed = stats?.memory?.used;
  const memoryTotal = stats?.memory?.total;
  const uptime = stats?.uptime;

  const {
    datasets,
    availableWindows,
    window: historyWindow,
    setWindow: setHistoryWindow,
    hasData: hasHistoryData,
    isLoading: historyLoading,
    error: historyError,
    refresh: refreshHistory
  } = useSystemStatsHistory({ initialData: stats?.history });

  const refreshInProgress = isLoading || historyLoading;

  const chartSeries = useMemo(() => {
    return Object.entries(METRIC_CONFIG)
      .map(([metricKey, config]) => {
        const samples = datasets?.[metricKey];
        if (!samples || samples.length === 0) {
          return null;
        }

        return {
          metricKey,
          dataKey: sanitizeMetricKey(metricKey),
          label: config.label,
          color: config.color,
          unit: config.unit
        };
      })
      .filter(Boolean);
  }, [datasets]);

  const chartData = useMemo(() => {
    if (!chartSeries.length) {
      return [];
    }

    const points = new Map();

    chartSeries.forEach(({ metricKey, dataKey }) => {
      const samples = datasets?.[metricKey] || [];
      samples.forEach(({ timestamp, value }) => {
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
          return;
        }

        const time = date.getTime();
        const existing = points.get(time) || { timestamp: date, timestampMs: time };
        existing[dataKey] = value;
        points.set(time, existing);
      });
    });

    return Array.from(points.values()).sort((a, b) => a.timestampMs - b.timestampMs);
  }, [chartSeries, datasets]);

  const showChart = hasHistoryData && chartSeries.length > 0 && chartData.length > 0;

  const handleRefresh = () => {
    onRefresh?.();
    refreshHistory?.();
  };

  const handleWindowChange = (windowKey) => {
    if (!windowKey || windowKey === historyWindow) {
      return;
    }
    setHistoryWindow(windowKey);
  };

  const latencyStats = (() => {
    const rawLatency = stats?.latency;
    const normalized = {
      averageMs: null,
      p95Ms: null,
      sampleSize: null,
      windowSeconds: null
    };

    if (rawLatency == null) {
      return normalized;
    }

    if (typeof rawLatency === 'number') {
      normalized.averageMs = rawLatency;
      return normalized;
    }

    if (typeof rawLatency === 'object') {
      normalized.averageMs =
        rawLatency.averageMs ?? rawLatency.avgMs ?? rawLatency.avg ?? rawLatency.meanMs ?? rawLatency.mean ?? null;
      normalized.p95Ms = rawLatency.p95Ms ?? rawLatency.p95 ?? null;
      normalized.sampleSize = rawLatency.sampleSize ?? rawLatency.samples ?? rawLatency.count ?? null;
      normalized.windowSeconds = rawLatency.windowSeconds ?? rawLatency.window ?? null;
    }

    return normalized;
  })();

  const errorStats = (() => {
    const rawErrorRate = stats?.errorRate ?? stats?.error_rate;
    const normalized = {
      ratio: null,
      percent: null,
      errors: null,
      requests: null,
      windowSeconds: latencyStats.windowSeconds
    };

    if (rawErrorRate == null) {
      return normalized;
    }

    if (typeof rawErrorRate === 'number') {
      normalized.ratio = rawErrorRate;
    } else if (typeof rawErrorRate === 'object') {
      normalized.ratio =
        rawErrorRate.ratio ??
        (typeof rawErrorRate.percent === 'number' ? rawErrorRate.percent / 100 : null) ??
        rawErrorRate.rate ?? null;
      normalized.errors = rawErrorRate.errors ?? rawErrorRate.errorCount ?? rawErrorRate.failures ?? null;
      normalized.requests = rawErrorRate.requests ?? rawErrorRate.total ?? rawErrorRate.requestsCount ?? null;
      normalized.windowSeconds = rawErrorRate.windowSeconds ?? rawErrorRate.window ?? normalized.windowSeconds;
    }

    if (normalized.ratio != null) {
      normalized.percent = normalized.ratio * 100;
    }

    if (normalized.requests == null && latencyStats.sampleSize != null) {
      normalized.requests = latencyStats.sampleSize;
    }

    if (normalized.errors == null && normalized.requests != null && normalized.ratio != null) {
      normalized.errors = Math.round(normalized.requests * normalized.ratio);
    }

    if (typeof normalized.errors === 'number') {
      normalized.errors = Math.max(0, Math.round(normalized.errors));
    }

    if (typeof normalized.requests === 'number') {
      normalized.requests = Math.max(0, Math.round(normalized.requests));
    }

    return normalized;
  })();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xl font-heading font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
            <Activity className="h-5 w-5 text-blue-600" />
            System Monitor
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Real-time CPU, memory, uptime, and service status</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${statusClasses}`}>
            <ShieldCheck className="h-4 w-4" />
            {statusLabel}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock className="h-3 w-3" />
            Updated {formatLastUpdated(lastUpdated)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshInProgress}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            refreshInProgress
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:border-blue-400 dark:hover:bg-blue-500/20'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${refreshInProgress ? 'animate-spin' : ''}`} />
          {refreshInProgress ? 'Refreshing...' : 'Refresh Now'}
        </button>
        {stats?.os && (
          <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300">
            {stats.os}
          </span>
        )}
        {stats?.python_version && (
          <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300">
            Python {stats.python_version}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Unable to load system statistics</p>
            <p className="text-xs text-red-600 dark:text-red-300">{error.message}</p>
          </div>
        </div>
      )}

      {historyError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Historical data unavailable</p>
            <p className="text-xs text-amber-700 dark:text-amber-200">{historyError.message}</p>
          </div>
        </div>
      )}

      {showChart ? (
        <div className="mt-6">
          <figure aria-labelledby="system-history-heading">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3
                  id="system-history-heading"
                  className="text-lg font-heading font-semibold text-gray-900 dark:text-gray-100 sm:text-xl"
                >
                  Resource Usage History
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  View CPU and memory utilisation trends over the last {formatWindowLabel(historyWindow).toLowerCase()}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {availableWindows.map((windowKey) => {
                  const active = windowKey === historyWindow;
                  return (
                    <button
                      key={windowKey}
                      type="button"
                      onClick={() => handleWindowChange(windowKey)}
                      disabled={historyLoading && active}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white shadow dark:border-blue-400 dark:bg-blue-500'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:bg-blue-500/20 dark:hover:text-blue-200'
                      } ${historyLoading && active ? 'opacity-75' : ''}`}
                    >
                      {formatWindowLabel(windowKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 h-72 w-full rounded-lg border border-gray-100 bg-white p-4 transition-colors dark:border-slate-800 dark:bg-slate-950">
              <SimpleLineChart
                data={chartData}
                series={chartSeries}
                historyWindow={historyWindow}
                className="h-full w-full"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                {chartSeries.map(series => (
                  <div key={series.metricKey} className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: series.color }}
                      aria-hidden="true"
                    />
                    <span>{series.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <figcaption className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {historyLoading
                ? 'Loading historical metrics…'
                : `Displaying ${chartSeries.map((series) => series.label).join(' and ')} over the past ${formatWindowLabel(historyWindow).toLowerCase()}.`}
            </figcaption>
          </figure>
        </div>
      ) : (
        historyLoading && (
          <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-200">
            Loading historical metrics…
          </div>
        )
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Cpu}
          label="CPU Usage"
          value={cpuUsage != null ? `${cpuUsage}%` : '—'}
          sublabel={stats?.cpu ? `${stats.cpu.cores} cores · ${stats.cpu.frequency}` : 'Awaiting metrics'}
          progress={cpuUsage}
          progressColor="bg-blue-500"
        />
        <StatCard
          icon={MemoryStick}
          label="Memory Usage"
          value={memoryPercent != null ? `${memoryPercent}%` : '—'}
          sublabel={memoryUsed != null && memoryTotal != null ? `${memoryUsed} GB / ${memoryTotal} GB used` : 'Awaiting metrics'}
          progress={memoryPercent}
          progressColor="bg-emerald-500"
        />
        <StatCard
          icon={Clock}
          label="System Uptime"
          value={formatUptime(uptime)}
          sublabel={stats?.boot_time ? `Since ${new Date(stats.boot_time).toLocaleString()}` : 'Boot time unavailable'}
        />
        <ServiceStatusCard
          statusLabel={statusLabel}
          healthy={healthy}
          latencyStats={latencyStats}
          errorStats={errorStats}
        />
      </div>
    </div>
  );
};

export default SystemStatsPanel;
