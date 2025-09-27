import React, { useMemo } from 'react';
import {
  Activity,
  Clock,
  ExternalLink,
  Loader2,
  Square,
  Users
} from 'lucide-react';

const normalizeIdSet = (value) => {
  if (!value) {
    return new Set();
  }

  if (value instanceof Set) {
    return new Set(Array.from(value, item => String(item)));
  }

  if (Array.isArray(value)) {
    return new Set(value.map(item => String(item)));
  }

  if (typeof value === 'object') {
    return new Set(
      Object.entries(value)
        .filter(([, isActive]) => Boolean(isActive))
        .map(([key]) => String(key))
    );
  }

  return new Set();
};

const extractLatestTimestamp = (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return null;
  }

  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const timestamp = logs[index]?.timestamp;
    if (!timestamp) {
      continue;
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (!Number.isNaN(date?.getTime?.())) {
      return date.getTime();
    }
  }

  return null;
};

const formatRelativeTime = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date?.getTime?.())) {
    return null;
  }

  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return 'just now';
  }

  if (diff < hour) {
    const value = Math.round(diff / minute);
    return `${value} minute${value === 1 ? '' : 's'} ago`;
  }

  if (diff < day) {
    const value = Math.round(diff / hour);
    return `${value} hour${value === 1 ? '' : 's'} ago`;
  }

  const value = Math.round(diff / day);
  if (value <= 7) {
    return `${value} day${value === 1 ? '' : 's'} ago`;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (error) {
    return date.toISOString();
  }
};

const formatAbsoluteTime = (timestamp) => {
  if (!timestamp) {
    return null;
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date?.getTime?.())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  } catch (error) {
    return date.toISOString();
  }
};

const getCrewName = (crew, crewId) => {
  if (crew?.name) {
    return crew.name;
  }

  if (crewId) {
    return `Crew ${crewId}`;
  }

  return 'Crew';
};

const getCrewDescription = (crew) => {
  if (!crew?.description) {
    return null;
  }

  const trimmed = crew.description.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ActiveCrewMonitor = ({
  crews = [],
  runningCrews,
  crewLogs = {},
  pendingStarts,
  pendingStops,
  onStopCrew,
  onSelectCrew,
  onCloseEditor
}) => {
  const runningIds = useMemo(() => normalizeIdSet(runningCrews), [runningCrews]);
  const pendingStartIds = useMemo(() => normalizeIdSet(pendingStarts), [pendingStarts]);
  const pendingStopIds = useMemo(() => normalizeIdSet(pendingStops), [pendingStops]);

  const runningEntries = useMemo(() => {
    const entries = [];
    const seen = new Set();

    const addEntry = (crewId, crew) => {
      const stringId = String(crewId);
      if (seen.has(stringId)) {
        return;
      }

      seen.add(stringId);
      entries.push({
        crew,
        crewId: stringId,
        logs: crewLogs?.[stringId] || []
      });
    };

    runningIds.forEach((crewId) => {
      const stringId = String(crewId);
      const crew = crews.find(item => String(item?.id ?? '') === stringId) || null;
      addEntry(stringId, crew);
    });

    crews.forEach((crew) => {
      const crewId = crew?.id;
      if (crewId == null) {
        return;
      }

      const stringId = String(crewId);
      if (seen.has(stringId)) {
        return;
      }

      const status = String(crew?.status ?? crew?.state ?? '').trim().toLowerCase();
      if (['running', 'active', 'executing', 'in-progress'].includes(status)) {
        addEntry(stringId, crew);
      }
    });

    entries.sort((a, b) => {
      const aTime = extractLatestTimestamp(a.logs) || 0;
      const bTime = extractLatestTimestamp(b.logs) || 0;
      return bTime - aTime;
    });

    return entries;
  }, [crews, crewLogs, runningIds]);

  const handleSelectCrew = (crew) => {
    if (!crew) {
      return;
    }

    if (typeof onSelectCrew === 'function') {
      onSelectCrew(crew);
    }

    if (typeof onCloseEditor === 'function') {
      onCloseEditor();
    }
  };

  const handleStopCrew = (crewId) => {
    if (!crewId || typeof onStopCrew !== 'function') {
      return;
    }

    onStopCrew(crewId);
  };

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-gray-100">Execution Monitor</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            Track crews that are actively running and review their most recent log updates in real time.
          </p>
        </div>

        {pendingStartIds.size > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            <p className="text-sm font-semibold">Starting {pendingStartIds.size} crew{pendingStartIds.size === 1 ? '' : 's'}...</p>
            <p className="mt-1 text-sm">
              Crews appear here once execution begins. This panel updates automatically as soon as logs start streaming.
            </p>
          </div>
        ) : null}

        {runningEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
            <Activity className="h-12 w-12 text-gray-400 dark:text-gray-600" />
            <p className="mt-4 text-lg font-semibold">No crews are currently running</p>
            <p className="mt-2 max-w-md text-sm">
              Launch a crew from the Crews tab to monitor its live execution. Active runs will be listed here with their latest log entries.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="monitor-running-crews">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-3 text-blue-900 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4" />
                {runningEntries.length} active crew{runningEntries.length === 1 ? '' : 's'}
              </div>
              <p className="text-xs text-blue-700/80 dark:text-blue-100/70">
                Updated automatically from the streaming execution logs.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {runningEntries.map(({ crew, crewId, logs }) => {
                const latestLog = Array.isArray(logs) && logs.length > 0 ? logs[logs.length - 1] : null;
                const latestTimestamp = extractLatestTimestamp(logs);
                const relativeTime = formatRelativeTime(latestTimestamp);
                const absoluteTime = formatAbsoluteTime(latestTimestamp);
                const logCount = Array.isArray(logs) ? logs.length : 0;
                const agentCount = Array.isArray(crew?.agents) ? crew.agents.length : null;
                const description = getCrewDescription(crew);

                const isPendingStop = pendingStopIds.has(crewId);
                const isPendingStart = pendingStartIds.has(crewId);
                const status = isPendingStop ? 'stopping' : isPendingStart ? 'starting' : 'running';

                const statusClasses = {
                  running: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200',
                  starting: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200',
                  stopping: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200'
                };

                const statusLabel = {
                  running: 'Running',
                  starting: 'Starting…',
                  stopping: 'Stopping…'
                }[status];

                const stopButtonLabel = isPendingStop ? 'Stop requested…' : 'Stop crew';

                return (
                  <article
                    key={crewId}
                    className="flex h-full flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
                    data-testid="monitor-running-crew-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200">
                          <Activity className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{getCrewName(crew, crewId)}</h3>
                          {description ? (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
                          ) : null}
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusClasses[status]}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {logCount} log {logCount === 1 ? 'entry' : 'entries'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {relativeTime ? `Last update ${relativeTime}` : 'Waiting for first log event'}
                      </span>
                      {agentCount ? (
                        <span className="inline-flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
                        </span>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm shadow-inner dark:border-slate-800 dark:bg-slate-950">
                      <p className="font-semibold text-gray-700 dark:text-gray-200">Latest update</p>
                      <p className="mt-1 text-gray-600 dark:text-gray-300">
                        {latestLog?.agent ? (
                          <span className="font-medium text-gray-800 dark:text-gray-100">{latestLog.agent}: </span>
                        ) : null}
                        {latestLog?.message ?? 'Crew is running. Waiting for log output…'}
                      </p>
                      {absoluteTime ? (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{absoluteTime}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => handleSelectCrew(crew)}
                        disabled={!crew}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                          crew
                            ? 'border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-500/40 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-500/10'
                            : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-600'
                        }`}
                      >
                        <ExternalLink className="h-4 w-4" />
                        View details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStopCrew(crewId)}
                        disabled={isPendingStop}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                          isPendingStop
                            ? 'cursor-not-allowed bg-red-400 dark:bg-red-600'
                            : 'bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500'
                        }`}
                      >
                        {isPendingStop ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                        {stopButtonLabel}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveCrewMonitor;
