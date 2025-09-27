import React, { useCallback } from 'react';
import { FolderOpen, LayoutGrid, List } from 'lucide-react';

import CrewCard from '../../../../components/CrewCard';
import { SORT_OPTIONS } from '../crewListOptions';
import { useCrewFiltersContext, useCrewManagerState } from './useCrewManagerState';

const formatStatusLabel = (status) => {
  if (!status || status === 'all') {
    return 'All statuses';
  }

  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const CrewList = ({
  crewListView = 'grid',
  setCrewListPreferences,
  onSelectCrew,
  onOpenCrewPage,
  onStartCrew,
  onStopCrew,
  onEditCrew,
  onCloneCrew,
  onDeleteCrew,
}) => {
  const {
    crews = [],
    crewsLoading = false,
    runningCrews,
    selectedCrew,
    crewLogs = {},
    closeEditor,
  } = useCrewManagerState();
  const {
    filteredCrews = [],
    searchQuery = '',
    setSearchQuery,
    statusFilter = 'all',
    setStatusFilter,
    availableStatusFilters = [],
    sortOption = 'name-asc',
    setSortOption,
  } = useCrewFiltersContext();

  const selectedCrewIdString = selectedCrew ? String(selectedCrew.id) : null;

  const handleCrewCardSelect = useCallback((crewValue) => {
    if (!crewValue) {
      onSelectCrew?.(null);
      return;
    }

    const baseCrew = typeof crewValue === 'object' && crewValue !== null
      ? crewValue
      : { id: crewValue };

    const crewId = baseCrew?.id != null ? String(baseCrew.id) : '';

    if (!crewId) {
      onSelectCrew?.(null);
      return;
    }

    const normalizedCrew = {
      ...baseCrew,
      id: crewId
    };

    if (typeof onOpenCrewPage === 'function') {
      onOpenCrewPage(normalizedCrew);
      return;
    }

    onSelectCrew?.(normalizedCrew);
  }, [onOpenCrewPage, onSelectCrew]);

  const shouldShowPlaceholder = !selectedCrew;

  const normalizedView = crewListView === 'list' ? 'list' : 'grid';
  const statusOptions = ['all'];

  if (Array.isArray(availableStatusFilters)) {
    availableStatusFilters.forEach((value) => {
      const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (normalized && !statusOptions.includes(normalized)) {
        statusOptions.push(normalized);
      }
    });
  }

  const gridClasses = normalizedView === 'list'
    ? 'grid grid-cols-1 gap-4'
    : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

  const handleViewChange = (nextView) => {
    if (nextView !== normalizedView) {
      setCrewListPreferences?.({ view: nextView });
    }
  };

  const skeletonCount = normalizedView === 'list' ? 4 : 8;

  return (
    <div className="relative min-h-full">
      <div className="p-6">
        <div className="space-y-6">
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-end">
                <div className="flex flex-1 flex-col gap-1">
                  <label
                    htmlFor="crew-grid-search"
                    className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Search crews
                  </label>
                  <input
                    id="crew-grid-search"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery?.(event.target.value)}
                    placeholder="Search by name, agent, task, or status..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:ring-offset-slate-900"
                  />
                </div>
                <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="crew-status-filter"
                      className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                      Status
                    </label>
                    <select
                      id="crew-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter?.(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:ring-offset-slate-900"
                    >
                      {statusOptions.map(option => (
                        <option key={option} value={option}>
                          {formatStatusLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="crew-sort-option"
                      className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                    >
                      Sort by
                    </label>
                    <select
                      id="crew-sort-option"
                      value={sortOption}
                      onChange={(event) => setSortOption?.(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:ring-offset-slate-900"
                    >
                      {SORT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    View
                  </span>
                  <div className="inline-flex rounded-lg border border-gray-200 p-1 dark:border-slate-700">
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        normalizedView === 'grid'
                          ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => handleViewChange('grid')}
                      aria-pressed={normalizedView === 'grid'}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Grid
                    </button>
                    <button
                      type="button"
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        normalizedView === 'list'
                          ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-500'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800'
                      }`}
                      onClick={() => handleViewChange('list')}
                      aria-pressed={normalizedView === 'list'}
                    >
                      <List className="h-4 w-4" />
                      List
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {crewsLoading ? (
            <div className={gridClasses} data-testid="crew-grid-skeleton">
              {Array.from({ length: skeletonCount }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  data-testid="crew-card-skeleton"
                >
                  <div className="mb-3 h-5 w-1/2 rounded bg-gray-200 dark:bg-slate-800" />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-20 rounded bg-gray-200 dark:bg-slate-800" />
                    <div className="h-3 w-12 rounded bg-gray-100 dark:bg-slate-700" />
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-full rounded bg-gray-100 dark:bg-slate-800" />
                    <div className="h-3 w-3/4 rounded bg-gray-100 dark:bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCrews.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300">
              {crews.length === 0
                ? 'No crews available yet. Import a crew to get started.'
                : 'No crews match your current search.'}
            </div>
          ) : (
            <div className={gridClasses} data-testid="crew-grid">
              {filteredCrews.map((crew) => {
                const crewIdString = crew?.id != null ? String(crew.id) : '';
                const isCrewRunning = (() => {
                  if (!crewIdString) {
                    return false;
                  }

                  if (runningCrews && typeof runningCrews.has === 'function') {
                    return runningCrews.has(crewIdString);
                  }

                  if (Array.isArray(runningCrews)) {
                    return runningCrews.includes(crewIdString);
                  }

                  if (runningCrews && typeof runningCrews === 'object') {
                    return Boolean(runningCrews[crewIdString]);
                  }

                  return false;
                })();

                const deriveCrewId = (value) => (
                  typeof value === 'object' && value !== null ? value.id ?? value : value
                );

                const mapCrewArgument = (callback) => (
                  typeof callback === 'function'
                    ? (value) => callback(deriveCrewId(value))
                    : undefined
                );

                const fallbackRunStats = {
                  lastRun: crew?.lastRun ?? crew?.last_run ?? crew?.lastRunAt ?? crew?.last_run_at ?? null,
                  totalExecutions: crew?.totalExecutions ?? crew?.total_runs ?? crew?.runCount
                };

                return (
                  <CrewCard
                    key={String(crew.id)}
                    crew={crew}
                    selectedCrewId={selectedCrewIdString}
                    crewLogs={crewLogs}
                    isRunning={isCrewRunning}
                    runStats={crew?.runStats || fallbackRunStats}
                    onSelect={handleCrewCardSelect}
                    onRun={mapCrewArgument(onStartCrew)}
                    onStop={mapCrewArgument(onStopCrew)}
                    onEdit={mapCrewArgument(onEditCrew)}
                    onClone={mapCrewArgument(onCloneCrew)}
                    onDelete={mapCrewArgument(onDeleteCrew)}
                    onCloseEditor={closeEditor}
                  />
                );
              })}
            </div>
          )}
        </div>

        {shouldShowPlaceholder ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="flex min-h-full w-full items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FolderOpen className="mx-auto mb-4 h-16 w-16 opacity-50" />
                <p className="mb-2 text-xl">Select a crew to get started</p>
                <p>Select a crew to open its full-page details.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CrewList;
