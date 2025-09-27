import { act, renderHook } from '@testing-library/react';

import { createDefaultLogFilters } from '../../components/logs/utils';
import useUserPreferences from '../useUserPreferences';

describe('useUserPreferences', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = jest.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn()
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('initializes with default preferences', () => {
    const { result } = renderHook(() => useUserPreferences());

    expect(result.current.preferences.theme).toBe('light');
    expect(result.current.preferences.logFontSize).toBe('medium');
    expect(result.current.preferences.defaultLogFilters).toEqual(createDefaultLogFilters());
    expect(result.current.preferences.crewList).toEqual({
      statusFilter: 'all',
      sortOption: 'name-asc',
      view: 'grid'
    });
  });

  it('toggles theme and persists preference', () => {
    const { result } = renderHook(() => useUserPreferences());

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.preferences.theme).toBe('dark');

    const stored = JSON.parse(window.localStorage.getItem('crew-manager-preferences'));
    expect(stored.theme).toBe('dark');
    expect(stored.themeExplicit).toBe(true);
  });

  it('updates default log filters', () => {
    const { result } = renderHook(() => useUserPreferences());

    act(() => {
      result.current.setDefaultLogFilters({ level: 'error', search: 'agent' });
    });

    expect(result.current.preferences.defaultLogFilters.level).toBe('error');
    expect(result.current.preferences.defaultLogFilters.search).toBe('agent');
  });

  it('updates crew list defaults', () => {
    const { result } = renderHook(() => useUserPreferences());

    act(() => {
      result.current.setCrewListPreferences({ statusFilter: 'running', sortOption: 'lastRun-desc' });
    });

    expect(result.current.preferences.crewList).toEqual({
      statusFilter: 'running',
      sortOption: 'lastRun-desc',
      view: 'grid'
    });
  });
});
