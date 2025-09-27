import { act, renderHook } from '@testing-library/react';

import useConfirmDialog from '../useConfirmDialog';

describe('useConfirmDialog', () => {
  const baseArgs = () => ({
    crews: [
      { id: '1', name: 'Crew One' },
      { id: '2', name: 'Crew Two' },
    ],
    stopCrew: jest.fn(),
    deleteCrew: jest.fn().mockResolvedValue(undefined),
    addToast: jest.fn(),
    setSelectedCrew: jest.fn(),
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('opens a stop confirmation and confirms immediately', async () => {
    const args = baseArgs();
    const { result } = renderHook(() => useConfirmDialog(args));

    act(() => {
      result.current.requestStopCrew('1');
    });

    expect(result.current.state).toMatchObject({
      type: 'stop-crew',
      crewId: '1',
      confirmLabel: 'Stop Crew',
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(args.stopCrew).toHaveBeenCalledWith('1');
    expect(result.current.state).toBeNull();
  });

  it('handles delete confirmation workflow with toast feedback', async () => {
    const args = baseArgs();
    const { result } = renderHook(() => useConfirmDialog(args));

    act(() => {
      result.current.requestDeleteCrew('2');
    });

    expect(result.current.state).toMatchObject({
      type: 'delete-crew',
      crewId: '2',
      confirmLabel: 'Delete Crew',
    });

    await act(async () => {
      await result.current.handleConfirm();
    });

    expect(args.deleteCrew).toHaveBeenCalledWith('2');
    expect(args.addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Crew Deleted', type: 'success' }),
    );
    expect(args.setSelectedCrew).toHaveBeenCalled();
    expect(result.current.state).toBeNull();
  });
});
