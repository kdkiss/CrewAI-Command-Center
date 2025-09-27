import React, { useMemo } from 'react';
import { Moon, Sun, SlidersHorizontal } from 'lucide-react';

import { createDefaultLogFilters } from '../../../components/logs/utils';
import { SORT_OPTIONS } from './crewListOptions';

const LOG_FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' }
];

const LOG_LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'error', label: 'Error' },
  { value: 'debug', label: 'Debug' }
];

const TIME_RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '5m', label: 'Last 5 minutes' },
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last hour' },
  { value: 'today', label: 'Today' }
];

const formatStatusLabel = (status) => {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const SettingsPanel = ({
  preferences,
  onThemeChange,
  onLogFontSizeChange,
  onDefaultLogFiltersChange,
  onCrewListDefaultsChange,
  availableStatusFilters = []
}) => {
  const theme = preferences?.theme === 'dark' ? 'dark' : 'light';
  const logFontSize = typeof preferences?.logFontSize === 'string' ? preferences.logFontSize : 'medium';

  const defaultLogFilters = useMemo(() => {
    return {
      ...createDefaultLogFilters(),
      ...(preferences?.defaultLogFilters || {})
    };
  }, [preferences?.defaultLogFilters]);

  const crewListDefaults = useMemo(() => ({
    statusFilter: preferences?.crewList?.statusFilter || 'all',
    sortOption: preferences?.crewList?.sortOption || 'name-asc',
    view: preferences?.crewList?.view === 'list' ? 'list' : 'grid'
  }), [preferences?.crewList]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set(
      Array.isArray(availableStatusFilters) ? availableStatusFilters.filter(Boolean) : []
    );

    const normalized = Array.from(uniqueStatuses);
    normalized.sort((a, b) => a.localeCompare(b));
    return normalized;
  }, [availableStatusFilters]);

  const handleLogFilterChange = (key, value) => {
    const nextFilters = {
      ...defaultLogFilters,
      [key]: value
    };
    onDefaultLogFiltersChange?.(nextFilters);
  };

  const handleCrewListChange = (key, value) => {
    const nextDefaults = {
      ...crewListDefaults,
      [key]: value
    };
    onCrewListDefaultsChange?.(nextDefaults);
  };

  const handleResetLogFilters = () => {
    onDefaultLogFiltersChange?.(createDefaultLogFilters());
  };

  const handleResetCrewDefaults = () => {
    onCrewListDefaultsChange?.({ statusFilter: 'all', sortOption: 'name-asc', view: 'grid' });
  };

  return (
    <div className="space-y-8 text-gray-900 dark:text-gray-100">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
          <SlidersHorizontal className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">User Preferences</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Customize your experience with appearance, monitoring, and crew list defaults. Changes are saved to your browser.
          </p>
        </div>
      </div>

      <section className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header>
          <h3 className="text-lg font-medium">Appearance</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Choose the interface theme and preferred log font size for better readability.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">Theme</legend>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onThemeChange?.('light')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  theme === 'light'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'
                }`}
              >
                <Sun className="h-4 w-4" />
                Light
              </button>
              <button
                type="button"
                onClick={() => onThemeChange?.('dark')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/20 dark:text-blue-100'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300'
                }`}
              >
                <Moon className="h-4 w-4" />
                Dark
              </button>
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="settings-log-font-size"
              className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Log font size
            </label>
            <select
              id="settings-log-font-size"
              value={logFontSize}
              onChange={(event) => onLogFontSizeChange?.(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            >
              {LOG_FONT_SIZE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Default log filters</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Configure the default filters applied to crew execution logs when opening the monitor.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetLogFilters}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Reset
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="settings-log-level"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Log level
            </label>
            <select
              id="settings-log-level"
              value={defaultLogFilters.level}
              onChange={(event) => handleLogFilterChange('level', event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            >
              {LOG_LEVEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-log-time-range"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Time range
            </label>
            <select
              id="settings-log-time-range"
              value={defaultLogFilters.timeRange}
              onChange={(event) => handleLogFilterChange('timeRange', event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            >
              {TIME_RANGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-log-agent"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Agent
            </label>
            <input
              id="settings-log-agent"
              type="text"
              value={defaultLogFilters.agent === 'all' ? '' : defaultLogFilters.agent}
              placeholder="All agents"
              onChange={(event) => handleLogFilterChange('agent', event.target.value.trim() === '' ? 'all' : event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank to include all agents.</p>
          </div>

          <div>
            <label
              htmlFor="settings-log-category"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Category
            </label>
            <input
              id="settings-log-category"
              type="text"
              value={defaultLogFilters.category === 'all' ? '' : defaultLogFilters.category}
              placeholder="All categories"
              onChange={(event) => handleLogFilterChange('category', event.target.value.trim() === '' ? 'all' : event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank to include all categories.</p>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="settings-log-search"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Search term
            </label>
            <input
              id="settings-log-search"
              type="text"
              value={defaultLogFilters.search}
              placeholder="Enter keywords to search within log messages"
              onChange={(event) => handleLogFilterChange('search', event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            />
          </div>
        </div>
      </section>

      <section className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Crew list defaults</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Select the default status filter and sorting applied to the crew sidebar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetCrewDefaults}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Reset
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="settings-status-filter"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Status filter
            </label>
            <select
              id="settings-status-filter"
              value={crewListDefaults.statusFilter}
              onChange={(event) => handleCrewListChange('statusFilter', event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            >
              <option value="all">All statuses</option>
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="settings-sort-order"
              className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-200"
            >
              Sort order
            </label>
            <select
              id="settings-sort-order"
              value={crewListDefaults.sortOption}
              onChange={(event) => handleCrewListChange('sortOption', event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:ring-offset-slate-900"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
