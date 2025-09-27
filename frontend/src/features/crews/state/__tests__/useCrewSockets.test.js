import { act, renderHook } from '@testing-library/react';
import axios from 'axios';

import useCrewSockets from '../useCrewSockets';

jest.mock('axios');

describe('useCrewSockets', () => {
  const socket = {
    on: jest.fn(),
    off: jest.fn(),
  };

  const createStateUpdater = (initialValue) => {
    let value = initialValue;
    const setter = jest.fn((next) => {
      value = typeof next === 'function' ? next(value) : next;
    });
    return [() => value, setter];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { events: [] } });
  });

  it('appends crew logs and activity items', async () => {
    const [getCrewLogs, setCrewLogs] = createStateUpdater({});

    const { result } = renderHook(() =>
      useCrewSockets({
        socket,
        apiBase: '/api',
        addToast: jest.fn(),
        setCrewError: jest.fn(),
        setCrews: jest.fn(),
        setSelectedCrew: jest.fn(),
        setRunningCrews: jest.fn(),
        setPendingStarts: jest.fn(),
        setPendingStops: jest.fn(),
        setCrewLogs,
        crewsRef: { current: [] },
        selectedCrewRef: { current: null },
      })
    );

    await act(async () => {});

    act(() => {
      result.current.applyCrewLog({
        crewId: '1',
        message: 'Test message',
        level: 'info',
        timestamp: new Date().toISOString(),
      });
    });

    expect(getCrewLogs()).toHaveProperty('1');
    expect(getCrewLogs()['1']).toHaveLength(1);
    expect(result.current.activityItems).toHaveLength(1);
  });
});
