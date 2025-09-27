import { act, renderHook } from '@testing-library/react';

import useCrewToasts from '../useCrewToasts';

describe('useCrewToasts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('adds and removes toasts manually', () => {
    const { result } = renderHook(() => useCrewToasts());

    act(() => {
      result.current.addToast({ title: 'Test', message: 'Toast' });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(result.current.toasts[0].id);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('removes toasts after the configured duration', () => {
    const { result } = renderHook(() => useCrewToasts(1000));

    act(() => {
      result.current.addToast({ title: 'Expiring', message: 'Soon' });
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});
