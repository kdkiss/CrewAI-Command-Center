import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const useCrewConfigEditor = ({ apiBase, selectedCrewId, addToast }) => {
  const [editorTarget, setEditorTarget] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorLoading, setEditorLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [draftLoadedFromStorage, setDraftLoadedFromStorage] = useState(false);
  const [envFiles, setEnvFiles] = useState([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState(null);

  const editorTargetType = editorTarget?.type;
  const editorTargetName = editorTarget?.name;

  const editorStorageKey = useMemo(() => {
    if (!selectedCrewId || !editorTargetType) {
      return null;
    }

    const safeName = String(editorTargetName || '').replace(/\s+/g, '_');
    return `crew-config:${selectedCrewId}:${editorTargetType}:${safeName}`;
  }, [selectedCrewId, editorTargetType, editorTargetName]);

  const fetchEnvFiles = useCallback(async () => {
    if (!selectedCrewId) {
      setEnvFiles([]);
      return;
    }

    setEnvLoading(true);
    setEnvError(null);
    try {
      const response = await axios.get(`${apiBase}/crews/${selectedCrewId}/env-files`);
      if (response.data.success) {
        setEnvFiles(response.data.files || []);
      } else {
        console.error('Error fetching environment files:', response.data.message);
        setEnvFiles([]);
        setEnvError(response.data.message || 'Failed to load environment files');
      }
    } catch (error) {
      console.error('Error fetching environment files:', error);
      setEnvFiles([]);
      setEnvError(error.response?.data?.detail || error.message || 'Failed to load environment files');
    } finally {
      setEnvLoading(false);
    }
  }, [apiBase, selectedCrewId]);

  const fetchEditorContent = useCallback(async (target) => {
    if (!selectedCrewId || !target) return;

    setEditorLoading(true);
    try {
      let response;
      if (target.type === 'env') {
        const encodedName = encodeURIComponent(target.name);
        response = await axios.get(`${apiBase}/crews/${selectedCrewId}/env/${encodedName}`);
      } else {
        response = await axios.get(`${apiBase}/crews/${selectedCrewId}/${target.name}`);
      }

      if (response.data.success) {
        if (target.type === 'env') {
          setEditorContent(response.data.content ?? '');
        } else {
          setEditorContent(response.data.content || '# No content available');
        }
      } else {
        console.error('Error fetching configuration content:', response.data.message);
        const message = response.data.message || 'Unknown error';
        if (target.type === 'env') {
          setEditorContent(`# Error loading .env file: ${message}`);
        } else {
          setEditorContent('# Error loading content: ' + message);
        }
      }
    } catch (error) {
      console.error('Error fetching configuration content:', error);
      const message = error.response?.data?.detail || error.message || 'Unknown error';
      if (target.type === 'env') {
        setEditorContent(`# Error loading .env file: ${message}`);
      } else {
        setEditorContent('# Error loading content: ' + message);
      }
    } finally {
      setEditorLoading(false);
    }
  }, [apiBase, selectedCrewId]);

  const clearAutosavedDrafts = useCallback(() => {
    if (!editorStorageKey) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(editorStorageKey);
      window.localStorage.removeItem(`${editorStorageKey}:versions`);
    } catch (error) {
      console.warn('Failed to clear autosaved drafts', error);
    }

    setDraftLoadedFromStorage(false);

    if (editorTarget && selectedCrewId) {
      fetchEditorContent(editorTarget);
    } else {
      setEditorContent('');
    }
  }, [editorStorageKey, editorTarget, selectedCrewId, fetchEditorContent]);

  const getEnvValidationError = (content) => {
    const invalidLines = [];
    const linePattern = /^(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=.*$/;

    content.split(/\r?\n/).forEach((rawLine, index) => {
      const trimmed = rawLine.trim();
      if (trimmed === '' || trimmed.startsWith('#')) {
        return;
      }

      if (!linePattern.test(trimmed)) {
        invalidLines.push(index + 1);
      }
    });

    if (invalidLines.length === 0) {
      return null;
    }

    if (invalidLines.length === 1) {
      return `Invalid environment variable on line ${invalidLines[0]}. Use KEY=VALUE format.`;
    }

    return `Invalid environment variables on lines ${invalidLines.join(', ')}. Use KEY=VALUE format.`;
  };

  const saveEditorContent = useCallback(async () => {
    if (!selectedCrewId || !editorTarget) return;

    setSaveSuccess(false);
    setSaveError(null);

    if (editorTarget.type === 'env') {
      const validationError = getEnvValidationError(editorContent);
      if (validationError) {
        setSaveError(validationError);
        addToast({
          title: 'Validation Error',
          message: validationError,
          type: 'error'
        });
        return;
      }
    }

    setSavingFile(true);

    try {
      let response;
      if (editorTarget.type === 'env') {
        const encodedName = encodeURIComponent(editorTarget.name);
        response = await axios.post(`${apiBase}/crews/${selectedCrewId}/env/${encodedName}`, {
          content: editorContent
        });
      } else {
        response = await axios.post(`${apiBase}/crews/${selectedCrewId}/${editorTarget.name}`, {
          content: editorContent
        });
      }

      if (response.data.success) {
        setSaveSuccess(true);
        if (editorTarget.type === 'env') {
          fetchEnvFiles();
        }
        addToast({
          title: 'Configuration Saved',
          message: `${editorTarget.name} saved successfully.`,
          type: 'success'
        });
        setTimeout(() => {
          setEditorTarget(null);
          setSaveSuccess(false);
        }, 1500);
      } else {
        const fallbackMessage = editorTarget.type === 'env'
          ? 'Failed to save environment file'
          : 'Failed to save YAML content';
        const errorMessage = response.data.message || fallbackMessage;
        setSaveError(errorMessage);
        addToast({
          title: 'Save Failed',
          message: errorMessage,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Error saving configuration';
      setSaveError(errorMessage);
      addToast({
        title: 'Save Failed',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setSavingFile(false);
    }
  }, [addToast, apiBase, editorContent, editorTarget, fetchEnvFiles, selectedCrewId]);

  const openEditor = useCallback((target) => {
    setEditorContent('');
    setSaveSuccess(false);
    setSaveError(null);
    setDraftLoadedFromStorage(false);
    setEditorTarget(target);
  }, []);

  const closeEditor = useCallback(() => {
    setEditorTarget(null);
    setSaveSuccess(false);
    setSaveError(null);
    setDraftLoadedFromStorage(false);
  }, []);

  useEffect(() => {
    if (!editorStorageKey) {
      setDraftLoadedFromStorage(false);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    let restored = false;

    try {
      const storedValue = window.localStorage.getItem(editorStorageKey);
      if (storedValue != null) {
        setEditorContent(storedValue);
        restored = true;
      }
    } catch (error) {
      console.warn('Failed to restore autosaved draft', error);
    }

    setDraftLoadedFromStorage(restored);
  }, [editorStorageKey]);

  useEffect(() => {
    if (!editorStorageKey) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeUnload = () => {
      if (!editorContent) {
        try {
          window.localStorage.removeItem(editorStorageKey);
        } catch (error) {
          console.warn('Failed to clear autosaved draft before unload', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [editorContent, editorStorageKey]);

  useEffect(() => {
    if (!editorStorageKey) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(editorStorageKey, editorContent ?? '');
    } catch (error) {
      console.warn('Failed to persist autosaved draft', error);
    }
  }, [editorContent, editorStorageKey]);

  useEffect(() => {
    if (editorTarget && selectedCrewId) {
      if (draftLoadedFromStorage) {
        return;
      }

      fetchEditorContent(editorTarget);
    }
  }, [editorTarget, selectedCrewId, fetchEditorContent, draftLoadedFromStorage]);

  useEffect(() => {
    if (selectedCrewId) {
      fetchEnvFiles();
    } else {
      setEnvFiles([]);
    }
  }, [selectedCrewId, fetchEnvFiles]);

  return {
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
  };
};

export default useCrewConfigEditor;
