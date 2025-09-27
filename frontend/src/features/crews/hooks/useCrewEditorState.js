import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../components/crewManager/useCrewManagerState';
import { getApiErrorMessage } from '../../../utils/apiErrorUtils';

export const EMPTY_CREW_DEFINITION = {
  id: '',
  name: '',
  description: '',
  icon: '',
  agents: [],
  tasks: [],
  agentOrder: [],
  taskOrder: []
};

export const useCrewEditorState = ({
  mode,
  crewId,
  clonedCrewDefinition,
  fetchCrewDefinition,
  createCrewDefinition,
  updateCrewDefinition,
  deleteCrew,
  addToast,
  setSelectedCrew,
  crewTemplates,
  crewTemplatesLoading,
  crewTemplateError,
  fetchCrewTemplates,
  getCrewTemplate,
  navigate
}) => {
  const buildEmptyDefinition = useCallback(() => ({
    ...EMPTY_CREW_DEFINITION,
    agents: [],
    tasks: [],
    agentOrder: [],
    taskOrder: []
  }), []);

  const createInitialDefinition = useMemo(() => {
    if (mode !== 'create') {
      return null;
    }

    if (!clonedCrewDefinition) {
      return buildEmptyDefinition();
    }

    const sanitized = {
      ...buildEmptyDefinition(),
      ...clonedCrewDefinition,
      id: clonedCrewDefinition.id ?? ''
    };

    sanitized.agents = Array.isArray(clonedCrewDefinition.agents)
      ? clonedCrewDefinition.agents.map(agent => ({ ...agent }))
      : [];

    sanitized.tasks = Array.isArray(clonedCrewDefinition.tasks)
      ? clonedCrewDefinition.tasks.map(task => ({ ...task }))
      : [];

    sanitized.agentOrder = Array.isArray(clonedCrewDefinition.agentOrder)
      ? [...clonedCrewDefinition.agentOrder]
      : [];

    sanitized.taskOrder = Array.isArray(clonedCrewDefinition.taskOrder)
      ? [...clonedCrewDefinition.taskOrder]
      : [];

    return sanitized;
  }, [mode, clonedCrewDefinition, buildEmptyDefinition]);

  const [initialData, setInitialData] = useState(() => (
    mode === 'create' ? (createInitialDefinition || buildEmptyDefinition()) : null
  ));
  const [loading, setLoading] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState(null);
  const templateFetchAttemptedRef = useRef(false);

  const hasTemplates = Array.isArray(crewTemplates) && crewTemplates.length > 0;

  useEffect(() => {
    let cancelled = false;

    setSelectedTemplateId(null);
    setTemplateError(null);

    if (mode === 'edit') {
      if (!crewId) {
        setError('Crew identifier is missing.');
        setLoading(false);
        return undefined;
      }

      setLoading(true);
      fetchCrewDefinition(crewId)
        .then(data => {
          if (!cancelled) {
            setInitialData(data);
            setError(null);
          }
        })
        .catch(fetchError => {
          if (!cancelled) {
            const message = getApiErrorMessage(fetchError, {
              defaultMessage: 'Failed to load crew definition.',
              apiBase: API_BASE
            });
            setError(message);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }

    setInitialData(createInitialDefinition || buildEmptyDefinition());
    setApplyingTemplate(false);
    setError(null);
    setLoading(false);
    return undefined;
  }, [mode, crewId, fetchCrewDefinition, createInitialDefinition, buildEmptyDefinition]);

  useEffect(() => {
    if (mode !== 'create') {
      templateFetchAttemptedRef.current = false;
      return;
    }

    if (templateFetchAttemptedRef.current || crewTemplatesLoading || hasTemplates) {
      return;
    }

    templateFetchAttemptedRef.current = true;
    fetchCrewTemplates().catch(() => {});
  }, [mode, crewTemplatesLoading, hasTemplates, fetchCrewTemplates]);

  const normalizeTemplateDefinition = useCallback((definition) => {
    const base = buildEmptyDefinition();

    if (!definition || typeof definition !== 'object') {
      return base;
    }

    const agents = Array.isArray(definition.agents)
      ? definition.agents.map(agent => ({ ...agent }))
      : [];

    const tasks = Array.isArray(definition.tasks)
      ? definition.tasks.map(task => ({ ...task }))
      : [];

    const metadataSource = definition.metadata && typeof definition.metadata === 'object'
      ? definition.metadata
      : {};

    const agentOrderSource = Array.isArray(definition.agentOrder)
      ? definition.agentOrder
      : Array.isArray(metadataSource.agent_order)
        ? metadataSource.agent_order
        : agents.map(agent => agent?.name ?? '');

    const taskOrderSource = Array.isArray(definition.taskOrder)
      ? definition.taskOrder
      : Array.isArray(metadataSource.task_order)
        ? metadataSource.task_order
        : tasks.map(task => task?.name ?? '');

    const sanitizedAgentOrder = agentOrderSource
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);

    const sanitizedTaskOrder = taskOrderSource
      .map(name => (typeof name === 'string' ? name.trim() : ''))
      .filter(Boolean);

    const normalizedMetadata = {
      name: definition.name ?? metadataSource.name ?? base.name,
      description: definition.description ?? metadataSource.description ?? '',
      icon: definition.icon ?? metadataSource.icon ?? '',
      agent_order: sanitizedAgentOrder,
      task_order: sanitizedTaskOrder,
      tags: Array.isArray(metadataSource.tags)
        ? [...metadataSource.tags]
        : Array.isArray(definition.tags)
          ? [...definition.tags]
          : [],
    };

    return {
      ...base,
      name: normalizedMetadata.name,
      description: normalizedMetadata.description,
      icon: normalizedMetadata.icon,
      agents,
      tasks,
      agentOrder: sanitizedAgentOrder,
      taskOrder: sanitizedTaskOrder,
      metadata: normalizedMetadata,
    };
  }, [buildEmptyDefinition]);

  const combinedTemplateError = templateError || crewTemplateError || null;

  const handleTemplateSelection = useCallback(async (templateId) => {
    if (mode !== 'create') {
      return;
    }

    if (templateId == null) {
      setSelectedTemplateId(null);
      setTemplateError(null);
      setApplyingTemplate(false);
      setInitialData(buildEmptyDefinition());
      setError(null);
      return;
    }

    setApplyingTemplate(true);
    setTemplateError(null);

    try {
      const definition = await getCrewTemplate(templateId);
      const normalized = normalizeTemplateDefinition(definition);
      setInitialData(normalized);
      setSelectedTemplateId(templateId);
      setError(null);
    } catch (selectionError) {
      const detail = selectionError?.response?.data?.detail || selectionError.message || 'Failed to load template.';
      setTemplateError(detail);
      setSelectedTemplateId(null);
    } finally {
      setApplyingTemplate(false);
    }
  }, [mode, buildEmptyDefinition, getCrewTemplate, normalizeTemplateDefinition]);

  const handleRefreshTemplates = useCallback(() => {
    fetchCrewTemplates().catch(() => {});
  }, [fetchCrewTemplates]);

  const handleSuccess = useCallback((message) => {
    addToast({ title: 'Crew Saved', message, type: 'success' });
    navigate('/crews');
  }, [addToast, navigate]);

  const handleSubmit = useCallback(async (payload) => {
    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        await createCrewDefinition(payload);
        handleSuccess(`${payload.metadata?.name || payload.id} created successfully.`);
      } else if (crewId) {
        await updateCrewDefinition(crewId, payload);
        handleSuccess(`${payload.metadata?.name || crewId} updated successfully.`);
      }
    } catch (submitError) {
      const message = submitError?.response?.data?.detail || submitError.message || 'Failed to save crew.';
      setError(message);
      addToast({ title: 'Save Failed', message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [mode, crewId, createCrewDefinition, updateCrewDefinition, handleSuccess, addToast]);

  const handleDelete = useCallback(async () => {
    if (!crewId) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete crew "${crewId}"? This action cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await deleteCrew(crewId);
      setSelectedCrew(prev => (prev && String(prev.id) === String(crewId) ? null : prev));
      addToast({ title: 'Crew Deleted', message: `Crew ${crewId} deleted successfully.`, type: 'success' });
      navigate('/crews');
    } catch (deleteError) {
      const message = deleteError?.response?.data?.detail || deleteError.message || 'Failed to delete crew.';
      setError(message);
      addToast({ title: 'Delete Failed', message, type: 'error' });
      setSubmitting(false);
    }
  }, [crewId, deleteCrew, setSelectedCrew, addToast, navigate]);

  const handleCancel = useCallback(() => {
    navigate('/crews');
  }, [navigate]);

  const effectiveInitialData = initialData ?? {
    ...EMPTY_CREW_DEFINITION,
    id: crewId || ''
  };

  const heading = mode === 'create'
    ? 'Create Crew'
    : `Edit Crew: ${effectiveInitialData.name || crewId || ''}`;

  const showLoadingState = mode === 'edit' && loading;
  const showErrorState = mode === 'edit' && !loading && error && !initialData;
  const showTemplateGallery = mode === 'create';

  return {
    heading,
    effectiveInitialData,
    showLoadingState,
    showErrorState,
    submitting,
    error,
    combinedTemplateError,
    selectedTemplateId,
    applyingTemplate,
    handleTemplateSelection,
    handleRefreshTemplates,
    handleSubmit,
    handleDelete,
    handleCancel,
    showTemplateGallery,
    crewTemplates,
    crewTemplatesLoading,
  };
};

export default useCrewEditorState;
