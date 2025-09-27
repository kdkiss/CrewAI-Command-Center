import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { CrewManagerStateContext } from '../crewManager/useCrewManagerState';

import CrewMainContent from '../CrewMainContent';

jest.mock('@monaco-editor/react', () => () => <div data-testid="mock-editor" />, { virtual: true });

const createBaseProps = (overrides = {}) => ({
  view: 'crews',
  editorTarget: null,
  editorContent: '',
  onChangeContent: jest.fn(),
  onSave: jest.fn(),
  onCancel: jest.fn(),
  isSaving: false,
  saveSucceeded: false,
  saveError: null,
  isEditorLoading: false,
  storageKey: null,
  onClearDrafts: jest.fn(),
  selectedCrew: null,
  systemStats: null,
  systemStatsLoading: false,
  systemStatsError: null,
  onRefreshSystemStats: jest.fn(),
  systemStatsUpdatedAt: null,
  runningCrews: new Set(),
  pendingStarts: new Set(),
  pendingStops: new Set(),
  onStartCrew: jest.fn(),
  onStopCrew: jest.fn(),
  crewLogs: {},
  activityItems: [],
  crews: [],
  crewsLoading: false,
  logFilters: {},
  onChangeLogFilters: jest.fn(),
  onResetLogFilters: jest.fn(),
  crewError: null,
  createPreferredLogFilters: jest.fn(),
  logFontSize: 'medium',
  statusFilter: 'all',
  setStatusFilter: jest.fn(),
  availableStatusFilters: [],
  filteredCrews: [],
  searchQuery: '',
  setSearchQuery: jest.fn(),
  sortOption: 'name-asc',
  setSortOption: jest.fn(),
  onSelectCrew: jest.fn(),
  onCloseEditor: jest.fn(),
  crewListView: 'grid',
  setCrewListPreferences: jest.fn(),
  onOpenCrewPage: jest.fn(),
  ...overrides
});

const createContextValue = (props) => ({
  API_BASE: '/api',
  crews: props.crews,
  crewsLoading: props.crewsLoading,
  runningCrews: props.runningCrews,
  pendingStarts: props.pendingStarts,
  pendingStops: props.pendingStops,
  selectedCrew: props.selectedCrew,
  setSelectedCrew: props.onSelectCrew ?? jest.fn(),
  crewLogs: props.crewLogs,
  activityItems: props.activityItems,
  startCrew: props.onStartCrew ?? jest.fn(),
  stopCrew: props.onStopCrew ?? jest.fn(),
  crewError: props.crewError ?? null,
  envFiles: props.envFiles ?? [],
  envLoading: props.envLoading ?? false,
  envError: props.envError ?? null,
  isRefreshing: props.isRefreshing ?? false,
  refreshCrews: props.refreshCrews ?? jest.fn(),
  refreshError: props.refreshError ?? null,
  openEditor: props.openEditor ?? props.onChangeContent,
  closeEditor: props.onCloseEditor,
  filters: {
    filteredCrews: props.filteredCrews,
    searchQuery: props.searchQuery,
    setSearchQuery: props.setSearchQuery,
    statusFilter: props.statusFilter,
    setStatusFilter: props.setStatusFilter,
    availableStatusFilters: props.availableStatusFilters,
    availableTagFilters: props.availableTagFilters ?? [],
    sortOption: props.sortOption,
    setSortOption: props.setSortOption,
    logFilters: props.logFilters,
    setLogFilters: props.onChangeLogFilters,
    resetLogFilters: props.onResetLogFilters,
    createPreferredLogFilters: props.createPreferredLogFilters,
  },
  configEditorState: {
    editorTarget: props.editorTarget,
    editorContent: props.editorContent,
    setEditorContent: props.onChangeContent,
    saveEditorContent: props.onSave,
    closeEditor: props.onCloseEditor,
    savingFile: props.isSaving,
    saveSuccess: props.saveSucceeded,
    saveError: props.saveError,
    editorLoading: props.isEditorLoading,
    editorStorageKey: props.storageKey,
    clearAutosavedDrafts: props.onClearDrafts,
    fetchEnvFiles: props.fetchEnvFiles ?? jest.fn(),
    fetchEditorContent: props.fetchEditorContent ?? jest.fn(),
  },
  crewActions: {
    crewTemplates: props.crewTemplates ?? [],
    crewTemplatesLoading: props.crewTemplatesLoading ?? false,
    crewTemplateError: props.crewTemplateError ?? null,
    importingCrew: props.importingCrew ?? false,
    importStatus: props.importStatus ?? null,
    handleImportCrew: props.handleImportCrew ?? jest.fn(),
    createCrewDefinition: props.createCrewDefinition ?? jest.fn(),
    updateCrewDefinition: props.updateCrewDefinition ?? jest.fn(),
    deleteCrew: props.deleteCrew ?? jest.fn(),
    fetchCrewDefinition: props.fetchCrewDefinition ?? jest.fn(),
    fetchCrewTemplates: props.fetchCrewTemplates ?? jest.fn(),
    getCrewTemplate: props.getCrewTemplate ?? jest.fn(),
  },
  toastManager: {
    toasts: props.toasts ?? [],
    addToast: props.addToast ?? jest.fn(),
    removeToast: props.removeToast ?? jest.fn(),
  },
});

const renderWithContext = (props) => (
  render(
    <CrewManagerStateContext.Provider value={createContextValue(props)}>
      <CrewMainContent {...props} />
    </CrewManagerStateContext.Provider>
  )
);

describe('CrewMainContent (crews view)', () => {
  it('renders header controls with status options and handlers', () => {
    const setStatusFilter = jest.fn();
    const setSearchQuery = jest.fn();
    const setSortOption = jest.fn();

    const props = createBaseProps({
      availableStatusFilters: ['running', 'ready'],
      setStatusFilter,
      setSearchQuery,
      setSortOption,
    });

    renderWithContext(props);

    const searchInput = screen.getByLabelText(/search crews/i);
    fireEvent.change(searchInput, { target: { value: 'demo' } });
    expect(setSearchQuery).toHaveBeenCalledWith('demo');

    const statusSelect = screen.getByLabelText(/status/i);
    const statusOptions = within(statusSelect).getAllByRole('option');
    expect(statusOptions.map(option => option.value)).toEqual(expect.arrayContaining(['all', 'running', 'ready']));

    fireEvent.change(statusSelect, { target: { value: 'running' } });
    expect(setStatusFilter).toHaveBeenCalledWith('running');

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: 'name-desc' } });
    expect(setSortOption).toHaveBeenCalledWith('name-desc');

    expect(screen.getByRole('button', { name: /grid/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /list/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /panel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /page/i })).not.toBeInTheDocument();
  });

  it('renders loading skeletons when crews are loading', () => {
    const props = createBaseProps({ crewsLoading: true });
    renderWithContext(props);

    expect(screen.getByTestId('crew-grid-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('crew-card-skeleton').length).toBeGreaterThan(0);
  });

  it('renders crew cards when filtered crews are provided', () => {
    const crew = {
      id: '1',
      name: 'Example Crew',
      description: 'Example description',
      agents: [],
      tasks: []
    };

    const props = createBaseProps({
      crews: [crew],
      filteredCrews: [crew],
      crewLogs: {},
    });

    renderWithContext(props);

    expect(screen.getByRole('button', { name: /example crew/i })).toBeInTheDocument();
  });

  it('calls setCrewListPreferences when switching to list view', () => {
    const setCrewListPreferences = jest.fn();

    const props = createBaseProps({
      crewListView: 'grid',
      setCrewListPreferences,
    });

    renderWithContext(props);

    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    expect(setCrewListPreferences).toHaveBeenCalledWith({ view: 'list' });
  });

  it('shows empty state message when there are no crews', () => {
    const props = createBaseProps({ crews: [], filteredCrews: [], crewsLoading: false });

    renderWithContext(props);

    expect(screen.getByText(/No crews available yet/i)).toBeInTheDocument();
  });

  it('calls onOpenCrewPage when selecting a crew', () => {
    const crew = {
      id: 'crew-123',
      name: 'Page Mode Crew',
      description: 'Test crew',
      agents: [],
      tasks: []
    };

    const onOpenCrewPage = jest.fn();
    const onSelectCrew = jest.fn();

    const props = createBaseProps({
      crews: [crew],
      filteredCrews: [crew],
      crewLogs: { [crew.id]: [] },
      onOpenCrewPage,
      onSelectCrew,
    });

    renderWithContext(props);

    fireEvent.click(screen.getByRole('button', { name: /page mode crew/i }));

    expect(onOpenCrewPage).toHaveBeenCalledWith(expect.objectContaining({ id: 'crew-123' }));
    expect(onSelectCrew).not.toHaveBeenCalled();
  });
});
