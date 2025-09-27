import React, { useMemo } from 'react';
import { Play, Square, Edit3, Copy, Trash2, XCircle } from 'lucide-react';

const createConditionId = (field) => `${field}-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`;

const toTitleCase = (value) => {
  if (!value) {
    return '';
  }

  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeArray = (values) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(value => String(value).trim().toLowerCase())
    .filter(Boolean);
};

const ensureConfigShape = (config) => {
  const combinator = config?.combinator === 'OR' ? 'OR' : 'AND';
  const conditions = Array.isArray(config?.conditions) ? [...config.conditions] : [];
  return { combinator, conditions };
};

const CrewSidebar = ({
  crews = [],
  crewsLoading = false,
  filteredCrews = [],
  availableStatusFilters = [],
  availableTagFilters = [],
  filterConfig,
  onFilterConfigChange,
  searchQuery = '',
  onSearchChange,
  sortOption = 'name-asc',
  onSortChange,
  runningCrews,
  crewLogs,
  selectedCrewId,
  onSelectCrew,
  onCloseEditor,
  onRunCrew,
  onStopCrew,
  onEditCrew,
  onCloneCrew,
  onDeleteCrew
}) => {
  const { selectedStatuses, selectedTags } = useMemo(() => {
    const normalizedConfig = ensureConfigShape(filterConfig);
    const conditions = normalizedConfig.conditions;

    const findCondition = (field) => conditions.find(condition => condition?.field === field) || null;

    const statusCondition = findCondition('status');
    const tagCondition = findCondition('tags');

    return {
      selectedStatuses: new Set(normalizeArray(statusCondition?.value)),
      selectedTags: new Set(normalizeArray(tagCondition?.value))
    };
  }, [filterConfig]);

  const normalizedStatusOptions = useMemo(() => (
    Array.isArray(availableStatusFilters)
      ? availableStatusFilters
        .map(value => ({
          value: String(value || '').trim().toLowerCase(),
          label: toTitleCase(value || '') || 'Unknown'
        }))
        .filter(option => option.value.length > 0)
      : []
  ), [availableStatusFilters]);

  const normalizedTagOptions = useMemo(() => (
    Array.isArray(availableTagFilters)
      ? availableTagFilters
        .map(value => ({
          value: String(value || '').trim().toLowerCase(),
          label: value && value.length ? value : '(untagged)'
        }))
        .filter(option => option.value.length > 0)
      : []
  ), [availableTagFilters]);

  const formatLastRun = (crewId) => {
    const logs = crewLogs?.[crewId] ?? [];
    if (!Array.isArray(logs) || logs.length === 0) {
      return 'Never run';
    }

    const latest = logs[logs.length - 1];
    const timestamp = latest?.timestamp;
    if (!timestamp) {
      return 'Activity detected';
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (Number.isNaN(date?.getTime?.())) {
      return 'Activity detected';
    }

    try {
      return `Last activity ${new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date)}`;
    } catch (error) {
      return `Last activity ${date.toISOString()}`;
    }
  };

  const isCrewRunning = (crewId) => {
    if (!crewId) {
      return false;
    }

    if (runningCrews instanceof Set) {
      return runningCrews.has(crewId);
    }

    if (Array.isArray(runningCrews)) {
      return runningCrews.includes(crewId);
    }

    return false;
  };

  const updateCondition = (field, resolver) => {
    if (typeof onFilterConfigChange !== 'function') {
      return;
    }

    onFilterConfigChange((previousConfig) => {
      const normalized = ensureConfigShape(previousConfig);
      const conditions = [...normalized.conditions];
      const index = conditions.findIndex(condition => condition?.field === field);
      const currentCondition = index >= 0 ? conditions[index] : null;
      const nextCondition = resolver(currentCondition);

      if (!nextCondition || (Array.isArray(nextCondition.value) && nextCondition.value.length === 0)) {
        if (index >= 0) {
          conditions.splice(index, 1);
        }
      } else {
        const baseCondition = {
          id: currentCondition?.id ?? createConditionId(field),
          field,
          operator: nextCondition.operator || currentCondition?.operator || 'includesAny',
          value: nextCondition.value
        };

        if (field === 'status' || field === 'tags') {
          baseCondition.value = normalizeArray(baseCondition.value);
        }

        if (index >= 0) {
          conditions[index] = baseCondition;
        } else {
          conditions.push(baseCondition);
        }
      }

      return {
        combinator: normalized.combinator,
        conditions
      };
    });
  };

  const handleToggleStatus = (status) => {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    if (!normalizedStatus) {
      return;
    }

    updateCondition('status', (condition) => {
      const nextValues = new Set(normalizeArray(condition?.value));
      if (nextValues.has(normalizedStatus)) {
        nextValues.delete(normalizedStatus);
      } else {
        nextValues.add(normalizedStatus);
      }

      if (nextValues.size === 0) {
        return null;
      }

      return {
        operator: condition?.operator === 'includesAll' ? 'includesAll' : 'includesAny',
        value: Array.from(nextValues)
      };
    });
  };

  const handleToggleTag = (tag) => {
    const normalizedTag = String(tag || '').trim().toLowerCase();
    if (!normalizedTag) {
      return;
    }

    updateCondition('tags', (condition) => {
      const nextValues = new Set(normalizeArray(condition?.value));
      if (nextValues.has(normalizedTag)) {
        nextValues.delete(normalizedTag);
      } else {
        nextValues.add(normalizedTag);
      }

      if (nextValues.size === 0) {
        return null;
      }

      return {
        operator: condition?.operator === 'includesAll' ? 'includesAll' : 'includesAny',
        value: Array.from(nextValues)
      };
    });
  };

  const handleClearFilters = () => {
    if (typeof onFilterConfigChange === 'function') {
      onFilterConfigChange({ combinator: 'AND', conditions: [] });
    }
  };

  const handleSelectCrew = (crew) => {
    if (!crew) {
      return;
    }

    if (typeof onSelectCrew === 'function') {
      onSelectCrew({ ...crew, id: String(crew.id) });
    }

    if (typeof onCloseEditor === 'function') {
      onCloseEditor();
    }
  };

  return (
    <div className="space-y-6 text-sm text-gray-700 dark:text-gray-200">
      <section className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="crew-sidebar-search" className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Search crews
          </label>
          <input
            id="crew-sidebar-search"
            type="search"
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search by name, status, or tag"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:ring-offset-slate-900"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="crew-sidebar-sort" className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Sort by
          </label>
          <select
            id="crew-sidebar-sort"
            value={sortOption}
            onChange={onSortChange}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:ring-offset-slate-900"
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="lastRun-desc">Last activity (newest)</option>
            <option value="lastRun-asc">Last activity (oldest)</option>
            <option value="agents-desc">Agent count (high to low)</option>
            <option value="agents-asc">Agent count (low to high)</option>
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Filters</h3>
          <button
            type="button"
            onClick={handleClearFilters}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>

        {normalizedStatusOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Status</p>
            <div className="flex flex-wrap gap-2">
              {normalizedStatusOptions.map(option => {
                const isActive = selectedStatuses.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleToggleStatus(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {normalizedTagOptions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tags</p>
            <div className="flex flex-wrap gap-2">
              {normalizedTagOptions.map(option => {
                const isActive = selectedTags.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleToggleTag(option.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Crews ({filteredCrews.length}/{crews.length})
          </h3>
        </div>
        {crewsLoading ? (
          <div className="space-y-2" data-testid="crew-sidebar-skeleton">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-lg border border-gray-200 bg-gray-100 p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-3 w-1/2 rounded bg-gray-300 dark:bg-slate-700" />
                <div className="mt-2 h-2 w-1/3 rounded bg-gray-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        ) : filteredCrews.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No crews match the current filters.</p>
        ) : (
          <ul className="space-y-3">
            {filteredCrews.map((crew) => {
              const crewId = String(crew?.id ?? '');
              const isSelected = selectedCrewId != null && String(selectedCrewId) === crewId;
              const running = isCrewRunning(crewId);
              const agentCount = Array.isArray(crew?.agents) ? crew.agents.length : 0;
              const taskCount = Array.isArray(crew?.tasks) ? crew.tasks.length : 0;

              return (
                <li key={crewId} className={`rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-200'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => handleSelectCrew(crew)}
                    className="w-full text-left"
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{crew?.name || crewId}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{crew?.description || 'No description provided.'}</p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {agentCount} {agentCount === 1 ? 'agent' : 'agents'} · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatLastRun(crewId)}</p>
                    {running && (
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-300">Currently running</p>
                    )}
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onRunCrew?.(crewId)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={running}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => onStopCrew?.(crewId)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-amber-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                      disabled={!running}
                    >
                      <Square className="h-3.5 w-3.5" />
                      Stop
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditCrew?.(crewId)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onCloneCrew?.(crewId)}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Clone
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteCrew?.(crewId)}
                      className="col-span-2 inline-flex items-center justify-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default CrewSidebar;
