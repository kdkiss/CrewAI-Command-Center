import { act, renderHook } from '@testing-library/react';
import axios from 'axios';

import useCrewActions from '../useCrewActions';

jest.mock('axios');

describe('useCrewActions', () => {
  const refreshCrews = jest.fn();
  const addToast = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    refreshCrews.mockResolvedValue();
  });

  it('fetches crew templates and updates state', async () => {
    axios.get.mockResolvedValueOnce({ data: [{ id: 'template-1' }] });

    const { result } = renderHook(() =>
      useCrewActions({ apiBase: '/api', refreshCrews, addToast, crews: [] })
    );

    await act(async () => {
      const templates = await result.current.fetchCrewTemplates();
      expect(templates).toHaveLength(1);
    });

    expect(result.current.crewTemplates).toEqual([{ id: 'template-1' }]);
    expect(result.current.crewTemplatesLoading).toBe(false);
  });

  it('creates a crew definition and refreshes crews', async () => {
    axios.post.mockResolvedValue({ data: { success: true } });

    const { result } = renderHook(() =>
      useCrewActions({ apiBase: '/api', refreshCrews, addToast, crews: [] })
    );

    await act(async () => {
      const response = await result.current.createCrewDefinition({ name: 'Example' });
      expect(response).toEqual({ success: true });
    });

    expect(axios.post).toHaveBeenCalledWith('/api/crews', { name: 'Example' });
    expect(refreshCrews).toHaveBeenCalled();
  });
});
