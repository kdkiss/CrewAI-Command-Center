import React, { forwardRef } from 'react';
import {
  XCircle,
  AlertCircle,
  Settings,
  Info,
  Search,
  BarChart2,
  CheckSquare,
  CheckCircle,
  Play
} from 'lucide-react';

export const getCategoryConfig = (category) => {
  const configs = {
    SEARCH: { Icon: Search, color: 'text-blue-700 dark:text-blue-300' },
    ANALYSIS: { Icon: BarChart2, color: 'text-purple-700 dark:text-purple-300' },
    DECISION: { Icon: CheckSquare, color: 'text-emerald-700 dark:text-emerald-300' },
    RESULT: { Icon: CheckCircle, color: 'text-emerald-800 dark:text-emerald-300' },
    ERROR: { Icon: AlertCircle, color: 'text-red-700 dark:text-red-300' },
    ACTION: { Icon: Play, color: 'text-blue-700 dark:text-blue-300' },
    default: { Icon: Info, color: 'text-blue-700 dark:text-blue-300' }
  };

  return configs[category] || configs.default;
};

const LogEntry = forwardRef(({ log, isGrouped = false, groupCount = 0, messageClassName = 'text-sm' }, ref) => {
  const timestamp = new Date(log.timestamp);
  const timeString = Number.isNaN(timestamp.getTime()) ? 'Invalid Date' : timestamp.toLocaleTimeString();

  const levelConfigs = {
    error: {
      Icon: XCircle,
      container: 'border-red-400 bg-red-50 dark:border-red-500/60 dark:bg-red-500/10',
      iconBg: 'bg-red-100 dark:bg-red-500/20',
      iconColor: 'text-red-700 dark:text-red-300',
      badgeBg: 'bg-red-100 dark:bg-red-500/20',
      badgeText: 'text-red-800 dark:text-red-100'
    },
    warning: {
      Icon: AlertCircle,
      container: 'border-yellow-400 bg-yellow-50 dark:border-amber-500/60 dark:bg-amber-500/10',
      iconBg: 'bg-yellow-100 dark:bg-amber-500/20',
      iconColor: 'text-yellow-700 dark:text-amber-200',
      badgeBg: 'bg-yellow-100 dark:bg-amber-500/20',
      badgeText: 'text-yellow-800 dark:text-amber-100'
    },
    debug: {
      Icon: Settings,
      container: 'border-gray-300 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/60',
      iconBg: 'bg-gray-200 dark:bg-slate-800',
      iconColor: 'text-gray-700 dark:text-gray-300',
      badgeBg: 'bg-gray-200 dark:bg-slate-800',
      badgeText: 'text-gray-800 dark:text-gray-200'
    },
    info: {
      Icon: Info,
      container: 'border-blue-300 bg-blue-50 dark:border-blue-500/40 dark:bg-blue-500/10',
      iconBg: 'bg-blue-100 dark:bg-blue-500/20',
      iconColor: 'text-blue-700 dark:text-blue-300',
      badgeBg: 'bg-blue-100 dark:bg-blue-500/20',
      badgeText: 'text-blue-800 dark:text-blue-100'
    }
  };

  const baseConfig = levelConfigs[log.level] || levelConfigs.info;
  const categoryConfig = log.category ? getCategoryConfig(log.category) : null;
  const LevelIcon = baseConfig.Icon;
  const CategoryIcon = categoryConfig?.Icon;

  const duplicateFlag = log.is_duplicate ?? log.isDuplicate;
  const duplicateTotal = log.duplicate_count ?? log.duplicateCount ?? 0;
  const groupedCount = isGrouped && groupCount > 1
    ? groupCount
    : (duplicateFlag && duplicateTotal > 1 ? duplicateTotal : 0);

  const labelParts = [
    `${(log.level || 'info').toLowerCase()} log`,
    log.agent ? `from ${log.agent}` : 'from system',
    Number.isNaN(timestamp.getTime()) ? null : `recorded at ${timeString}`,
    log.category ? `category ${log.category}` : null,
    groupedCount > 1 ? `${groupedCount} similar entries` : null,
    log.message
  ].filter(Boolean);

  return (
    <li
      ref={ref}
      className={`list-none rounded-lg border border-l-4 p-3 shadow-sm transition-colors ${baseConfig.container}`}
      tabIndex={-1}
      aria-label={labelParts.join(', ')}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${baseConfig.iconBg}`}>
          {LevelIcon && <LevelIcon className={`h-4 w-4 ${baseConfig.iconColor}`} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
              <span>{timeString}</span>
              <span className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100">
                {log.agent || 'system'}
              </span>
              {log.sequence > 0 && (
                <span className="text-xs text-gray-700 dark:text-gray-300">#{log.sequence}</span>
              )}
              {log.category && (
                <span className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100">
                  {CategoryIcon && (
                    <CategoryIcon className={`h-3 w-3 ${categoryConfig.color}`} />
                  )}
                  {log.category}
                </span>
              )}
            </div>

            {groupedCount > 1 && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${baseConfig.badgeBg} ${baseConfig.badgeText}`}>
                +{groupedCount - 1} similar
              </span>
            )}
          </div>

          <p className={`mt-2 break-words font-mono ${messageClassName} text-gray-900 dark:text-gray-100 whitespace-pre-wrap`}>
            {log.message}
          </p>
        </div>
      </div>
    </li>
  );
});

LogEntry.displayName = 'LogEntry';

export default LogEntry;
