import React, { useMemo, useId } from 'react';
import { Search, XCircle } from 'lucide-react';
import { createDefaultLogFilters as defaultCreateDefaultLogFilters } from './utils';

const LogFilters = ({
  filters,
  onFilterChange,
  onClear,
  logs = [],
  createDefaultLogFilters
}) => {
  const resolveDefaultFilters = createDefaultLogFilters ?? defaultCreateDefaultLogFilters;
  const activeFilters = filters ?? resolveDefaultFilters();

  const uniqueAgents = useMemo(() => {
    const agents = new Set();
    logs.forEach((log) => {
      if (log?.agent) {
        agents.add(log.agent);
      }
    });
    return Array.from(agents);
  }, [logs]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    logs.forEach((log) => {
      if (log?.category) {
        categories.add(log.category);
      }
    });
    return Array.from(categories);
  }, [logs]);

  const handleFilterChange = (key, value) => {
    onFilterChange?.({
      ...activeFilters,
      [key]: value
    });
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onFilterChange) {
      onFilterChange(resolveDefaultFilters());
    }
  };

  const searchInputId = useId();
  const levelSelectId = useId();
  const agentSelectId = useId();
  const categorySelectId = useId();
  const timeRangeSelectId = useId();

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 dark:text-gray-200">
      <div className="mb-1 flex flex-col gap-2 md:mb-0 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400 dark:text-gray-500" />
          <label htmlFor={searchInputId} className="sr-only">
            Search logs
          </label>
          <input
            type="text"
            value={activeFilters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder="Search logs"
            id={searchInputId}
            className="w-full rounded border border-gray-300 bg-white/90 pl-9 pr-3 py-2 text-gray-900 placeholder:text-gray-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:ring-offset-slate-950 md:min-w-[250px]"
          />
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1 self-start rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 md:self-auto dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700"
        >
          <XCircle className="w-4 h-4" />
          Clear
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={levelSelectId}>
            Log Level
          </label>
          <select
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100 dark:focus:ring-offset-slate-950"
            value={activeFilters.level}
            onChange={(e) => handleFilterChange('level', e.target.value)}
            id={levelSelectId}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={agentSelectId}>
            Agent
          </label>
          <select
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100 dark:focus:ring-offset-slate-950"
            value={activeFilters.agent}
            onChange={(e) => handleFilterChange('agent', e.target.value)}
            id={agentSelectId}
          >
            <option value="all">All Agents</option>
            {uniqueAgents.map((agent) => (
              <option key={agent} value={agent}>
                {agent}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={categorySelectId}>
            Category
          </label>
          <select
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100 dark:focus:ring-offset-slate-950"
            value={activeFilters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            id={categorySelectId}
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={timeRangeSelectId}>
            Time Range
          </label>
          <select
            className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-900/60 dark:text-gray-100 dark:focus:ring-offset-slate-950"
            value={activeFilters.timeRange}
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
            id={timeRangeSelectId}
          >
            <option value="all">All Time</option>
            <option value="5m">Last 5 minutes</option>
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="today">Today</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default LogFilters;
