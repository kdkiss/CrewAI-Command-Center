import { act, renderHook } from '@testing-library/react';

import useCrewEditorState, { EMPTY_CREW_DEFINITION } from '../useCrewEditorState';

const createBaseOptions = (overrides = {}) => ({
  mode: 'create',
  crewId: undefined,
  clonedCrewDefinition: undefined,
  fetchCrewDefinition: jest.fn(),
  createCrewDefinition: jest.fn(),
  updateCrewDefinition: jest.fn(),
  deleteCrew: jest.fn(),
  addToast: jest.fn(),
  setSelectedCrew: jest.fn(),
  crewTemplates: [],
  crewTemplatesLoading: false,
  crewTemplateError: null,
  fetchCrewTemplates: jest.fn().mockResolvedValue(undefined),
  getCrewTemplate: jest.fn(),
  navigate: jest.fn(),
  ...overrides,
});

describe('useCrewEditorState', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes create mode with empty definition', () => {
    const options = createBaseOptions();
    const { result } = renderHook(() => useCrewEditorState(options));

    expect(result.current.effectiveInitialData).toEqual(EMPTY_CREW_DEFINITION);
    expect(result.current.showTemplateGallery).toBe(true);
  });

  it('applies selected template when in create mode', async () => {
    const templateDefinition = {
      name: 'Template Alpha',
      agents: [{ name: 'Agent A' }],
      tasks: [{ name: 'Task X' }],
      metadata: { description: 'Example template', agent_order: ['Agent A'], task_order: ['Task X'] },
    };

    const getCrewTemplate = jest.fn().mockResolvedValue(templateDefinition);

    const options = createBaseOptions({ getCrewTemplate });
    const { result } = renderHook(() => useCrewEditorState(options));

    await act(async () => {
      await result.current.handleTemplateSelection('template-1');
    });

    expect(getCrewTemplate).toHaveBeenCalledWith('template-1');
    expect(result.current.selectedTemplateId).toBe('template-1');
    expect(result.current.effectiveInitialData.name).toBe('Template Alpha');
    expect(result.current.combinedTemplateError).toBeNull();
  });

  it('submits new crew definitions and navigates on success', async () => {
    const createCrewDefinition = jest.fn().mockResolvedValue(undefined);
    const addToast = jest.fn();
    const navigate = jest.fn();

    const options = createBaseOptions({ createCrewDefinition, addToast, navigate });
    const { result } = renderHook(() => useCrewEditorState(options));

    const payload = { id: 'crew-123', metadata: { name: 'Crew 123' } };

    await act(async () => {
      await result.current.handleSubmit(payload);
    });

    expect(createCrewDefinition).toHaveBeenCalledWith(payload);
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Crew Saved', type: 'success' }),
    );
    expect(navigate).toHaveBeenCalledWith('/crews');
  });

  it('deletes crews in edit mode when confirmed', async () => {
    const deleteCrew = jest.fn().mockResolvedValue(undefined);
    const addToast = jest.fn();
    const navigate = jest.fn();
    const setSelectedCrew = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    const options = createBaseOptions({
      mode: 'edit',
      crewId: 'crew-1',
      deleteCrew,
      addToast,
      navigate,
      setSelectedCrew,
      fetchCrewDefinition: jest.fn().mockResolvedValue({ id: 'crew-1' }),
    });

    const { result } = renderHook(() => useCrewEditorState(options));

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(deleteCrew).toHaveBeenCalledWith('crew-1');
    expect(addToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Crew Deleted', type: 'success' }),
    );
    expect(navigate).toHaveBeenCalledWith('/crews');
    expect(setSelectedCrew).toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
