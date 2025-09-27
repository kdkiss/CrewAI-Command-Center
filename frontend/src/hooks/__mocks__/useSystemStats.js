const mockRefreshSystemStats = jest.fn();

const mockUseSystemStats = jest.fn(() => ({
  stats: {
    status: 'success',
    cpu: { usage: 12.3, cores: 4, frequency: '2.40 GHz' },
    memory: { used: 8.2, total: 16, percent: 51.2 },
    uptime: 12345,
    boot_time: new Date().toISOString(),
    os: 'TestOS',
    python_version: '3.11.0'
  },
  error: null,
  isLoading: false,
  lastUpdated: new Date(),
  refresh: mockRefreshSystemStats
}));

mockUseSystemStats.mockRefresh = mockRefreshSystemStats;

module.exports = {
  __esModule: true,
  default: mockUseSystemStats,
  useSystemStats: mockUseSystemStats,
  mockRefreshSystemStats
};
