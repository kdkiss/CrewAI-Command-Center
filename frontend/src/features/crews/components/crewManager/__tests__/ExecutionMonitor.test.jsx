import React from 'react';
import { render } from '@testing-library/react';

import ExecutionMonitor from '../ExecutionMonitor';

jest.mock('../useCrewManagerState', () => ({
  useCrewManagerState: jest.fn(),
}));

const { useCrewManagerState: mockUseCrewManagerState } = jest.requireMock('../useCrewManagerState');

const mockActiveCrewMonitor = jest.fn();
const mockSystemStatsPanel = jest.fn();
const mockActivityFeed = jest.fn();

jest.mock('../../ActiveCrewMonitor', () => ({
  __esModule: true,
  default: (props) => {
    mockActiveCrewMonitor(props);
    return <div data-testid="active-crew-monitor" />;
  },
}));

jest.mock('../../SystemStatsPanel', () => ({
  __esModule: true,
  default: (props) => {
    mockSystemStatsPanel(props);
    return <div data-testid="system-stats-panel" />;
  },
}));

jest.mock('../../../../activity/ActivityFeed', () => ({
  __esModule: true,
  default: (props) => {
    mockActivityFeed(props);
    return <div data-testid="activity-feed" />;
  },
}));

const createState = (overrides = {}) => ({
  crews: [{ id: '1', name: 'Crew' }],
  runningCrews: new Set(['1']),
  crewLogs: { 1: [] },
  pendingStarts: new Set(),
  pendingStops: new Set(),
  closeEditor: jest.fn(),
  systemStats: { status: 'success' },
  systemStatsLoading: false,
  systemStatsError: null,
  refreshSystemStats: jest.fn(),
  systemStatsUpdatedAt: new Date('2024-01-01T00:00:00.000Z'),
  activityItems: [{ id: 'evt', type: 'log' }],
  ...overrides,
});

describe('ExecutionMonitor', () => {
  beforeEach(() => {
    mockUseCrewManagerState.mockReset();
    mockActiveCrewMonitor.mockClear();
    mockSystemStatsPanel.mockClear();
    mockActivityFeed.mockClear();
  });

  it('renders the ActiveCrewMonitor view with context data', () => {
    const onStopCrew = jest.fn();
    const onSelectCrew = jest.fn();
    const state = createState({ closeEditor: jest.fn() });

    mockUseCrewManagerState.mockReturnValue(state);

    render(
      <ExecutionMonitor
        view="monitor"
        onStopCrew={onStopCrew}
        onSelectCrew={onSelectCrew}
      />
    );

    expect(mockActiveCrewMonitor).toHaveBeenCalledWith(expect.objectContaining({
      crews: state.crews,
      runningCrews: state.runningCrews,
      crewLogs: state.crewLogs,
      pendingStarts: state.pendingStarts,
      pendingStops: state.pendingStops,
      onStopCrew,
      onSelectCrew,
      onCloseEditor: state.closeEditor,
    }));
  });

  it('prefers the explicit onCloseEditor prop over context closeEditor', () => {
    const providedCloseEditor = jest.fn();
    const state = createState();

    mockUseCrewManagerState.mockReturnValue(state);

    render(
      <ExecutionMonitor
        view="monitor"
        onCloseEditor={providedCloseEditor}
      />
    );

    expect(mockActiveCrewMonitor).toHaveBeenCalledWith(expect.objectContaining({
      onCloseEditor: providedCloseEditor,
    }));
  });

  it('renders the system monitor view', () => {
    const state = createState({
      systemStats: { status: 'success', cpu: {} },
      systemStatsLoading: true,
      systemStatsError: 'error',
      refreshSystemStats: jest.fn(),
      systemStatsUpdatedAt: new Date('2024-02-01T00:00:00.000Z'),
    });

    mockUseCrewManagerState.mockReturnValue(state);

    render(<ExecutionMonitor view="system" />);

    expect(mockSystemStatsPanel).toHaveBeenCalledWith(expect.objectContaining({
      stats: state.systemStats,
      isLoading: state.systemStatsLoading,
      error: state.systemStatsError,
      onRefresh: state.refreshSystemStats,
      lastUpdated: state.systemStatsUpdatedAt,
    }));
  });

  it('renders the activity view', () => {
    const state = createState();
    mockUseCrewManagerState.mockReturnValue(state);

    render(<ExecutionMonitor view="activity" />);

    expect(mockActivityFeed).toHaveBeenCalledWith(expect.objectContaining({
      items: state.activityItems,
      crews: state.crews,
    }));
  });

  it('returns null for unsupported views', () => {
    mockUseCrewManagerState.mockReturnValue(createState());

    const { container } = render(<ExecutionMonitor view="unknown" />);
    expect(container.firstChild).toBeNull();
  });
});
