import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SystemStatsPanel from './SystemStatsPanel';
import useSystemStatsHistory from '../../../hooks/useSystemStatsHistory';

jest.mock('../../../hooks/useSystemStatsHistory');

const mockUseSystemStatsHistory = useSystemStatsHistory;

const baseStats = {
  status: 'success',
  cpu: { usage: 35.2, cores: 8, frequency: '3.20 GHz' },
  memory: { used: 12.5, total: 32, percent: 45.5 },
  uptime: 123456,
  boot_time: new Date().toISOString(),
  os: 'TestOS',
  python_version: '3.11.0'
};

const createHistoryHookValue = (overrides = {}) => ({
  history: {
    window: '1h',
    availableWindows: ['1h', '24h'],
    datasets: {
      'cpu.usage': [
        { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 15 },
        { timestamp: new Date(), value: 30 }
      ],
      'memory.percent': [
        { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 40 },
        { timestamp: new Date(), value: 50 }
      ]
    },
    sampleCount: 4
  },
  datasets: {
    'cpu.usage': [
      { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 15 },
      { timestamp: new Date(), value: 30 }
    ],
    'memory.percent': [
      { timestamp: new Date(Date.now() - 5 * 60 * 1000), value: 40 },
      { timestamp: new Date(), value: 50 }
    ]
  },
  availableWindows: ['1h', '24h'],
  window: '1h',
  setWindow: jest.fn(),
  hasData: true,
  sampleCount: 4,
  isLoading: false,
  lastUpdated: new Date(),
  error: null,
  refresh: jest.fn(),
  setError: jest.fn(),
  ...overrides
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSystemStatsHistory.mockReset();
});

describe('SystemStatsPanel', () => {
  test('renders history chart when data is available', () => {
    mockUseSystemStatsHistory.mockReturnValue(createHistoryHookValue());

    render(
      <SystemStatsPanel
        stats={baseStats}
        isLoading={false}
        error={null}
        onRefresh={jest.fn()}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Resource Usage History')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Hour' })).toBeInTheDocument();
    expect(screen.getByText('Service Status')).toBeInTheDocument();
  });

  test('falls back to summary cards when history is unavailable', () => {
    mockUseSystemStatsHistory.mockReturnValue(
      createHistoryHookValue({
        datasets: {},
        history: null,
        hasData: false,
        error: new Error('History disabled'),
        availableWindows: ['1h', '24h']
      })
    );

    render(
      <SystemStatsPanel
        stats={baseStats}
        isLoading={false}
        error={null}
        onRefresh={jest.fn()}
        lastUpdated={new Date()}
      />
    );

    expect(screen.getByText('Service Status')).toBeInTheDocument();
    expect(screen.getByText('Historical data unavailable')).toBeInTheDocument();
  });

  test('triggers both REST and history refresh when clicking refresh', async () => {
    const onRefresh = jest.fn();
    const historyHookValue = createHistoryHookValue();
    mockUseSystemStatsHistory.mockReturnValue(historyHookValue);

    render(
      <SystemStatsPanel
        stats={baseStats}
        isLoading={false}
        error={null}
        onRefresh={onRefresh}
        lastUpdated={new Date()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Refresh Now/i }));

    expect(onRefresh).toHaveBeenCalled();
    expect(historyHookValue.refresh).toHaveBeenCalled();
  });
});
