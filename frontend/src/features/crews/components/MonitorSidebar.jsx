import React, { useMemo } from 'react';
import { Activity, Clock } from 'lucide-react';

const normalizeRunningIds = (value) => {
  if (!value) {
    return [];
  }

  if (value instanceof Set) {
    return Array.from(value, item => String(item));
  }

  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, isActive]) => Boolean(isActive))
      .map(([key]) => String(key));
  }

  return [];
};

const getLatestLog = (logs = []) => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return null;
  }

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const candidate = logs[index];
    if (candidate?.message) {
      return candidate;
    }
  }

  return logs[logs.length - 1];
};

const formatTimestamp = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date?.getTime?.())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    return date.toISOString();
  }
};

const MonitorSidebar = ({ runningCrews, crewLogs, crews }) => {
  const runningIds = useMemo(() => normalizeRunningIds(runningCrews), [runningCrews]);
  const runningCount = runningIds.length;

  const crewNames = useMemo(() => (
    runningIds
      .map((crewId) => {
        const crew = crews.find(item => String(item?.id ?? '') === crewId);
        return crew?.name || crewId;
      })
      .filter(Boolean)
  ), [crews, runningIds]);

  const latestActivity = useMemo(() => {
    const entries = runningIds.map((crewId) => {
      const logs = crewLogs?.[crewId] || [];
      const latestLog = getLatestLog(logs);
      return { crewId, log: latestLog };
    });

    entries.sort((a, b) => {
      const timeA = a.log?.timestamp ? new Date(a.log.timestamp).getTime() : 0;
      const timeB = b.log?.timestamp ? new Date(b.log.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return entries.length > 0 ? entries[0] : null;
  }, [crewLogs, runningIds]);

  const latestCrewName = latestActivity
    ? (crews.find(item => String(item?.id ?? '') === latestActivity.crewId)?.name || latestActivity.crewId)
    : null;

  const latestTimestamp = latestActivity?.log?.timestamp;
  const latestTimestampText = formatTimestamp(latestTimestamp);

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">Monitor Overview</h3>

      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-4 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-200">Active crews</p>
        <p className="mt-2 text-3xl font-bold text-blue-900 dark:text-blue-100">{runningCount}</p>
        <p className="mt-2 text-sm text-blue-700/80 dark:text-blue-100/70">
          Detailed run cards now appear in the main Monitor view for quick access to live execution updates.
        </p>
      </div>

      {runningCount === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Start a crew from the Crews tab to begin monitoring its execution here.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-600/50 dark:bg-emerald-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">Currently running</p>
            <ul className="space-y-1 text-sm text-emerald-800 dark:text-emerald-100">
              {crewNames.slice(0, 3).map(name => (
                <li key={name} className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
            {crewNames.length > 3 ? (
              <p className="text-xs text-emerald-700/80 dark:text-emerald-200/70">+ {crewNames.length - 3} more crew{crewNames.length - 3 === 1 ? '' : 's'}</p>
            ) : null}
          </div>

          {latestActivity?.log ? (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Latest activity</p>
              <p className="mt-1 text-gray-700 dark:text-gray-200">
                {latestCrewName ? <span className="font-medium">{latestCrewName}: </span> : null}
                {latestActivity.log.message}
              </p>
              {latestTimestampText ? (
                <p className="mt-2 inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {latestTimestampText}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MonitorSidebar;
