import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as yaml from 'js-yaml';

import { parseCrewYaml, readFileContent, validateCrewData } from './crewUtils';
import { getApiErrorMessage, isLikelyNetworkError } from '../../../utils/apiErrorUtils';

const useCrewActions = ({ apiBase, refreshCrews, addToast, crews }) => {
  const [crewTemplates, setCrewTemplates] = useState([]);
  const [crewTemplatesLoading, setCrewTemplatesLoading] = useState(false);
  const [crewTemplateError, setCrewTemplateError] = useState(null);
  const [importingCrew, setImportingCrew] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  const crewTemplateCacheRef = useRef({});
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const fetchCrewTemplates = useCallback(async () => {
    if (!isMountedRef.current) {
      return [];
    }

    setCrewTemplatesLoading(true);
    setCrewTemplateError(null);

    try {
      const response = await axios.get(`${apiBase}/crew-templates`);
      const templates = Array.isArray(response.data) ? response.data : [];

      if (isMountedRef.current) {
        setCrewTemplates(templates);
      }

      return templates;
    } catch (error) {
      console.error('Error fetching crew templates:', error);

      if (isMountedRef.current) {
        const message = getApiErrorMessage(error, {
          defaultMessage: 'Failed to load crew templates. Please try again.',
          apiBase
        });
        setCrewTemplateError(message);
        if (isLikelyNetworkError(error)) {
          addToast({
            title: 'Connection Error',
            message,
            type: 'error'
          });
        }
      }

      throw error;
    } finally {
      if (isMountedRef.current) {
        setCrewTemplatesLoading(false);
      }
    }
  }, [addToast, apiBase]);

  const getCrewTemplate = useCallback(async (templateId) => {
    const normalizedId = typeof templateId === 'string' ? templateId.trim() : '';

    if (!normalizedId) {
      throw new Error('Template identifier is required');
    }

    const cache = crewTemplateCacheRef.current;
    if (cache[normalizedId]) {
      return JSON.parse(JSON.stringify(cache[normalizedId]));
    }

    try {
      const encodedId = encodeURIComponent(normalizedId);
      const response = await axios.get(`${apiBase}/crew-templates/${encodedId}`);
      const template = response.data;

      if (!template || typeof template !== 'object') {
        throw new Error('Template payload was empty');
      }

      cache[normalizedId] = template;
      return JSON.parse(JSON.stringify(template));
    } catch (error) {
      console.error(`Error fetching crew template ${normalizedId}:`, error);
      const message = getApiErrorMessage(error, {
        defaultMessage: 'Failed to load crew template.',
        apiBase
      });
      throw new Error(message);
    }
  }, [apiBase]);

  const handleImportCrew = useCallback(async () => {
    setImportingCrew(true);
    setImportStatus(null);

    try {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.yaml,.yml';

      fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
          setImportingCrew(false);
          return;
        }

        try {
          const fileContent = await readFileContent(file);
          const crewData = parseCrewYaml(fileContent);
          validateCrewData(crewData);
          const response = await axios.post(`${apiBase}/crews/import`, {
            name: crewData.name,
            description: crewData.description,
            agents: crewData.agents,
            tasks: crewData.tasks
          });

          if (response.data.success) {
            await refreshCrews();
            const crewName = crewData.name || file.name;
            const successMessage = `${crewName} imported successfully.`;
            setImportStatus({ type: 'success', message: successMessage });
            setTimeout(() => setImportStatus(null), 4000);
            addToast({
              title: 'Crew Imported',
              message: successMessage,
              type: 'success'
            });
          } else {
            const errorMessage = response.data.message || 'Failed to import crew';
            setImportStatus({ type: 'error', message: errorMessage });
            setTimeout(() => setImportStatus(null), 4000);
            addToast({
              title: 'Import Failed',
              message: errorMessage,
              type: 'error'
            });
          }
        } catch (error) {
          console.error('Error importing crew:', error);
          const errorMessage = getApiErrorMessage(error, {
            defaultMessage: 'Failed to import crew',
            apiBase
          });
          setImportStatus({ type: 'error', message: errorMessage });
          setTimeout(() => setImportStatus(null), 4000);
          addToast({
            title: 'Import Failed',
            message: errorMessage,
            type: 'error'
          });
        } finally {
          setImportingCrew(false);
        }
      };

      fileInput.click();
    } catch (error) {
      console.error('Error setting up file import:', error);
      const errorMessage = 'Failed to set up file import';
      setImportStatus({ type: 'error', message: errorMessage });
      setTimeout(() => setImportStatus(null), 4000);
      addToast({
        title: 'Import Failed',
        message: errorMessage,
        type: 'error'
      });
      setImportingCrew(false);
    }
  }, [addToast, apiBase, refreshCrews]);

  const createCrewDefinition = useCallback(async (definition) => {
    const response = await axios.post(`${apiBase}/crews`, definition);
    await refreshCrews();
    return response.data;
  }, [apiBase, refreshCrews]);

  const updateCrewDefinition = useCallback(async (crewId, definition) => {
    const encodedId = encodeURIComponent(crewId);
    const response = await axios.put(`${apiBase}/crews/${encodedId}`, definition);
    await refreshCrews();
    return response.data;
  }, [apiBase, refreshCrews]);

  const deleteCrew = useCallback(async (crewId) => {
    const encodedId = encodeURIComponent(crewId);
    const response = await axios.delete(`${apiBase}/crews/${encodedId}`);
    await refreshCrews();
    return response.data;
  }, [apiBase, refreshCrews]);

  const fetchCrewDefinition = useCallback(async (crewId) => {
    const encodedId = encodeURIComponent(crewId);

    const parseYamlContent = (content) => {
      if (!content) {
        return {};
      }

      try {
        const parsed = yaml.load(content);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        console.error('Failed to parse crew YAML content:', error);
        return {};
      }
    };

    const [agentsResponse, tasksResponse] = await Promise.all([
      axios.get(`${apiBase}/crews/${encodedId}/agents`),
      axios.get(`${apiBase}/crews/${encodedId}/tasks`)
    ]);

    const rawAgents = parseYamlContent(agentsResponse.data?.content);
    const rawTasks = parseYamlContent(tasksResponse.data?.content);

    const agentsList = Object.entries(rawAgents || {}).map(([name, value]) => ({
      name,
      role: value?.role ?? '',
      goal: value?.goal ?? '',
      backstory: value?.backstory ?? ''
    }));

    const tasksList = Object.entries(rawTasks || {}).map(([name, value]) => {
      const dependencies = Array.isArray(value?.dependencies)
        ? value.dependencies
        : Array.isArray(value?.context)
          ? value.context
          : [];

      const sanitizedDependencies = dependencies
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);

      const inputSchema = value?.inputs && typeof value.inputs === 'object' && !Array.isArray(value.inputs)
        ? value.inputs
        : value?.input_schema && typeof value.input_schema === 'object' && !Array.isArray(value.input_schema)
          ? value.input_schema
          : {};

      return {
        name,
        description: value?.description ?? '',
        expected_output: value?.expected_output ?? '',
        dependencies: sanitizedDependencies,
        inputs: inputSchema,
      };
    });

    const summary = crews.find(crew => String(crew.id) === String(crewId));

    const agentOrder = Array.isArray(summary?.agent_order) && summary.agent_order.length
      ? summary.agent_order.filter(name => agentsList.some(agent => agent.name === name))
      : agentsList.map(agent => agent.name);

    const taskOrder = Array.isArray(summary?.task_order) && summary.task_order.length
      ? summary.task_order.filter(name => tasksList.some(task => task.name === name))
      : tasksList.map(task => task.name);

    const metadata = {
      id: crewId,
      name: summary?.name ?? crewId,
      description: summary?.description ?? '',
      icon: summary?.icon ?? '',
      agents: agentsList,
      tasks: tasksList,
      agentOrder,
      taskOrder
    };

    return metadata;
  }, [apiBase, crews]);

  return {
    crewTemplates,
    crewTemplatesLoading,
    crewTemplateError,
    importingCrew,
    importStatus,
    fetchCrewTemplates,
    getCrewTemplate,
    handleImportCrew,
    createCrewDefinition,
    updateCrewDefinition,
    deleteCrew,
    fetchCrewDefinition
  };
};

export default useCrewActions;
