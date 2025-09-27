import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import LogFilters from './LogFilters';
import LogEntry from './LogEntry';
import LogGroup from './LogGroup';
import OperationProgress from './OperationProgress';
import {
  createDefaultLogFilters as defaultCreateDefaultLogFilters,
  filterLogs as defaultFilterLogs,
  formatLogsForExport
} from './utils';

const FONT_SIZE_CLASS_MAP = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base'
};

const buttonBaseClasses =
  'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 dark:focus:ring-offset-slate-950';

const getViewButtonClasses = (isActive) =>
  `${buttonBaseClasses} ${
    isActive
      ? 'border-transparent bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700 dark:hover:text-white'
  }`;

const getExportButtonClasses = (isDisabled) =>
  `${buttonBaseClasses} ${
    isDisabled
      ? 'border-gray-300 bg-gray-200 text-gray-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-gray-400'
      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100 dark:hover:bg-slate-700'
  }`;

const LogViewer = ({
  logs = [],
  filters,
  onFiltersChange,
  onClearFilters,
  createDefaultLogFilters,
  filterLogs,
  logFontSize = 'medium'
}) => {
  const [viewMode, setViewMode] = useState('detailed');
  const logRegionRef = useRef(null);
  const latestItemRef = useRef(null);

  const resolveCreateDefaultLogFilters = createDefaultLogFilters ?? defaultCreateDefaultLogFilters;
  const resolveFilterLogs = filterLogs ?? defaultFilterLogs;

  const activeFilters = filters ?? resolveCreateDefaultLogFilters();

  const messageClassName = useMemo(() => {
    if (typeof logFontSize !== 'string') {
      return FONT_SIZE_CLASS_MAP.medium;
    }

    return FONT_SIZE_CLASS_MAP[logFontSize] ?? FONT_SIZE_CLASS_MAP.medium;
  }, [logFontSize]);

  const filteredLogs = useMemo(
    () => resolveFilterLogs(logs, activeFilters),
    [logs, activeFilters, resolveFilterLogs]
  );

  const previousLogCountRef = useRef(filteredLogs.length);

  const handleFiltersChange = useCallback(
    (updatedFilters) => {
      onFiltersChange?.(updatedFilters);
    },
    [onFiltersChange]
  );

  const handleClearFilters = useCallback(() => {
    if (onClearFilters) {
      onClearFilters();
    } else if (onFiltersChange) {
      onFiltersChange(resolveCreateDefaultLogFilters());
    }
  }, [onClearFilters, onFiltersChange, resolveCreateDefaultLogFilters]);

  const groupedLogs = useMemo(() => {
    const groups = {};
    filteredLogs.forEach((log) => {
      const opId = log.operation_id || 'ungrouped';
      if (!groups[opId]) {
        groups[opId] = [];
      }
      groups[opId].push(log);
    });
    return groups;
  }, [filteredLogs]);

  const operations = useMemo(() => {
    const ops = {};
    Object.entries(groupedLogs).forEach(([opId, logsForOperation]) => {
      if (opId !== 'ungrouped') {
        const firstLog = logsForOperation[0];
        const lastLogForOp = logsForOperation[logsForOperation.length - 1];
        ops[opId] = {
          id: opId,
          type: firstLog.category || 'UNKNOWN',
          agent: firstLog.agent,
          status: lastLogForOp.operation_status || 'in_progress',
          start_time: new Date(firstLog.timestamp),
          end_time: lastLogForOp.operation_status === 'complete' ? new Date(lastLogForOp.timestamp) : null,
          logs_count: logsForOperation.length,
          current_step: lastLogForOp.sequence || 1,
          total_steps: lastLogForOp.total_steps || logsForOperation.length
        };
      }
    });
    return ops;
  }, [groupedLogs]);

  const handleExportLogs = useCallback(() => {
    if (!filteredLogs.length || typeof window === 'undefined') {
      return;
    }

    const prefersCsv = window.confirm
      ? window.confirm('Export logs as CSV? Click Cancel to export as JSON.')
      : false;

    const { data, mimeType, extension } = formatLogsForExport(
      filteredLogs,
      prefersCsv ? 'csv' : 'json'
    );

    if (!data) {
      return;
    }

    try {
      if (window.URL?.createObjectURL && typeof document !== 'undefined') {
        const blob = new Blob([data], { type: mimeType });
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `logs-${new Date().toISOString()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl);
        }, 0);
      } else if (window.navigator?.clipboard?.writeText) {
        window.navigator.clipboard.writeText(data).catch(() => {
          console.warn('Failed to copy logs to clipboard.');
        });
      }
    } catch (error) {
      console.error('Failed to export logs', error);

      if (window.navigator?.clipboard?.writeText) {
        window.navigator.clipboard.writeText(data).catch(() => {
          console.warn('Failed to copy logs to clipboard.');
        });
      }
    }
  }, [filteredLogs]);

  const setLatestItemRef = useCallback((node) => {
    latestItemRef.current = node ?? null;
  }, []);

  const lastLog = filteredLogs[filteredLogs.length - 1] ?? null;

  useEffect(() => {
    if (viewMode !== 'detailed') {
      previousLogCountRef.current = filteredLogs.length;
      latestItemRef.current = null;
      return;
    }

    if (filteredLogs.length === 0) {
      previousLogCountRef.current = 0;
      latestItemRef.current = null;
      return;
    }

    if (
      filteredLogs.length > previousLogCountRef.current &&
      latestItemRef.current &&
      typeof latestItemRef.current.focus === 'function'
    ) {
      latestItemRef.current.focus({ preventScroll: false });
    }

    previousLogCountRef.current = filteredLogs.length;
  }, [filteredLogs.length, viewMode]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Execution Monitor</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={getViewButtonClasses(viewMode === 'detailed')}
            onClick={() => setViewMode('detailed')}
          >
            Detailed
          </button>
          <button
            type="button"
            className={getViewButtonClasses(viewMode === 'summary')}
            onClick={() => setViewMode('summary')}
          >
            Summary
          </button>
          <button
            type="button"
            className={getExportButtonClasses(filteredLogs.length === 0)}
            onClick={handleExportLogs}
            disabled={filteredLogs.length === 0}
          >
            Export
          </button>
        </div>
      </div>

      <LogFilters
        filters={activeFilters}
        onFilterChange={handleFiltersChange}
        onClear={handleClearFilters}
        logs={logs}
        createDefaultLogFilters={resolveCreateDefaultLogFilters}
      />

      <div className="relative max-h-96 overflow-hidden rounded-xl border border-gray-200 bg-white/70 shadow-inner dark:border-slate-800 dark:bg-slate-950/40">
        <div
          ref={logRegionRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-label="Execution log entries"
          className="relative max-h-96 overflow-y-auto pr-1"
          data-testid="log-live-region"
        >
          {filteredLogs.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-600 dark:text-gray-300">
              No logs match the current filters.
            </div>
          ) : viewMode === 'summary' ? (
            <ul className="space-y-3 list-none p-0 m-0">
              {Object.values(operations).map((operation) => (
                <li
                  key={operation.id}
                  className="list-none rounded-xl border border-gray-200 bg-white/80 p-3 text-gray-900 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900/60 dark:text-gray-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{operation.type}</span>
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">by {operation.agent}</span>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-900 dark:bg-slate-800 dark:text-gray-200">
                      {operation.logs_count} logs
                    </span>
                  </div>
                  <OperationProgress operation={operation} />
                </li>
              ))}

              {groupedLogs.ungrouped && groupedLogs.ungrouped.length > 0 && (
                <li className="list-none rounded-xl border border-gray-200 bg-white/80 p-3 text-gray-900 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-gray-100">Miscellaneous Logs</span>
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-xs text-gray-900 dark:bg-slate-800 dark:text-gray-200">
                      {groupedLogs.ungrouped.length} logs
                    </span>
                  </div>
                </li>
              )}
            </ul>
          ) : (
            <ol className="space-y-4 list-none p-0 m-0" aria-label="Detailed execution logs">
              {Object.entries(groupedLogs).map(([opId, logsForOperation]) => (
                opId === 'ungrouped'
                  ? logsForOperation.map((log, index) => {
                      const isLatestLog = lastLog && log === lastLog;
                      return (
                        <LogEntry
                          key={`${log.timestamp}-${index}`}
                          log={log}
                          messageClassName={messageClassName}
                          ref={isLatestLog ? setLatestItemRef : undefined}
                        />
                      );
                    })
                  : (
                      <LogGroup
                        key={opId}
                        logs={logsForOperation}
                        groupTitle={`${logsForOperation[0].category || 'Operation'}: ${logsForOperation[0].agent}`}
                        category={logsForOperation[0].category}
                        messageClassName={messageClassName}
                        ref={lastLog && logsForOperation.includes(lastLog) ? setLatestItemRef : undefined}
                      />
                    )
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogViewer;
