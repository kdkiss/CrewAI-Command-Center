import { act, renderHook } from '@testing-library/react';
import axios from 'axios';

import useCrewConfigEditor from '../useCrewConfigEditor';

jest.mock('axios');

describe('useCrewConfigEditor', () => {
  const addToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates environment files before saving', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { success: true, files: [] } })
      .mockResolvedValueOnce({ data: { success: true, content: '' } });

    const { result } = renderHook(() =>
      useCrewConfigEditor({ apiBase: '/api', selectedCrewId: '42', addToast })
    );

    act(() => {
      result.current.openEditor({ type: 'env', name: '.env' });
      result.current.setEditorContent('INVALID LINE');
    });

    await act(async () => {
      await result.current.saveEditorContent();
    });

    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', title: 'Validation Error' })
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('fetches environment files for the selected crew', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { success: true, files: ['.env', 'config.env'] } })
      .mockResolvedValueOnce({ data: { success: true, files: ['.env', 'config.env'] } });

    const { result } = renderHook(() =>
      useCrewConfigEditor({ apiBase: '/api', selectedCrewId: '99', addToast })
    );

    await act(async () => {
      await result.current.fetchEnvFiles();
    });

    expect(axios.get).toHaveBeenCalledWith('/api/crews/99/env-files');
    expect(result.current.envFiles).toEqual(['.env', 'config.env']);
  });
});
