const mockRefreshHistory = jest.fn();
const mockSetHistoryWindow = jest.fn();
const mockSetError = jest.fn();

const createDefaultHistory = () => {
  const timestamp = new Date();
  return {
    history: {
      window: '1h',
      availableWindows: ['1h', '24h'],
      datasets: {
        'cpu.usage': [
          { timestamp: new Date(timestamp.getTime() - 5 * 60 * 1000), value: 25 },
          { timestamp, value: 45 }
        ],
        'memory.percent': [
          { timestamp: new Date(timestamp.getTime() - 5 * 60 * 1000), value: 50 },
          { timestamp, value: 65 }
        ]
      },
      sampleCount: 4
    },
    datasets: {
      'cpu.usage': [
        { timestamp: new Date(timestamp.getTime() - 5 * 60 * 1000), value: 25 },
        { timestamp, value: 45 }
      ],
      'memory.percent': [
        { timestamp: new Date(timestamp.getTime() - 5 * 60 * 1000), value: 50 },
        { timestamp, value: 65 }
      ]
    },
    availableWindows: ['1h', '24h'],
    window: '1h',
    setWindow: mockSetHistoryWindow,
    hasData: true,
    sampleCount: 4,
    isLoading: false,
    lastUpdated: timestamp,
    error: null,
    refresh: mockRefreshHistory,
    setError: mockSetError
  };
};

const mockUseSystemStatsHistory = jest.fn(createDefaultHistory);

mockUseSystemStatsHistory.mockRefresh = mockRefreshHistory;
mockUseSystemStatsHistory.mockSetWindow = mockSetHistoryWindow;
mockUseSystemStatsHistory.mockSetError = mockSetError;

module.exports = {
  __esModule: true,
  default: mockUseSystemStatsHistory,
  useSystemStatsHistory: mockUseSystemStatsHistory,
  mockRefreshHistory,
  mockSetHistoryWindow,
  mockSetError
};
