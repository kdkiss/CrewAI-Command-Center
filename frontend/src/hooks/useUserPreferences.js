import { useCallback, useEffect, useRef, useState } from 'react';

import { createDefaultLogFilters } from '../components/logs/utils';

const STORAGE_KEY = 'crew-manager-preferences';
const VALID_THEMES = new Set(['light', 'dark']);
const VALID_FONT_SIZES = new Set(['small', 'medium', 'large']);
const VALID_LOG_LEVELS = new Set(['all', 'info', 'warning', 'error', 'debug']);
const VALID_TIME_RANGES = new Set(['all', '5m', '15m', '1h', 'today']);
const VALID_SORT_OPTIONS = new Set([
  'name-asc',
  'name-desc',
  'lastRun-desc',
  'lastRun-asc',
  'agents-desc',
  'agents-asc'
]);
const VALID_CREW_LIST_VIEWS = new Set(['grid', 'list']);

const DEFAULT_STATUS_FILTER = 'all';
const DEFAULT_SORT_OPTION = 'name-asc';

const readStoredPreferences = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch (error) {
    console.warn('Failed to parse stored preferences', error);
    return null;
  }
};

const getSystemTheme = () => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  return 'light';
};

const sanitizeLogFilters = (filters) => {
  const baseFilters = createDefaultLogFilters();

  if (!filters || typeof filters !== 'object') {
    return baseFilters;
  }

  const sanitized = { ...baseFilters };

  if (typeof filters.level === 'string') {
    const normalized = filters.level.toLowerCase();
    sanitized.level = VALID_LOG_LEVELS.has(normalized) ? normalized : baseFilters.level;
  }

  if (typeof filters.agent === 'string') {
    sanitized.agent = filters.agent.trim() === '' ? baseFilters.agent : filters.agent;
  }

  if (typeof filters.category === 'string') {
    sanitized.category = filters.category.trim() === '' ? baseFilters.category : filters.category;
  }

  if (typeof filters.timeRange === 'string') {
    const normalized = filters.timeRange.toLowerCase();
    sanitized.timeRange = VALID_TIME_RANGES.has(normalized) ? normalized : baseFilters.timeRange;
  }

  if (typeof filters.search === 'string') {
    sanitized.search = filters.search;
  }

  return sanitized;
};

const sanitizeCrewList = (value) => {
  const base = {
    statusFilter: DEFAULT_STATUS_FILTER,
    sortOption: DEFAULT_SORT_OPTION,
    view: 'grid'
  };

  if (!value || typeof value !== 'object') {
    return base;
  }

  const statusFilter = typeof value.statusFilter === 'string' && value.statusFilter.trim() !== ''
    ? value.statusFilter
    : base.statusFilter;

  const sortOption = typeof value.sortOption === 'string' && VALID_SORT_OPTIONS.has(value.sortOption)
    ? value.sortOption
    : base.sortOption;

  const view = typeof value.view === 'string' && VALID_CREW_LIST_VIEWS.has(value.view)
    ? value.view
    : base.view;

  return {
    statusFilter,
    sortOption,
    view
  };
};

const areShallowEqual = (a, b) => {
  if (a === b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

const getInitialPreferences = () => {
  const stored = readStoredPreferences();
  const systemTheme = getSystemTheme();
  const storedTheme = typeof stored?.theme === 'string' ? stored.theme.toLowerCase() : null;
  const hasExplicitTheme = Boolean(stored?.themeExplicit) && VALID_THEMES.has(storedTheme);

  return {
    theme: hasExplicitTheme ? storedTheme : systemTheme,
    themeExplicit: hasExplicitTheme,
    logFontSize: VALID_FONT_SIZES.has(stored?.logFontSize) ? stored.logFontSize : 'medium',
    defaultLogFilters: sanitizeLogFilters(stored?.defaultLogFilters),
    crewList: sanitizeCrewList(stored?.crewList)
  };
};

const useUserPreferences = () => {
  const [preferences, setPreferences] = useState(getInitialPreferences);
  const hasExplicitThemePreferenceRef = useRef(preferences.themeExplicit);

  useEffect(() => {
    hasExplicitThemePreferenceRef.current = preferences.themeExplicit;
  }, [preferences.themeExplicit]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const root = document.documentElement;
    root.style.colorScheme = preferences.theme;

    if (preferences.theme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
    }

    return undefined;
  }, [preferences.theme]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applySystemTheme = (isDark) => {
      setPreferences((current) => {
        if (hasExplicitThemePreferenceRef.current) {
          return current;
        }

        const nextTheme = isDark ? 'dark' : 'light';
        if (current.theme === nextTheme && !current.themeExplicit) {
          return current;
        }

        return {
          ...current,
          theme: nextTheme,
          themeExplicit: false
        };
      });
    };

    applySystemTheme(mediaQuery.matches);

    const handleSystemThemeChange = (event) => {
      applySystemTheme(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }

    mediaQuery.addListener(handleSystemThemeChange);
    return () => mediaQuery.removeListener(handleSystemThemeChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    try {
      const serialized = JSON.stringify(preferences);
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
      console.warn('Failed to persist preferences', error);
    }

    return undefined;
  }, [preferences]);

  const setTheme = useCallback((nextTheme) => {
    if (!VALID_THEMES.has(nextTheme)) {
      return;
    }

    setPreferences((current) => {
      if (current.theme === nextTheme && current.themeExplicit) {
        return current;
      }

      return {
        ...current,
        theme: nextTheme,
        themeExplicit: true
      };
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferences((current) => {
      const nextTheme = current.theme === 'dark' ? 'light' : 'dark';

      return {
        ...current,
        theme: nextTheme,
        themeExplicit: true
      };
    });
  }, []);

  const setLogFontSize = useCallback((nextSize) => {
    const normalized = VALID_FONT_SIZES.has(nextSize) ? nextSize : 'medium';

    setPreferences((current) => {
      if (current.logFontSize === normalized) {
        return current;
      }

      return {
        ...current,
        logFontSize: normalized
      };
    });
  }, []);

  const setDefaultLogFilters = useCallback((nextFilters) => {
    const sanitized = sanitizeLogFilters(nextFilters);

    setPreferences((current) => {
      if (areShallowEqual(current.defaultLogFilters, sanitized)) {
        return current;
      }

      return {
        ...current,
        defaultLogFilters: sanitized
      };
    });
  }, []);

  const setCrewListPreferences = useCallback((updates) => {
    setPreferences((current) => {
      const sanitized = sanitizeCrewList({ ...current.crewList, ...updates });

      if (areShallowEqual(current.crewList, sanitized)) {
        return current;
      }

      return {
        ...current,
        crewList: sanitized
      };
    });
  }, []);

  return {
    preferences,
    setTheme,
    toggleTheme,
    setLogFontSize,
    setDefaultLogFilters,
    setCrewListPreferences
  };
};

export default useUserPreferences;
