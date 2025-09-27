import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import CrewList from '../CrewList';

jest.mock('../useCrewManagerState', () => ({
  useCrewManagerState: jest.fn(),
  useCrewFiltersContext: jest.fn(),
}));

const {
  useCrewManagerState: mockUseCrewManagerState,
  useCrewFiltersContext: mockUseCrewFiltersContext,
} = jest.requireMock('../useCrewManagerState');

const mockCrewCard = jest.fn();

jest.mock('../../../../../components/CrewCard', () => ({
  __esModule: true,
  default: (props) => {
    mockCrewCard(props);
    return (
      <button type="button" onClick={() => props.onSelect?.(props.crew)}>
        {props.crew.name}
      </button>
    );
  },
}));

const createState = (overrides = {}) => ({
  crews: [],
  crewsLoading: false,
  runningCrews: new Set(),
  selectedCrew: null,
  crewLogs: {},
  pendingStarts: new Set(),
  pendingStops: new Set(),
  closeEditor: jest.fn(),
  ...overrides,
});

const createFilterState = (overrides = {}) => ({
  filteredCrews: [],
  searchQuery: '',
  setSearchQuery: jest.fn(),
  statusFilter: 'all',
  setStatusFilter: jest.fn(),
  availableStatusFilters: [],
  sortOption: 'name-asc',
  setSortOption: jest.fn(),
  ...overrides,
});

describe('CrewList', () => {
  beforeEach(() => {
    mockCrewCard.mockClear();
    mockUseCrewManagerState.mockReset();
    mockUseCrewFiltersContext.mockReset();
    mockUseCrewFiltersContext.mockReturnValue(createFilterState());
  });

  it('renders search and filter controls using crew manager state', () => {
    const setSearchQuery = jest.fn();
    const setStatusFilter = jest.fn();
    const setSortOption = jest.fn();

    mockUseCrewManagerState.mockReturnValue(createState());
    mockUseCrewFiltersContext.mockReturnValue(createFilterState({
      availableStatusFilters: ['running', 'failed'],
      setSearchQuery,
      setStatusFilter,
      setSortOption,
    }));

    render(<CrewList />);

    fireEvent.change(screen.getByLabelText(/search crews/i), { target: { value: 'alpha' } });
    expect(setSearchQuery).toHaveBeenCalledWith('alpha');

    const statusSelect = screen.getByLabelText(/status/i);
    const statusValues = Array.from(statusSelect.options).map(option => option.value);
    expect(statusValues).toEqual(expect.arrayContaining(['all', 'running', 'failed']));

    fireEvent.change(statusSelect, { target: { value: 'running' } });
    expect(setStatusFilter).toHaveBeenCalledWith('running');

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: 'name-desc' } });
    expect(setSortOption).toHaveBeenCalledWith('name-desc');
  });

  it('calls setCrewListPreferences when toggling the view', () => {
    mockUseCrewManagerState.mockReturnValue(createState());
    const setCrewListPreferences = jest.fn();

    render(<CrewList crewListView="grid" setCrewListPreferences={setCrewListPreferences} />);

    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    expect(setCrewListPreferences).toHaveBeenCalledWith({ view: 'list' });
  });

  it('normalizes crew selection before invoking callbacks', () => {
    const crew = { id: 123, name: 'Alpha Crew' };
    const onOpenCrewPage = jest.fn();

    mockUseCrewManagerState.mockReturnValue(createState({
      filteredCrews: [crew],
      crews: [crew],
    }));
    mockUseCrewFiltersContext.mockReturnValue(createFilterState({ filteredCrews: [crew] }));

    render(<CrewList onOpenCrewPage={onOpenCrewPage} />);

    fireEvent.click(screen.getByRole('button', { name: crew.name }));
    expect(onOpenCrewPage).toHaveBeenCalledWith({ id: '123', name: crew.name });
  });
});
