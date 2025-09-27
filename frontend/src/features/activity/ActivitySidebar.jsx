import React, { useMemo } from 'react';
import { Activity as ActivityIcon, AlertTriangle, Clock, Users } from 'lucide-react';

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return 'Waiting for activity';
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Waiting for activity';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const ActivitySidebar = ({ activityItems = [], crews = [] }) => {
  const summary = useMemo(() => {
    const items = Array.isArray(activityItems) ? activityItems : [];
    const total = items.length;
    const alertCount = items.filter(item => {
      const level = String(item?.level || '').toLowerCase();
      const action = String(item?.action || '').toLowerCase();
      return level === 'error' || level === 'warning' || action === 'error';
    }).length;
    const crewIds = new Set();
    items.forEach(item => {
      if (item?.crewId != null) {
        crewIds.add(String(item.crewId));
      }
    });
    const crewCount = crewIds.size || (Array.isArray(crews) ? crews.length : 0);

    const lastTimestamp = items.reduce((latest, item) => {
      const value = item?.timestamp instanceof Date ? item.timestamp : new Date(item?.timestamp || 0);
      if (!value || Number.isNaN(value.getTime())) {
        return latest;
      }
      if (!latest || value.getTime() > latest.getTime()) {
        return value;
      }
      return latest;
    }, null);

    return {
      total,
      alertCount,
      crewCount,
      lastTimestamp
    };
  }, [activityItems, crews]);

  return (
    <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Activity feed</h2>
        <p>
          Track crew lifecycle events and real-time log highlights. Use the activity tab to quickly confirm when agents
          start, stop, or raise alerts.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <dl className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <ActivityIcon className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <dt className="font-medium">Timeline entries</dt>
            </div>
            <dd className="text-base font-semibold text-gray-900 dark:text-gray-100">{summary.total}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              <dt className="font-medium">Alerts logged</dt>
            </div>
            <dd className="text-base font-semibold text-gray-900 dark:text-gray-100">{summary.alertCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <Users className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              <dt className="font-medium">Crews reporting</dt>
            </div>
            <dd className="text-base font-semibold text-gray-900 dark:text-gray-100">{summary.crewCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
              <Clock className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <dt className="font-medium">Last event</dt>
            </div>
            <dd className="text-right text-sm text-gray-600 dark:text-gray-300">
              {formatTimestamp(summary.lastTimestamp)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usage tips</h3>
        <ul className="space-y-2 text-sm">
          <li>
            Combine the event-type buttons with the crew selector to isolate lifecycle changes for a single automation.
          </li>
          <li>
            Watch for alert badges—errors and warnings surface here alongside the streaming logs so issues are easy to spot.
          </li>
          <li>
            Hover over timestamps to confirm when a run started or stopped relative to other operations.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ActivitySidebar;
