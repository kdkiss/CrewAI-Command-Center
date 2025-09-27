import React, { forwardRef, useId, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import LogEntry, { getCategoryConfig } from './LogEntry';

export const GROUP_HEADER_ESTIMATED_HEIGHT = 56;
export const GROUP_ENTRY_ESTIMATED_HEIGHT = 96;
export const GROUP_CONTAINER_VERTICAL_PADDING = 16;

export const groupLogsByIdentity = (logs = []) => {
  const groups = [];
  let currentGroup = null;

  logs.forEach((log) => {
    if (
      !currentGroup ||
      currentGroup.message !== log.message ||
      currentGroup.level !== log.level ||
      currentGroup.agent !== log.agent
    ) {
      currentGroup = {
        ...log,
        count: 1,
        logs: [log]
      };
      groups.push(currentGroup);
    } else {
      currentGroup.count += 1;
      currentGroup.logs.push(log);
    }
  });

  return groups;
};

export const estimateLogGroupHeight = ({ logs = [], expanded = false } = {}) => {
  if (!Array.isArray(logs) || logs.length === 0) {
    return GROUP_HEADER_ESTIMATED_HEIGHT;
  }

  if (!expanded) {
    return GROUP_HEADER_ESTIMATED_HEIGHT;
  }

  const groupedLogs = groupLogsByIdentity(logs);
  return (
    GROUP_HEADER_ESTIMATED_HEIGHT +
    GROUP_CONTAINER_VERTICAL_PADDING +
    groupedLogs.length * GROUP_ENTRY_ESTIMATED_HEIGHT
  );
};

const LogGroup = forwardRef(({
  logs = [],
  groupTitle,
  category,
  messageClassName = 'text-sm',
  expanded,
  onToggle
}, ref) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const groupedLogs = useMemo(() => groupLogsByIdentity(logs), [logs]);

  const totalLogs = logs.length;
  const uniqueGroups = groupedLogs.length;
  const { Icon, color } = getCategoryConfig(category);
  const contentId = useId();

  const isControlled = typeof expanded === 'boolean' && typeof onToggle === 'function';
  const isExpanded = isControlled ? expanded : internalExpanded;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }

    if (!isControlled) {
      setInternalExpanded((prev) => !prev);
    }
  };

  const buttonLabel = `${groupTitle} containing ${totalLogs} ${totalLogs === 1 ? 'entry' : 'entries'}${uniqueGroups < totalLogs ? `, ${uniqueGroups} unique` : ''}. ${isExpanded ? 'Collapse group' : 'Expand group'}`;

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowRight' && !isExpanded) {
      event.preventDefault();
      handleToggle();
    }

    if (event.key === 'ArrowLeft' && isExpanded) {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <li className="list-none overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60">
      <button
        ref={ref}
        type="button"
        className="flex w-full items-center justify-between bg-gray-100 p-3 text-gray-900 transition-colors hover:bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 dark:bg-slate-800 dark:text-gray-100 dark:hover:bg-slate-700"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={isExpanded ? contentId : undefined}
        aria-label={buttonLabel}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${color}`} />}
          <span className="font-medium text-gray-900 dark:text-gray-100">{groupTitle}</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-800 dark:text-gray-300">{totalLogs} entries</span>
            {uniqueGroups < totalLogs && (
              <span className="text-xs text-gray-800 dark:text-gray-300">({uniqueGroups} unique)</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180 transform' : ''}`} />
      </button>

      {isExpanded && (
        <div id={contentId} className="space-y-2 bg-white/70 p-2 dark:bg-transparent" role="region" aria-label={`${groupTitle} log entries`}>
          {groupedLogs.map((group, index) => (
            <LogEntry
              key={`${group.timestamp}-${index}`}
              log={group}
              isGrouped={group.count > 1}
              groupCount={group.count}
              messageClassName={messageClassName}
            />
          ))}
        </div>
      )}
    </li>
  );
});

LogGroup.displayName = 'LogGroup';

export default LogGroup;
