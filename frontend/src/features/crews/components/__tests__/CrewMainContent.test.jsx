import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { CrewManagerStateContext } from '../crewManager/useCrewManagerState';

jest.mock('../../../../components/ConfigEditor', () => () => <div data-testid="config-editor" />);

import CrewMainContent from '../CrewMainContent';

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
  storageKey: '',
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
  onEditCrew: jest.fn(),
  onCloneCrew: jest.fn(),
  onDeleteCrew: jest.fn(),
  crewLogs: {},
  activityItems: [],
  crews: [],
  crewsLoading: false,
  logFilters: {},
  onChangeLogFilters: jest.fn(),
  onResetLogFilters: jest.fn(),
  crewError: null,
  createPreferredLogFilters: jest.fn(() => ({})),
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

const buildCrew = (overrides = {}) => ({
  id: 'crew-1',
  name: 'Research Crew',
  description: 'Runs research tasks',
  agents: [{ name: 'Analyst' }],
  tasks: [{ name: 'Collect Data' }],
  ...overrides
});

describe('CrewMainContent (crews view)', () => {
  it('renders header controls and handles input changes', () => {
    const props = createBaseProps();
    props.availableStatusFilters = ['running', 'ready'];

    renderWithContext(props);

    const searchInput = screen.getByLabelText(/search crews/i);
    fireEvent.change(searchInput, { target: { value: 'demo' } });
    expect(props.setSearchQuery).toHaveBeenCalledWith('demo');

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: 'running' } });
    expect(props.setStatusFilter).toHaveBeenCalledWith('running');

    const sortSelect = screen.getByLabelText(/sort by/i);
    fireEvent.change(sortSelect, { target: { value: 'name-desc' } });
    expect(props.setSortOption).toHaveBeenCalledWith('name-desc');

    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    expect(props.setCrewListPreferences).toHaveBeenCalledWith({ view: 'list' });

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
    const crew = buildCrew();

    const props = createBaseProps({
      crews: [crew],
      filteredCrews: [crew],
      crewLogs: {},
    });

    renderWithContext(props);

    expect(screen.getByRole('button', { name: /research crew/i })).toBeInTheDocument();
  });

  it('opens the crew page when a crew card is selected', () => {
    const crew = buildCrew({ id: 'crew-123', name: 'Selected Crew' });
    const props = createBaseProps();
    props.filteredCrews = [crew];
    props.crews = [crew];

    renderWithContext(props);

    fireEvent.click(screen.getByRole('button', { name: /selected crew/i }));

    expect(props.onOpenCrewPage).toHaveBeenCalledWith(expect.objectContaining({ id: 'crew-123' }));
    expect(props.onSelectCrew).not.toHaveBeenCalled();
  });

  it('shows a placeholder message encouraging full page selection', () => {
    const props = createBaseProps();
    renderWithContext(props);

    expect(screen.getByText(/Select a crew to get started/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Select a crew to open its full-page details/i).length).toBeGreaterThan(0);
  });
});
