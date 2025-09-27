import { act, renderHook } from '@testing-library/react';

import useCrewFilters from '../useCrewFilters';

const createOptions = (overrides = {}) => ({
  crews: [
    {
      id: '1',
      name: 'Alpha Crew',
      status: 'running',
      tags: ['urgent'],
      agents: [{ name: 'Agent One', role: 'Lead' }],
      tasks: [],
    },
    {
      id: '2',
      name: 'Beta Crew',
      status: 'ready',
      tags: ['backlog'],
      agents: [{ name: 'Agent Two', role: 'Support' }],
      tasks: [],
    },
  ],
  crewLogs: {
    1: [{ level: 'info', timestamp: new Date() }],
    2: [],
  },
  runningCrews: new Set(['1']),
  defaultStatusFilter: 'all',
  defaultSortOption: 'name-asc',
  getPreferredLogFilters: undefined,
  ...overrides,
});

describe('useCrewFilters', () => {
  it('filters crews based on the search query', () => {
    const { result } = renderHook(() => useCrewFilters(createOptions()));

    act(() => {
      result.current.setSearchQuery('beta');
    });

    expect(result.current.filteredCrews).toHaveLength(1);
    expect(result.current.filteredCrews[0].name).toBe('Beta Crew');
  });

  it('updates the status filter and filter config', () => {
    const { result } = renderHook(() => useCrewFilters(createOptions()));

    act(() => {
      result.current.setStatusFilter('running');
    });

    expect(result.current.statusFilter).toBe('running');
    expect(result.current.filterConfig.conditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'status', value: ['running'] }),
      ])
    );
  });

  it('resets log filters to preferred values', () => {
    const customFilters = { level: 'error' };
    const { result } = renderHook(() => useCrewFilters(createOptions({ getPreferredLogFilters: () => customFilters })));

    act(() => {
      result.current.setLogFilters({ level: 'debug' });
      result.current.resetLogFilters();
    });

    expect(result.current.logFilters.level).toBe('error');
  });
});
