import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Bug,
  Users,
  ListChecks,
  Play,
  Square,
  Copy,
  PenSquare,
  Trash2
} from 'lucide-react';

const normalizeLogLevel = (level) => {
  if (!level) return null;
  const normalized = String(level).toLowerCase();
  if (normalized === 'warn') return 'warning';
  if (['fatal', 'critical'].includes(normalized)) return 'error';
  if (['success', 'ok', 'completed'].includes(normalized)) return 'success';
  return normalized;
};

const getStatusConfig = (logs, latestLog) => {
  const normalizedLevel = normalizeLogLevel(latestLog?.level);
  const statusMap = {
    error: {
      label: 'Error',
      Icon: AlertCircle,
      textClass: 'text-red-600 dark:text-red-400',
      badgeClass: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300'
    },
    warning: {
      label: 'Warning',
      Icon: AlertTriangle,
      textClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300'
    },
    success: {
      label: 'Success',
      Icon: CheckCircle,
      textClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300'
    },
    info: {
      label: 'Info',
      Icon: Info,
      textClass: 'text-blue-600 dark:text-blue-400',
      badgeClass: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
    },
    debug: {
      label: 'Debug',
      Icon: Bug,
      textClass: 'text-slate-600 dark:text-slate-300',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    }
  };

  const defaultConfig = {
    label: logs.length > 0 && latestLog?.level
      ? `${latestLog.level}`.charAt(0).toUpperCase() + `${latestLog.level}`.slice(1)
      : 'No Activity',
    Icon: logs.length > 0 ? Info : Clock,
    textClass: logs.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400',
    badgeClass: logs.length > 0
      ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300'
      : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300'
  };

  return statusMap[normalizedLevel] || defaultConfig;
};

const normalizeStatusToken = (value) => {
  if (!value) return null;
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
};

const STATUS_BADGE_DEFINITIONS = {
  running: {
    label: 'Running',
    badgeClass: 'border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-200'
  },
  ready: {
    label: 'Ready',
    badgeClass: 'border border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200'
  },
  failed: {
    label: 'Failed',
    badgeClass: 'border border-red-200 bg-red-100 text-red-700 dark:border-red-500 dark:bg-red-500/20 dark:text-red-200'
  },
  pending: {
    label: 'Pending',
    badgeClass: 'border border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500 dark:bg-amber-500/20 dark:text-amber-200'
  },
  stopped: {
    label: 'Stopped',
    badgeClass: 'border border-gray-200 bg-gray-100 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'
  },
  unknown: {
    label: 'Unknown',
    badgeClass: 'border border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
  }
};

const STATUS_BADGE_ALIASES = {
  running: 'running',
  'in-progress': 'running',
  processing: 'running',
  executing: 'running',
  active: 'running',
  ready: 'ready',
  idle: 'ready',
  success: 'ready',
  completed: 'ready',
  available: 'ready',
  standby: 'ready',
  info: 'ready',
  debug: 'ready',
  pending: 'pending',
  queued: 'pending',
  waiting: 'pending',
  warning: 'pending',
  scheduled: 'pending',
  failed: 'failed',
  error: 'failed',
  fatal: 'failed',
  critical: 'failed',
  stopped: 'stopped',
  halted: 'stopped',
  paused: 'stopped',
  cancelled: 'stopped',
  canceled: 'stopped'
};

const getStatusBadgeConfig = (crewStatus, latestLog) => {
  const candidates = [crewStatus, normalizeLogLevel(latestLog?.level)];

  for (const candidate of candidates) {
    const normalized = normalizeStatusToken(candidate);
    if (!normalized) {
      continue;
    }

    const alias = STATUS_BADGE_ALIASES[normalized] || normalized;
    if (alias in STATUS_BADGE_DEFINITIONS) {
      return STATUS_BADGE_DEFINITIONS[alias];
    }
  }

  return STATUS_BADGE_DEFINITIONS.unknown;
};

const extractTimestamp = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'object' && 'timestamp' in value) {
    return value.timestamp;
  }

  return null;
};

const formatLastRunText = (latestLog) => {
  const timestamp = extractTimestamp(latestLog);
  if (!timestamp) {
    return null;
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date?.getTime?.())) {
    return null;
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return 'just now';
  }

  if (diffMs < hour) {
    const minutes = Math.round(diffMs / minute);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (diffMs < day) {
    const hours = Math.round(diffMs / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
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

const CrewCard = ({
  crew,
  selectedCrewId,
  crewLogs,
  isRunning = false,
  runStats,
  onSelect,
  onRun,
  onStop,
  onEdit,
  onClone,
  onDelete,
  onCloseEditor
}) => {
  const crewId = crew ? String(crew.id) : '';
  const selectedCrewIdString = selectedCrewId != null ? String(selectedCrewId) : null;
  const isSelected = crew ? selectedCrewIdString === crewId : false;
  const logs = useMemo(() => {
    if (!crew || !crewId) {
      return [];
    }

    const crewLogEntries = crewLogs?.[crewId];

    return Array.isArray(crewLogEntries) ? crewLogEntries : [];
  }, [crew, crewId, crewLogs]);
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const statusConfig = getStatusConfig(logs, latestLog);
  const statusBadgeConfig = getStatusBadgeConfig(crew?.status, latestLog);
  const StatusIcon = statusConfig.Icon;
  const logCount = logs.length;
  const lastRunText = formatLastRunText(runStats?.lastRun ?? latestLog);
  const totalExecutions = useMemo(() => {
    if (typeof runStats?.totalExecutions === 'number') {
      return runStats.totalExecutions;
    }

    if (!Array.isArray(logs)) {
      return 0;
    }

    return logs.reduce((count, logEntry) => (
      logEntry?.operation_status === 'complete' ? count + 1 : count
    ), 0);
  }, [logs, runStats?.totalExecutions]);
  const normalizedCrew = useMemo(
    () => (crew ? {
      ...crew,
      id: crewId
    } : null),
    [crew, crewId]
  );
  const crewName = crew?.name ?? 'Untitled Crew';
  const crewDescription = crew?.description || 'No description provided.';
  const agentCount = Array.isArray(crew?.agents) ? crew.agents.length : 0;
  const taskCount = Array.isArray(crew?.tasks) ? crew.tasks.length : 0;

  const [showQuickActions, setShowQuickActions] = useState(false);
  const containerRef = useRef(null);

  const handleActivateQuickActions = () => {
    setShowQuickActions(true);
  };

  const handleDeactivateQuickActions = (event) => {
    const nextFocusTarget = event?.relatedTarget;
    if (containerRef.current && nextFocusTarget instanceof HTMLElement) {
      if (containerRef.current.contains(nextFocusTarget)) {
        return;
      }
    }
    setShowQuickActions(false);
  };
  const handleMouseLeave = () => {
    if (typeof document !== 'undefined' && containerRef.current) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && containerRef.current.contains(activeElement)) {
        return;
      }
    }
    setShowQuickActions(false);
  };

  if (!crew) {
    return null;
  }

  const handleSelectCrew = () => {
    if (typeof onSelect === 'function' && normalizedCrew) {
      onSelect(normalizedCrew);
    }
    if (typeof onCloseEditor === 'function') {
      onCloseEditor();
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectCrew();
    }
  };

  const runLabel = isRunning ? 'Stop' : 'Run';
  const RunIcon = isRunning ? Square : Play;
  const isRunDisabled = isRunning ? typeof onStop !== 'function' : typeof onRun !== 'function';

  const handleRunClick = (event) => {
    event.stopPropagation();
    if (isRunning) {
      if (typeof onStop === 'function' && normalizedCrew) {
        onStop(normalizedCrew);
      }
      return;
    }

    if (typeof onRun === 'function' && normalizedCrew) {
      onRun(normalizedCrew);
    }
  };

  const handleEditClick = (event) => {
    event.stopPropagation();
    if (typeof onEdit === 'function' && normalizedCrew) {
      onEdit(normalizedCrew);
    }
  };

  const handleCloneClick = (event) => {
    event.stopPropagation();
    if (typeof onClone === 'function' && normalizedCrew) {
      onClone(normalizedCrew);
    }
  };

  const handleDeleteClick = (event) => {
    event.stopPropagation();
    if (typeof onDelete === 'function' && normalizedCrew) {
      onDelete(normalizedCrew);
    }
  };

  return (
    <article
      ref={containerRef}
      role="button"
      tabIndex={0}
      className={`group relative flex h-full cursor-pointer flex-col rounded-lg border bg-white p-4 text-left text-gray-900 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 dark:bg-slate-900 dark:text-gray-100 ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'
      } ${isRunning ? 'shadow-sm shadow-blue-100 dark:shadow-blue-900/30' : ''}`}
      onClick={handleSelectCrew}
      onKeyDown={handleKeyDown}
      onFocus={handleActivateQuickActions}
      onBlur={handleDeactivateQuickActions}
      onMouseEnter={handleActivateQuickActions}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-lg font-semibold text-gray-900 dark:text-gray-100">{crewName}</h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{crewDescription}</p>
        </div>
        <div className="flex w-full flex-col items-end gap-2 sm:w-auto">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1 text-sm font-medium ${statusConfig.textClass}`}>
              {StatusIcon && <StatusIcon className="h-4 w-4" />}
              <span>{statusConfig.label}</span>
            </div>
            {statusBadgeConfig && (
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeConfig.badgeClass}`}
                data-testid="crew-status-badge"
              >
                {statusBadgeConfig.label}
              </span>
            )}
            {isRunning && (
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
                <Activity className="h-4 w-4 animate-pulse" />
                <span>Running</span>
              </div>
            )}
          </div>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.badgeClass}`}>
            {logCount} {logCount === 1 ? 'log' : 'logs'}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-gray-700 transition-colors group-hover:border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{agentCount}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{agentCount === 1 ? 'Agent' : 'Agents'}</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-gray-700 transition-colors group-hover:border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200">
          <ListChecks className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{taskCount}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{taskCount === 1 ? 'Task' : 'Tasks'}</span>
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600 dark:text-gray-300 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Last run</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-200">
            {lastRunText ? lastRunText : 'Never run'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Total executions</dt>
          <dd className="font-medium text-gray-700 dark:text-gray-200">{totalExecutions}</dd>
        </div>
      </dl>
      <div
        className={`pointer-events-none absolute right-4 top-4 flex items-center gap-2 rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-black/5 opacity-0 transition-all dark:bg-slate-900/95 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 ${
          showQuickActions ? 'pointer-events-auto opacity-100' : ''
        }`}
        aria-hidden={showQuickActions ? undefined : true}
        onFocus={handleActivateQuickActions}
        onBlur={handleDeactivateQuickActions}
      >
        <button
          type="button"
          onClick={handleRunClick}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 ${
            isRunning
              ? 'bg-amber-500/90 text-white hover:bg-amber-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } ${isRunDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
          disabled={isRunDisabled}
          tabIndex={showQuickActions ? 0 : -1}
        >
          {RunIcon ? <RunIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          <span>{runLabel}</span>
        </button>
        <button
          type="button"
          onClick={handleEditClick}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          tabIndex={showQuickActions ? 0 : -1}
        >
          <PenSquare className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edit</span>
        </button>
        <button
          type="button"
          onClick={handleCloneClick}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-gray-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
          tabIndex={showQuickActions ? 0 : -1}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Clone</span>
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-red-400 dark:hover:bg-red-500/10 dark:focus-visible:ring-offset-slate-900"
          tabIndex={showQuickActions ? 0 : -1}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Delete</span>
        </button>
      </div>
    </article>
  );
};

export default CrewCard;

