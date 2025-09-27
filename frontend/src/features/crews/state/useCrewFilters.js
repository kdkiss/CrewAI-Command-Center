import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createDefaultLogFilters } from '../../../components/logs/utils';
import { normalizeLogLevel } from './crewUtils';

const DEFAULT_STATUS_FILTER = 'all';
const DEFAULT_SORT_OPTION = 'name-asc';
const DEFAULT_STATUS_FILTER_CONDITION_ID = 'default-status-filter';

const createFilterConditionId = () => `condition-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

const sanitizeCondition = (condition) => {
  if (!condition || typeof condition !== 'object') {
    return null;
  }

  const rawField = typeof condition.field === 'string' ? condition.field : 'status';
  const field = ['status', 'tags'].includes(rawField) ? rawField : 'status';

  const rawValues = Array.isArray(condition.value) ? condition.value : [];
  const normalizedValues = Array.from(new Set(rawValues.map(value => String(value).toLowerCase()).filter(Boolean)));
  const operator = condition.operator === 'includesAll' ? 'includesAll' : 'includesAny';

  return {
    id: typeof condition.id === 'string' ? condition.id : createFilterConditionId(),
    field,
    operator,
    value: normalizedValues
  };
};

const sanitizeFilterConfig = (config) => {
  const combinator = config?.combinator === 'OR' ? 'OR' : 'AND';
  const conditions = Array.isArray(config?.conditions)
    ? config.conditions.map(sanitizeCondition).filter(Boolean)
    : [];

  return {
    combinator,
    conditions
  };
};

const createDefaultFilterConfig = () => sanitizeFilterConfig({ combinator: 'AND', conditions: [] });

const canonicalizeFilterConfig = (config) => {
  const sanitized = sanitizeFilterConfig(config);

  const canonicalConditions = sanitized.conditions
    .map((condition) => {
      if (!condition) {
        return null;
      }

      const base = {
        field: condition.field,
        operator: condition.operator
      };

      const values = Array.isArray(condition.value) ? [...condition.value] : [];
      values.sort();

      return {
        ...base,
        value: values
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.field !== b.field) {
        return a.field.localeCompare(b.field);
      }

      if (a.operator !== b.operator) {
        return a.operator.localeCompare(b.operator);
      }

      const aValue = Array.isArray(a.value) ? a.value.join('\u0000') : String(a.value || '');
      const bValue = Array.isArray(b.value) ? b.value.join('\u0000') : String(b.value || '');
      return aValue.localeCompare(bValue);
    });

  return JSON.stringify({
    combinator: sanitized.combinator,
    conditions: canonicalConditions
  });
};

const areFilterConfigsEqual = (a, b) => canonicalizeFilterConfig(a) === canonicalizeFilterConfig(b);

const createStatusFilterConfig = (status) => {
  const normalized = typeof status === 'string' ? status.trim().toLowerCase() : '';

  if (!normalized || normalized === 'all') {
    return createDefaultFilterConfig();
  }

  return sanitizeFilterConfig({
    combinator: 'AND',
    conditions: [
      {
        id: DEFAULT_STATUS_FILTER_CONDITION_ID,
        field: 'status',
        operator: 'includesAny',
        value: [normalized]
      }
    ]
  });
};

export const evaluateCrewFilter = (metadata, filterConfig, nowTs = Date.now()) => {
  const normalizedConfig = sanitizeFilterConfig(filterConfig);
  if (normalizedConfig.conditions.length === 0) {
    return true;
  }

  const evaluateCondition = (condition) => {
    if (!condition) {
      return true;
    }

    switch (condition.field) {
      case 'status': {
        if (!Array.isArray(condition.value) || condition.value.length === 0) {
          return true;
        }
        const targetSet = metadata?.statusTokens instanceof Set ? metadata.statusTokens : new Set();
        if (condition.operator === 'includesAll') {
          return condition.value.every(value => targetSet.has(String(value).toLowerCase()));
        }
        return condition.value.some(value => targetSet.has(String(value).toLowerCase()));
      }
      case 'tags': {
        if (!Array.isArray(condition.value) || condition.value.length === 0) {
          return true;
        }
        const tagSet = metadata?.tagTokens instanceof Set ? metadata.tagTokens : new Set();
        if (condition.operator === 'includesAll') {
          return condition.value.every(value => tagSet.has(String(value).toLowerCase()));
        }
        return condition.value.some(value => tagSet.has(String(value).toLowerCase()));
      }
      default:
        return true;
    }
  };

  const results = normalizedConfig.conditions.map(evaluateCondition);
  return normalizedConfig.combinator === 'OR'
    ? results.some(Boolean)
    : results.every(Boolean);
};

const buildPreferredLogFilters = (getPreferredLogFilters) => {
  const baseFilters = createDefaultLogFilters();

  if (typeof getPreferredLogFilters !== 'function') {
    return baseFilters;
  }

  try {
    const preferredFilters = getPreferredLogFilters();

    if (preferredFilters && typeof preferredFilters === 'object') {
      return { ...baseFilters, ...preferredFilters };
    }
  } catch (error) {
    console.warn('Failed to resolve preferred log filters', error);
  }

  return baseFilters;
};

const areLogFiltersEqual = (a, b) => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

const useCrewFilters = ({
  crews,
  crewLogs,
  runningCrews,
  defaultStatusFilter = DEFAULT_STATUS_FILTER,
  defaultSortOption = DEFAULT_SORT_OPTION,
  getPreferredLogFilters
}) => {
  const normalizedStatusFilter = typeof defaultStatusFilter === 'string'
    ? defaultStatusFilter.trim().toLowerCase()
    : '';
  const resolvedStatusFilter = normalizedStatusFilter || DEFAULT_STATUS_FILTER;
  const resolvedSortOption = typeof defaultSortOption === 'string' && defaultSortOption.trim()
    ? defaultSortOption
    : DEFAULT_SORT_OPTION;

  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState(resolvedSortOption);
  const [filterConfigState, setFilterConfigState] = useState(() => createStatusFilterConfig(resolvedStatusFilter));
  const [logFilters, setLogFilters] = useState(() => buildPreferredLogFilters(getPreferredLogFilters));
  const lastResolvedStatusFilterRef = useRef(resolvedStatusFilter);

  const filterConfig = filterConfigState;

  useEffect(() => {
    setFilterConfigState((current) => {
      const previousStatus = lastResolvedStatusFilterRef.current;
      const nextStatus = resolvedStatusFilter;

      if (previousStatus === nextStatus) {
        return current;
      }

      const previousConfig = createStatusFilterConfig(previousStatus);
      const nextConfig = createStatusFilterConfig(nextStatus);

      lastResolvedStatusFilterRef.current = nextStatus;

      if (!areFilterConfigsEqual(current, previousConfig)) {
        return current;
      }

      return nextConfig;
    });
  }, [resolvedStatusFilter]);

  useEffect(() => {
    setSortOption((current) => (current === resolvedSortOption ? current : resolvedSortOption));
  }, [resolvedSortOption]);

  useEffect(() => {
    setLogFilters((current) => {
      const next = buildPreferredLogFilters(getPreferredLogFilters);
      return areLogFiltersEqual(current, next) ? current : next;
    });
  }, [getPreferredLogFilters]);

  const updateFilterConfig = useCallback((updater) => {
    setFilterConfigState((previous) => {
      const nextConfig = typeof updater === 'function' ? updater(previous) : updater;
      return sanitizeFilterConfig(nextConfig);
    });
  }, []);

  const setStatusFilter = useCallback((nextStatus) => {
    updateFilterConfig(createStatusFilterConfig(nextStatus));
  }, [updateFilterConfig]);

  const statusFilter = useMemo(() => {
    const normalized = sanitizeFilterConfig(filterConfig);
    const defaultConfig = createDefaultFilterConfig();

    if (areFilterConfigsEqual(normalized, defaultConfig)) {
      return DEFAULT_STATUS_FILTER;
    }

    if (normalized.combinator !== 'AND' || normalized.conditions.length !== 1) {
      return DEFAULT_STATUS_FILTER;
    }

    const [condition] = normalized.conditions;

    if (
      !condition ||
      condition.field !== 'status' ||
      condition.operator !== 'includesAny'
    ) {
      return DEFAULT_STATUS_FILTER;
    }

    const values = Array.isArray(condition.value) ? condition.value : [];

    if (values.length !== 1) {
      return DEFAULT_STATUS_FILTER;
    }

    const value = String(values[0] || '').trim().toLowerCase();
    return value || DEFAULT_STATUS_FILTER;
  }, [filterConfig]);

  const resetLogFilters = useCallback(() => {
    setLogFilters(buildPreferredLogFilters(getPreferredLogFilters));
  }, [getPreferredLogFilters]);

  const createPreferredLogFiltersMemo = useCallback(
    () => buildPreferredLogFilters(getPreferredLogFilters),
    [getPreferredLogFilters]
  );

  const { filteredCrews, availableStatusFilters, availableTagFilters } = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const runningCrewSet = runningCrews instanceof Set
      ? runningCrews
      : new Set(
        Array.isArray(runningCrews)
          ? runningCrews.map(id => String(id))
          : []
      );

    const statusesSet = new Set();
    const tagsSet = new Set();
    const nowTs = Date.now();

    const metadata = crews.map(crew => {
      const crewId = String(crew?.id ?? '');
      const logs = crewLogs?.[crewId] ?? [];
      const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
      const normalizedLevel = normalizeLogLevel(latestLog?.level);
      const baseStatus = crew?.status ? String(crew.status).toLowerCase() : 'unknown';
      const isRunning = crewId && runningCrewSet.has(crewId);

      const statusTokens = new Set([
        baseStatus,
        normalizedLevel
      ].filter(Boolean).map(token => String(token).toLowerCase()));

      const tagTokens = new Set(
        Array.isArray(crew?.tags)
          ? crew.tags.map(tag => String(tag).toLowerCase()).filter(Boolean)
          : []
      );

      if (isRunning) {
        statusTokens.add('running');
      }

      statusTokens.forEach(token => statusesSet.add(token));
      tagTokens.forEach(token => tagsSet.add(token));

      const searchCorpus = [
        crew?.name || '',
        crew?.description || '',
        ...(crew?.agents || []).map(agent => typeof agent === 'object' ? `${agent.name || ''} ${agent.role || ''}` : String(agent)),
        ...(crew?.tasks || []).map(task => typeof task === 'object' ? `${task.name || ''} ${task.description || ''}` : String(task)),
        ...Array.from(statusTokens),
        ...Array.from(tagTokens)
      ].join(' ').toLowerCase();

      const lastLog = logs[logs.length - 1];
      const timestamp = lastLog?.timestamp instanceof Date ? lastLog.timestamp.getTime() : Date.parse(lastLog?.timestamp);
      const lastRunTs = typeof timestamp === 'number' && Number.isFinite(timestamp) ? timestamp : null;

      return {
        crew,
        name: crew?.name || '',
        statusTokens,
        tagTokens,
        searchCorpus,
        lastRunTs,
        agentCount: Array.isArray(crew?.agents) ? crew.agents.length : 0
      };
    });

    filterConfig.conditions.forEach((condition) => {
      if (condition.field === 'status' && Array.isArray(condition.value)) {
        condition.value.forEach(value => {
          const normalized = String(value || '').toLowerCase();
          if (normalized) {
            statusesSet.add(normalized);
          }
        });
      }

      if (condition.field === 'tags' && Array.isArray(condition.value)) {
        condition.value.forEach(value => {
          const normalized = String(value || '').toLowerCase();
          if (normalized) {
            tagsSet.add(normalized);
          }
        });
      }
    });

    const matchesQuery = (meta) => {
      if (!normalizedQuery) {
        return true;
      }
      return meta.searchCorpus.includes(normalizedQuery);
    };

    const matchesFilterConfig = (meta) => evaluateCrewFilter(meta, filterConfig, nowTs);

    const filteredMetadata = metadata
      .filter(meta => matchesQuery(meta) && matchesFilterConfig(meta));

    const sortedMetadata = [...filteredMetadata].sort((a, b) => {
      switch (sortOption) {
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'last-run-desc': {
          const aTs = a.lastRunTs ?? 0;
          const bTs = b.lastRunTs ?? 0;
          return bTs - aTs;
        }
        case 'last-run-asc': {
          const aTs = a.lastRunTs ?? Number.POSITIVE_INFINITY;
          const bTs = b.lastRunTs ?? Number.POSITIVE_INFINITY;
          return aTs - bTs;
        }
        case 'agents-desc':
          return (b.agentCount ?? 0) - (a.agentCount ?? 0);
        case 'agents-asc':
          return (a.agentCount ?? 0) - (b.agentCount ?? 0);
        case 'name-asc':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    const sortedStatuses = Array.from(statusesSet).sort();
    const sortedTags = Array.from(tagsSet).sort();

    return {
      filteredCrews: sortedMetadata.map(meta => meta.crew),
      availableStatusFilters: sortedStatuses,
      availableTagFilters: sortedTags
    };
  }, [crews, crewLogs, runningCrews, searchQuery, sortOption, filterConfig]);

  return {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    filterConfig,
    updateFilterConfig,
    statusFilter,
    setStatusFilter,
    logFilters,
    setLogFilters,
    resetLogFilters,
    createPreferredLogFilters: createPreferredLogFiltersMemo,
    filteredCrews,
    availableStatusFilters,
    availableTagFilters
  };
};

export {
  DEFAULT_STATUS_FILTER,
  DEFAULT_SORT_OPTION,
  DEFAULT_STATUS_FILTER_CONDITION_ID,
  createStatusFilterConfig,
  sanitizeFilterConfig,
  createDefaultFilterConfig,
  areFilterConfigsEqual
};

export default useCrewFilters;
