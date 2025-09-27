import React, { useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Clock,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Square
} from 'lucide-react';

const TYPE_FILTERS = [
  { value: 'all', label: 'All activity' },
  { value: 'lifecycle', label: 'Crew lifecycle' },
  { value: 'logs', label: 'Log output' },
  { value: 'alerts', label: 'Alerts & errors' },
  { value: 'system', label: 'System updates' }
];

const levelBadgeClass = (level) => {
  switch (level) {
    case 'error':
      return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300';
    case 'warning':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200';
    case 'success':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'info':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200';
  }
};

const getIconForItem = (item) => {
  const level = (item?.level || '').toLowerCase();
  if (level === 'error') {
    return {
      Icon: AlertTriangle,
      className: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300'
    };
  }
  if (level === 'warning') {
    return {
      Icon: AlertTriangle,
      className: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-200'
    };
  }
  const action = (item?.action || '').toLowerCase();
  if (action === 'started') {
    return {
      Icon: PlayCircle,
      className: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
    };
  }
  if (action === 'stopped') {
    return {
      Icon: Square,
      className: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
    };
  }
  if (action === 'updated') {
    return {
      Icon: RefreshCw,
      className: 'bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-200'
    };
  }
  if (item?.type === 'system') {
    return {
      Icon: Clock,
      className: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200'
    };
  }
  if (item?.type === 'log') {
    return {
      Icon: MessageSquare,
      className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
    };
  }
  return {
    Icon: ActivityIcon,
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200'
  };
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return '';
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const ActivityFeed = ({ items = [], crews = [] }) => {
  const [typeFilter, setTypeFilter] = useState('all');
  const [crewFilter, setCrewFilter] = useState('all');

  const crewOptions = useMemo(() => {
    const entries = new Map();

    if (Array.isArray(crews)) {
      crews.forEach(crew => {
        if (crew?.id != null) {
          const key = String(crew.id);
          entries.set(key, crew?.name || key);
        }
      });
    }

    (Array.isArray(items) ? items : []).forEach(item => {
      if (item?.crewId) {
        const key = String(item.crewId);
        if (!entries.has(key)) {
          entries.set(key, item?.crewName || key);
        }
      }
    });

    return Array.from(entries.entries()).map(([value, label]) => ({ value, label }));
  }, [crews, items]);

  const sortedItems = useMemo(() => {
    const list = Array.isArray(items) ? [...items] : [];
    return list.sort((a, b) => {
      const aTime = a?.timestamp instanceof Date ? a.timestamp.getTime() : Date.parse(a?.timestamp || 0);
      const bTime = b?.timestamp instanceof Date ? b.timestamp.getTime() : Date.parse(b?.timestamp || 0);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) {
        return 0;
      }
      if (Number.isNaN(aTime)) {
        return 1;
      }
      if (Number.isNaN(bTime)) {
        return -1;
      }
      if (bTime !== aTime) {
        return bTime - aTime;
      }
      const aId = a?.id || '';
      const bId = b?.id || '';
      return bId.localeCompare(aId);
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const lifecycleActions = new Set(['started', 'stopped', 'updated', 'error']);
    const normalizedCrewFilter = crewFilter === 'all' ? null : crewFilter;

    return sortedItems.filter(item => {
      const type = String(item?.type || 'system').toLowerCase();
      const level = String(item?.level || '').toLowerCase();
      const action = String(item?.action || '').toLowerCase();
      const crewId = item?.crewId != null ? String(item.crewId) : null;

      const matchesCrew = !normalizedCrewFilter || (crewId && crewId === normalizedCrewFilter);

      let matchesType = false;
      switch (typeFilter) {
        case 'logs':
          matchesType = type === 'log';
          break;
        case 'lifecycle':
          matchesType = type === 'lifecycle' || lifecycleActions.has(action);
          break;
        case 'alerts':
          matchesType = level === 'error' || level === 'warning' || action === 'error';
          break;
        case 'system':
          matchesType = type === 'system';
          break;
        case 'all':
        default:
          matchesType = true;
          break;
      }

      return matchesCrew && matchesType;
    });
  }, [crewFilter, sortedItems, typeFilter]);

  const hasEvents = sortedItems.length > 0;
  const isFiltered = typeFilter !== 'all' || crewFilter !== 'all';

  const renderMetadata = (item) => {
    const details = [];

    if (item?.details?.category) {
      details.push(['Category', item.details.category]);
    }
    if (item?.metadata?.operationId) {
      details.push(['Operation', item.metadata.operationId]);
    }
    if (item?.metadata?.operationStatus) {
      details.push(['Status', item.metadata.operationStatus]);
    }
    if (item?.metadata?.sequence != null) {
      details.push(['Sequence', item.metadata.sequence]);
    }
    if (item?.metadata?.totalSteps != null) {
      details.push(['Total steps', item.metadata.totalSteps]);
    }

    if (!details.length) {
      return null;
    }

    return (
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
        {details.map(([label, value]) => (
          <div key={`${label}-${value}`} className="flex items-center gap-1">
            <dt className="font-medium uppercase tracking-wide">{label}</dt>
            <dd className="text-gray-600 dark:text-gray-300">{value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const emptyTitle = hasEvents
    ? 'No activity matches the selected filters'
    : 'No activity yet';
  const emptyMessage = hasEvents
    ? 'Adjust the crew or event filters to see more of the timeline.'
    : 'Start a crew or wait for agents to emit logs and lifecycle updates.';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filter timeline</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Focus the activity feed by selecting an event type and crew.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPE_FILTERS.map(option => {
              const isActive = typeFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTypeFilter(option.value)}
                  aria-pressed={isActive}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                    isActive
                      ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-500/20 dark:text-blue-100'
                      : 'border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <label
              htmlFor="activity-crew-filter"
              className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
            >
              Crew filter
            </label>
            <select
              id="activity-crew-filter"
              value={crewFilter}
              onChange={(event) => setCrewFilter(event.target.value)}
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-200"
            >
              <option value="all">All crews</option>
              {crewOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {filteredItems.length} of {sortedItems.length} events
            {isFiltered ? ' (filtered)' : ''}.
          </p>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ActivityIcon className="h-10 w-10 text-gray-300 dark:text-slate-700" aria-hidden="true" />
          <h4 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{emptyTitle}</h4>
          <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {filteredItems.map(item => {
            const { Icon, className } = getIconForItem(item);
            const level = (item?.level || '').toLowerCase();
            const action = (item?.action || '').toLowerCase();
            const crewName = item?.crewName || (item?.crewId != null ? `Crew ${item.crewId}` : 'System');
            const timestampValue = item?.timestamp instanceof Date ? item.timestamp : new Date(item?.timestamp || Date.now());
            const titleBadge = action ? `${action.charAt(0).toUpperCase()}${action.slice(1)}` : null;

            return (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/60"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${className}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{crewName}</span>
                        {titleBadge && (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                            {titleBadge}
                          </span>
                        )}
                        {item?.type === 'log' && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            Log
                          </span>
                        )}
                        {level && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${levelBadgeClass(level)}`}>
                            {level}
                          </span>
                        )}
                      </div>
                      <time
                        dateTime={timestampValue.toISOString()}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        {formatTimestamp(timestampValue)}
                      </time>
                    </div>
                    {item?.agent && (
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Agent: <span className="text-gray-700 dark:text-gray-200">{item.agent}</span>
                      </p>
                    )}
                    {item?.message && (
                      <p className="text-sm text-gray-700 dark:text-gray-200">{item.message}</p>
                    )}
                    {renderMetadata(item)}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default ActivityFeed;
