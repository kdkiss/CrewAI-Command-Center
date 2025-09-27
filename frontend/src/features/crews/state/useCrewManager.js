import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

import useSystemStats from '../../../hooks/useSystemStats';
import {
  normalizeInputMetadata,
  coerceValue,
  validateValue,
} from '../../../components/crewInputUtils';
import useCrewToasts from './useCrewToasts';
import useCrewFilters, { evaluateCrewFilter } from './useCrewFilters';
import useCrewConfigEditor from './useCrewConfigEditor';
import useCrewSockets from './useCrewSockets';
import useCrewActions from './useCrewActions';
import { getApiErrorMessage, isLikelyNetworkError } from '../../../utils/apiErrorUtils';
import {
  API_BASE,
  resolveSocketOptions,
  SOCKET_OPTIONS
} from '../../../config/apiConfig';

const socket = (() => {
  return SOCKET_OPTIONS.url ? io(SOCKET_OPTIONS.url, SOCKET_OPTIONS.options) : io(SOCKET_OPTIONS.options);
})();

const useCrewManager = ({
  defaultStatusFilter,
  defaultSortOption,
  getPreferredLogFilters
} = {}) => {
  const [crews, setCrews] = useState([]);
  const [crewsLoading, setCrewsLoading] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState(null);
  const [runningCrews, setRunningCrews] = useState(new Set());
  const [pendingStarts, setPendingStarts] = useState(new Set());
  const [pendingStops, setPendingStops] = useState(new Set());
  const [crewLogs, setCrewLogs] = useState({});
  const [crewError, setCrewError] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [inputValidations, setInputValidations] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  const crewsRef = useRef([]);
  const selectedCrewRef = useRef(null);
  const inputValuesRef = useRef(inputValues);
  const inputValidationsRef = useRef(inputValidations);

  useEffect(() => {
    selectedCrewRef.current = selectedCrew;
  }, [selectedCrew]);

  useEffect(() => {
    crewsRef.current = crews;
  }, [crews]);

  useEffect(() => {
    inputValuesRef.current = inputValues;
  }, [inputValues]);

  useEffect(() => {
    inputValidationsRef.current = inputValidations;
  }, [inputValidations]);

  const { toasts, addToast, removeToast } = useCrewToasts();

  const selectedCrewId = selectedCrew?.id != null ? String(selectedCrew.id) : null;

  const {
    searchQuery,
    setSearchQuery,
    sortOption,
    setSortOption,
    filterConfig,
    updateFilterConfig,
    statusFilter,
    setStatusFilter,
    logFilters,
    setLogFilters,
    resetLogFilters,
    createPreferredLogFilters,
    filteredCrews,
    availableStatusFilters,
    availableTagFilters
  } = useCrewFilters({
    crews,
    crewLogs,
    runningCrews,
    defaultStatusFilter,
    defaultSortOption,
    getPreferredLogFilters
  });

  const {
    editorTarget,
    setEditorTarget,
    editorContent,
    setEditorContent,
    editorLoading,
    savingFile,
    saveSuccess,
    saveError,
    editorStorageKey,
    clearAutosavedDrafts,
    envFiles,
    envLoading,
    envError,
    fetchEnvFiles,
    fetchEditorContent,
    saveEditorContent,
    openEditor,
    closeEditor
  } = useCrewConfigEditor({
    apiBase: API_BASE,
    selectedCrewId,
    addToast
  });

  const { activityItems } = useCrewSockets({
    socket,
    apiBase: API_BASE,
    addToast,
    setCrewError,
    setCrews,
    setSelectedCrew,
    setRunningCrews,
    setPendingStarts,
    setPendingStops,
    setCrewLogs,
    crewsRef,
    selectedCrewRef
  });

  const refreshCrews = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    setCrewsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/crews`);
      const normalized = response.data.map(crew => ({ ...crew, id: String(crew.id) }));
      setCrews(normalized);
      if (selectedCrew) {
        const updatedCrew = response.data.find(crew => String(crew.id) === String(selectedCrew.id));
        if (updatedCrew) {
          setSelectedCrew({ ...updatedCrew, id: String(updatedCrew.id) });
        } else {
          setSelectedCrew(response.data.length > 0 ? { ...response.data[0], id: String(response.data[0].id) } : null);
        }
      } else {
        setSelectedCrew(response.data.length > 0 ? { ...response.data[0], id: String(response.data[0].id) } : null);
      }
    } catch (error) {
      console.error('Error refreshing crews:', error);
      const message = getApiErrorMessage(error, {
        defaultMessage: 'Failed to refresh crews. Please try again.',
        apiBase: API_BASE
      });
      setRefreshError(message);
      if (isLikelyNetworkError(error)) {
        addToast({
          title: 'Connection Error',
          message,
          type: 'error'
        });
      }
    } finally {
      setIsRefreshing(false);
      setCrewsLoading(false);
    }
  }, [addToast, selectedCrew]);

  const {
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
  } = useCrewActions({
    apiBase: API_BASE,
    refreshCrews,
    addToast,
    crews
  });

  const {
    stats: systemStats,
    error: systemStatsError,
    isLoading: systemStatsLoading,
    lastUpdated: systemStatsUpdatedAt,
    refresh: refreshSystemStats
  } = useSystemStats({ socket });

  useEffect(() => {
    let isMounted = true;

    const fetchCrewsInitial = async () => {
      setCrewsLoading(true);
      setCrewError(null);
      try {
        const response = await axios.get(`${API_BASE}/crews`);
        if (!isMounted) {
          return;
        }
        setCrews(response.data.map(crew => ({ ...crew, id: String(crew.id) }))); 
        setSelectedCrew(response.data.length > 0 ? { ...response.data[0], id: String(response.data[0].id) } : null);
      } catch (error) {
        console.error('Error fetching crews:', error);
        if (isMounted) {
          const message = getApiErrorMessage(error, {
            defaultMessage: 'Failed to load crews. Please try again.',
            apiBase: API_BASE
          });
          setCrewError(message);
          if (isLikelyNetworkError(error)) {
            addToast({
              title: 'Connection Error',
              message,
              type: 'error'
            });
          }
        }
      } finally {
        if (isMounted) {
          setCrewsLoading(false);
        }
      }
    };

    fetchCrewsInitial();
    fetchCrewTemplates().catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [addToast, fetchCrewTemplates]);

  useEffect(() => {
    const crewId = selectedCrew?.id != null ? String(selectedCrew.id) : null;
    if (!crewId) {
      return;
    }

    const crewInputs = selectedCrew.inputs;
    const hasInputs = crewInputs && typeof crewInputs === 'object' && Object.keys(crewInputs).length > 0;

    if (hasInputs) {
      return;
    }

    const prefix = `${crewId}_`;

    setInputValues(prev => {
      let changed = false;
      const nextEntries = Object.entries(prev).filter(([key]) => {
        const shouldKeep = !key.startsWith(prefix);
        if (!shouldKeep) {
          changed = true;
        }
        return shouldKeep;
      });

      if (!changed) {
        return prev;
      }

      const next = Object.fromEntries(nextEntries);
      inputValuesRef.current = next;
      return next;
    });

    setInputValidations(prev => {
      let changed = false;
      const nextEntries = Object.entries(prev).filter(([key]) => {
        const shouldKeep = !key.startsWith(prefix);
        if (!shouldKeep) {
          changed = true;
        }
        return shouldKeep;
      });

      if (!changed) {
        return prev;
      }

      const next = Object.fromEntries(nextEntries);
      inputValidationsRef.current = next;
      return next;
    });

    setCrewError(prev => {
      if (!prev) {
        return prev;
      }

      const normalized = prev.toLowerCase();
      if (normalized.includes('required inputs')) {
        return null;
      }

      return prev;
    });
  }, [selectedCrew]);

  const startCrew = useCallback((crewId) => {
    const stringCrewId = String(crewId);
    const crew = crewsRef.current.find(item => String(item.id) === stringCrewId);

    if (!crew) {
      return;
    }

    const crewInputs = crew.inputs && typeof crew.inputs === 'object' ? crew.inputs : {};
    const normalizedEntries = Object.entries(crewInputs).map(([key, definition]) => [
      key,
      normalizeInputMetadata(definition)
    ]);

    if (normalizedEntries.length === 0) {
      setPendingStarts(prev => {
        const next = new Set(prev);
        next.add(stringCrewId);
        return next;
      });

      setCrewError(null);

      socket.emit('startCrew', {
        crew_id: stringCrewId,
        inputs: {}
      });
      return;
    }

    const resolvedInputs = {};
    const invalidInputs = new Set();
    const missingInputs = new Set();

    normalizedEntries.forEach(([key, metadata]) => {
      const valueKey = `${stringCrewId}_${key}`;
      const hasExplicitValue = Object.prototype.hasOwnProperty.call(inputValuesRef.current, valueKey);
      const effectiveValue = hasExplicitValue ? inputValuesRef.current[valueKey] : metadata.defaultValue;
      const parsedValue = coerceValue(metadata, effectiveValue);
      const validation = validateValue(metadata, parsedValue, effectiveValue);

      if (!validation.isValid) {
        invalidInputs.add(key);
        return;
      }

      if (parsedValue === undefined) {
        if (metadata.required) {
          missingInputs.add(key);
        }
        return;
      }

      if (metadata.options && metadata.options.length > 0) {
        const selectedOption = metadata.options.find(
          option => option.value === parsedValue || option.stringValue === String(parsedValue)
        );
        resolvedInputs[key] = selectedOption ? selectedOption.value : parsedValue;
      } else {
        resolvedInputs[key] = parsedValue;
      }
    });

    const validationPrefix = `${stringCrewId}_`;
    Object.entries(inputValidationsRef.current || {}).forEach(([compositeKey, validation]) => {
      if (compositeKey.startsWith(validationPrefix) && validation && validation.isValid === false) {
        invalidInputs.add(compositeKey.slice(validationPrefix.length));
      }
    });

    normalizedEntries.forEach(([key, metadata]) => {
      if (metadata.required && !Object.prototype.hasOwnProperty.call(resolvedInputs, key)) {
        missingInputs.add(key);
      }
    });

    if (invalidInputs.size > 0 || missingInputs.size > 0) {
      const messages = [];
      if (invalidInputs.size > 0) {
        messages.push(`Please resolve validation errors for: ${Array.from(invalidInputs).join(', ')}.`);
      }
      if (missingInputs.size > 0) {
        messages.push(`Please provide values for required inputs: ${Array.from(missingInputs).join(', ')}.`);
      }
      const message = messages.join(' ');
      setCrewError(message);
      addToast({
        title: 'Cannot Start Crew',
        message,
        type: 'error'
      });
      return;
    }

    setPendingStarts(prev => {
      const next = new Set(prev);
      next.add(stringCrewId);
      return next;
    });

    setCrewError(null);

    socket.emit('startCrew', {
      crew_id: stringCrewId,
      inputs: resolvedInputs
    });
  }, [addToast]);

  const stopCrew = useCallback((crewId) => {
    const stringCrewId = String(crewId);
    setPendingStops(prev => {
      const next = new Set(prev);
      next.add(stringCrewId);
      return next;
    });
    setPendingStarts(prev => {
      if (!prev.has(stringCrewId)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(stringCrewId);
      return next;
    });
    socket.emit('stopCrew', { crew_id: stringCrewId });
  }, []);

  const updateInputValue = useCallback((key, value, validation) => {
    const crewId = selectedCrew?.id;
    if (!crewId) {
      return;
    }

    const compositeKey = `${crewId}_${key}`;

    setInputValues(prev => {
      const next = {
        ...prev,
        [compositeKey]: value
      };
      inputValuesRef.current = next;
      return next;
    });

    setInputValidations(prev => {
      const next = { ...prev };
      if (validation) {
        next[compositeKey] = validation;
      } else {
        delete next[compositeKey];
      }
      inputValidationsRef.current = next;
      return next;
    });
  }, [selectedCrew?.id]);

  const getInputValue = useCallback((key, crew = selectedCrew) => {
    const crewId = crew?.id != null ? String(crew.id) : null;
    if (!crewId) {
      return undefined;
    }

    const valueKey = `${crewId}_${key}`;
    if (Object.prototype.hasOwnProperty.call(inputValues, valueKey)) {
      const storedValue = inputValues[valueKey];
      return storedValue === undefined ? '' : storedValue;
    }

    const inputMetadata = crew?.inputs?.[key];
    if (typeof inputMetadata === 'object' && inputMetadata !== null) {
      const normalized = normalizeInputMetadata(inputMetadata);
      return normalized.defaultValue ?? '';
    }

    if (inputMetadata === undefined || inputMetadata === null) {
      return '';
    }

    return inputMetadata;
  }, [inputValues, selectedCrew]);

  return {
    API_BASE,
    crews,
    crewsLoading,
    crewTemplates,
    crewTemplatesLoading,
    crewTemplateError,
    selectedCrew,
    setSelectedCrew,
    runningCrews,
    pendingStarts,
    pendingStops,
    crewLogs,
    activityItems,
    searchQuery,
    setSearchQuery,
    filterConfig,
    updateFilterConfig,
    sortOption,
    setSortOption,
    logFilters,
    setLogFilters,
    resetLogFilters,
    createPreferredLogFilters,
    editorTarget,
    setEditorTarget,
    editorContent,
    setEditorContent,
    editorLoading,
    savingFile,
    saveSuccess,
    saveError,
    editorStorageKey,
    clearAutosavedDrafts,
    selectedCrewId,
    systemStats,
    systemStatsError,
    systemStatsLoading,
    systemStatsUpdatedAt,
    refreshSystemStats,
    startCrew,
    stopCrew,
    getInputValue,
    updateInputValue,
    crewError,
    envFiles,
    envLoading,
    envError,
    isRefreshing,
    refreshCrews,
    refreshError,
    importingCrew,
    importStatus,
    handleImportCrew,
    saveEditorContent,
    openEditor,
    closeEditor,
    fetchCrewTemplates,
    getCrewTemplate,
    statusFilter,
    setStatusFilter,
    filteredCrews,
    availableStatusFilters,
    availableTagFilters,
    fetchEnvFiles,
    fetchEditorContent,
    createCrewDefinition,
    updateCrewDefinition,
    deleteCrew,
    fetchCrewDefinition,
    toasts,
    addToast,
    removeToast,
    filters: {
      searchQuery,
      setSearchQuery,
      sortOption,
      setSortOption,
      filterConfig,
      updateFilterConfig,
      statusFilter,
      setStatusFilter,
      logFilters,
      setLogFilters,
      resetLogFilters,
      createPreferredLogFilters,
      filteredCrews,
      availableStatusFilters,
      availableTagFilters
    },
    configEditorState: {
      editorTarget,
      setEditorTarget,
      editorContent,
      setEditorContent,
      editorLoading,
      savingFile,
      saveSuccess,
      saveError,
      editorStorageKey,
      clearAutosavedDrafts,
      envFiles,
      envLoading,
      envError,
      fetchEnvFiles,
      fetchEditorContent,
      saveEditorContent,
      openEditor,
      closeEditor
    },
    crewActions: {
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
    },
    toastManager: {
      toasts,
      addToast,
      removeToast
    }
  };
};

export { evaluateCrewFilter };

export default useCrewManager;
