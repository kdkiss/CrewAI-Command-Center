import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import axios from 'axios';
import io from 'socket.io-client';

import ActivityFeed from '../ActivityFeed';
import useCrewManager from '../../crews/state/useCrewManager';

jest.mock('axios');
const mockedAxios = axios;

jest.mock('../../../hooks/useSystemStats');
const { default: mockUseSystemStats } = jest.requireMock('../../../hooks/useSystemStats');

const ActivityHarness = () => {
  const { activityItems } = useCrewManager();
  return (
    <main>
      <ActivityFeed items={activityItems} crews={[{ id: 'crew-42', name: 'Observatory' }]} />
    </main>
  );
};

const getSocketHandler = (socket, event) => socket.on.mock.calls.find(([name]) => name === event)?.[1];

describe('Activity feed Socket.IO integration', () => {
  const { mockSocket } = io;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.handlers = {};
    window.localStorage.clear();

    mockUseSystemStats.mockReset();
    mockedAxios.get.mockReset();
    mockedAxios.post?.mockReset?.();
    mockedAxios.put?.mockReset?.();
    mockedAxios.delete?.mockReset?.();

    mockUseSystemStats.mockReturnValue({
      stats: null,
      error: null,
      isLoading: false,
      lastUpdated: null,
      refresh: jest.fn(),
    });

    mockedAxios.get.mockImplementation((url) => {
      if (url.endsWith('/crews')) {
        return Promise.resolve({
          data: [
            {
              id: 'crew-42',
              name: 'Observatory',
              description: 'Orbital research crew',
              inputs: {},
              agents: [],
              tasks: [],
            },
          ],
        });
      }
      if (url.endsWith('/activity')) {
        return Promise.resolve({
          data: {
            status: 'success',
            events: [
              {
                id: 'evt-1',
                type: 'crew_started',
                timestamp: '2024-05-01T11:59:00Z',
                data: { crew_id: 'crew-42', status: 'started' }
              },
              {
                id: 'evt-2',
                type: 'crew_log',
                timestamp: '2024-05-01T12:00:00Z',
                data: {
                  crewId: 'crew-42',
                  agent: 'Research Analyst',
                  message: 'Persisted synthesis',
                  level: 'info',
                  timestamp: '2024-05-01T12:00:00Z',
                  category: 'THINKING',
                  operationId: 'op-98',
                  sequence: 1,
                  isDuplicate: false,
                  duplicateCount: 0,
                }
              }
            ]
          }
        });
      }
      if (url.includes('/env-files')) {
        return Promise.resolve({ data: { success: true, files: [] } });
      }
      return Promise.resolve({ data: {} });
    });

    const resolved = Promise.resolve({ data: {} });
    mockedAxios.post?.mockImplementation?.(() => resolved);
    mockedAxios.put?.mockImplementation?.(() => resolved);
    mockedAxios.delete?.mockImplementation?.(() => resolved);
  });

  test('renders agent and category metadata from crew_log payloads', async () => {
    await act(async () => {
      render(<ActivityHarness />);
    });

    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledWith('/api/crews'));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledWith('/api/activity'));
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('crew_log', expect.any(Function)));
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('crew_started', expect.any(Function)));
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('activity_history', expect.any(Function)));

    const crewLogHandler = getSocketHandler(mockSocket, 'crew_log');
    const crewStartedHandler = getSocketHandler(mockSocket, 'crew_started');
    const historyHandler = getSocketHandler(mockSocket, 'activity_history');

    expect(crewLogHandler).toBeInstanceOf(Function);
    expect(crewStartedHandler).toBeInstanceOf(Function);
    expect(historyHandler).toBeInstanceOf(Function);

    await screen.findByText('Persisted synthesis');
    await screen.findByText(/started\./i);

    await act(async () => {
      historyHandler([
        {
          id: 'evt-1',
          type: 'crew_started',
          data: { crew_id: 'crew-42', status: 'started' }
        },
        {
          id: 'evt-2',
          type: 'crew_log',
          data: {
            crewId: 'crew-42',
            agent: 'Research Analyst',
            message: 'Persisted synthesis',
            level: 'info',
            timestamp: '2024-05-01T12:00:00Z',
            category: 'THINKING',
            operationId: 'op-98',
            sequence: 1,
            isDuplicate: false,
            duplicateCount: 0,
          }
        }
      ]);
    });

    expect(screen.getAllByText('Persisted synthesis')).toHaveLength(1);

    await act(async () => {
      crewStartedHandler({ crew_id: 'crew-42' });
    });

    const timeline = await screen.findByRole('list');
    expect(within(timeline).getAllByText(/started\./i)).toHaveLength(2);

    const basePayload = {
      crewId: 'crew-42',
      agent: 'Research Analyst',
      message: 'Synthesizing recent findings',
      level: 'info',
      timestamp: '2024-05-01T12:00:00Z',
      category: 'THINKING',
      operationId: 'op-99',
      sequence: 2,
      isDuplicate: false,
      duplicateCount: 0,
    };

    await act(async () => {
      crewLogHandler(basePayload);
    });

    await screen.findByText('Synthesizing recent findings');
    const agentLabels = screen.getAllByText(/Agent:/i);
    expect(agentLabels[agentLabels.length - 1]).toHaveTextContent('Agent: Research Analyst');

    const categoryLabels = screen.getAllByText('Category');
    const latestCategory = categoryLabels[categoryLabels.length - 1];
    expect(latestCategory.nextElementSibling).toHaveTextContent('THINKING');
    const logBadges = screen.getAllByText('Log');
    expect(logBadges.length).toBeGreaterThan(0);

    await act(async () => {
      crewLogHandler({ ...basePayload, isDuplicate: true, duplicateCount: 2 });
    });

    const matchingMessages = screen.getAllByText('Synthesizing recent findings');
    expect(matchingMessages).toHaveLength(1);
  });
});
